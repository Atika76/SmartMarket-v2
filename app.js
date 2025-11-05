const { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, EDGE_FUNCTION_URL } = window.__CONFIG__;
const { createClient } = supabase;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// AUTH állapot
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supa.auth.getSession();
  const loginLink = document.getElementById('loginLink');
  const logoutBtn = document.getElementById('logoutBtn');
  if (session) {
    loginLink.textContent = session.user.email;
    loginLink.href = '#';
    logoutBtn.classList.remove('hidden');
    logoutBtn.onclick = async ()=>{ await supa.auth.signOut(); location.reload(); };
  }
});

// Képfeltöltés
async function uploadImages(files){
  const urls=[];
  const max=Math.min(files.length,3);
  for(let i=0;i<max;i++){
    const f=files[i];
    const key=`ad-${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
    const { data, error } = await supa.storage.from(BUCKET).upload(key,f);
    if(error)throw error;
    const { data:pub } = supa.storage.from(BUCKET).getPublicUrl(data.path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

// Mentés
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('adForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const msg=document.getElementById('adFormMsg');
    msg.textContent='Mentés...';
    const title=document.getElementById('title').value.trim();
    const desc=document.getElementById('description').value.trim();
    const cat=document.getElementById('category').value;
    const price=document.getElementById('price').value?parseInt(document.getElementById('price').value):null;
    const phone=document.getElementById('phone').value.trim()||null;
    const web=document.getElementById('website').value.trim()||null;
    const files=document.getElementById('images').files;
    try{
      const { data: { user } } = await supa.auth.getUser();
      if (!user) {
        throw new Error('Nem vagy bejelentkezve! Jelentkezz be az auth.html oldalon.');
      }
      let urls=[];
      if(files.length>0)urls=await uploadImages(files);
      const { error } = await supa.from('hirdetesek').insert({ 
        user_id: user.id, 
        cim:title, 
        leiras:desc, 
        kategoria:cat, 
        ar:price, 
        telefon:phone, 
        weboldal:web, 
        kepek:urls 
      });
      if(error)throw error;
      msg.className='text-green-600 text-sm'; msg.textContent='Sikeresen mentve!'; e.target.reset(); loadList();
    }catch(err){ msg.className='text-red-600 text-sm'; msg.textContent='Hiba: '+err.message; }
  });
});

// *** MÓDOSÍTOTT RÉSZ (Lista) ***
async function loadList(){
  const q=document.getElementById('q').value.trim();
  const cat=document.getElementById('filterCategory').value;
  const sort=document.getElementById('sortBy').value;
  let query=supa.from('hirdetesek').select('*');
  if(q)query=query.or(`cim.ilike.%${q}%,leiras.ilike.%${q}%`);
  if(cat)query=query.eq('kategoria',cat);
  if(sort==='price_asc')query=query.order('ar',{ascending:true});
  else if(sort==='price_desc')query=query.order('ar',{ascending:false});
  else query=query.order('created_at',{ascending:false});
  
  // *** ÚJ RÉSZ: Lekérjük a bejelentkezett felhasználót ***
  const { data: { session } } = await supa.auth.getSession();
  const currentUserId = session?.user?.id; // A bejelentkezett felhasználó ID-ja

  const { data, error }=await query.limit(60);
  const list=document.getElementById('list');
  const empty=document.getElementById('emptyState');
  list.innerHTML='';
  if(error||!data||data.length===0){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  
  data.forEach(ad=>{
    const img=(ad.kepek&&ad.kepek[0])||'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
    const price=ad.ar?new Intl.NumberFormat('hu-HU').format(ad.ar)+' Ft':'–';

    // *** ÚJ RÉSZ: Törlés gomb HTML generálása, ha a felhasználó a tulajdonos ***
    let deleteButtonHtml = '';
    if (currentUserId && ad.user_id === currentUserId) {
      deleteButtonHtml = `
        <button 
          data-id="${ad.id}" 
          class="delete-btn bg-red-500 text-white px-3 py-1 rounded text-xs mt-2 self-start hover:bg-red-600">
          Törlés
        </button>`;
    }

    // *** MÓDOSÍTOTT RÉSZ: A Törlés gomb hozzáadása a kártyához ***
    list.innerHTML+=`<article class="bg-white rounded shadow overflow-hidden flex flex-col">
      <img src="${img}" class="h-40 w-full object-cover"/>
      <div class="p-3 flex-1 flex flex-col">
        <div class="text-xs text-violet-700">${ad.kategoria||''}</div>
        <h3 class="font-semibold">${ad.cim}</h3>
        <p class="text-sm text-gray-600 flex-1">${ad.leiras||''}</p>
        <div class="mt-2 font-bold text-violet-700">${price}</div>
        ${deleteButtonHtml} 
      </div></article>`;
  });
}

// *** MÓDOSÍTOTT RÉSZ (Keresés és Törlés eseményfigyelői) ***
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchBtn').addEventListener('click',loadList);
  ['q','filterCategory','sortBy'].forEach(id=>document.getElementById(id).addEventListener('change',loadList));
  loadList(); // Első lista betöltés

  // *** ÚJ RÉSZ: Eseményfigyelő a Törlés gombokhoz (Esemény delegálás) ***
  document.getElementById('list').addEventListener('click', async (e) => {
    // Ellenőrizzük, hogy a kattintás a .delete-btn osztályú gombon történt-e
    if (e.target && e.target.classList.contains('delete-btn')) {
      e.preventDefault();
      const id = e.target.dataset.id; // A gomb 'data-id' attribútumából vesszük az ID-t
      
      if (confirm('Biztosan törölni szeretnéd ezt a hirdetést? Ezt nem lehet visszavonni.')) {
        try {
          // Törlési parancs küldése a Supabase-nek
          const { error } = await supa.from('hirdetesek').delete().eq('id', id);
          if (error) throw error;
          
          // Sikeres törlés után újratöltjük a listát
          loadList(); 
        } catch (err) {
          alert('Hiba a törlés során: ' + err.message);
        }
      }
    }
  });
});

// Gemini AI
document.addEventListener('DOMContentLoaded',()=>{
  const aiBtn=document.getElementById('aiSuggest');
  const aiLoading=document.getElementById('aiLoading');
  const title=document.getElementById('title');
  const desc=document.getElementById('description');
  aiBtn.addEventListener('click',async()=>{
    if(!title.value.trim()){alert('Adj meg egy címet!');return;}
    aiLoading.classList.remove('hidden');aiBtn.disabled=true;
    try{
      const prompt=`Írj rövid, eladható magyar hirdetést ehhez: "${title.value.trim()}". Adj meg kiemelt előnyöket, állapotot, és zárd felhívással.`;
      const res=await fetch(EDGE_FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_ANON_KEY}`},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
      if(!res.ok)throw new Error('Gemini hiba');
      const data=await res.json();
      const txt=data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if(txt)desc.value=txt;else alert('Nincs válasz.');
    }catch(err){alert('Hiba: '+err.message);}finally{aiLoading.classList.add('hidden');aiBtn.disabled=false;}
  });
});
