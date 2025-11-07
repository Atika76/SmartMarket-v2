const { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, EDGE_FUNCTION_URL } = window.__CONFIG__;
const { createClient } = supabase;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// *** Admin email cím ***
const ADMIN_EMAIL = 'atika.76@windowslive.com';

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

// Képfeltöltés (5 KÉPRE)
async function uploadImages(files){
  const urls=[];
  const max=Math.min(files.length, 5); // 5-ös korlát
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

// Mentés (JAVÍTVA AZ RLS HIBÁRA)
document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('adForm')) {
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
          user_id: user.id, // EZ A LÉNYEG!
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
  }
});

// Lista (ADMIN TÖRLÉSSEL és ÚJ LINKEKKEL)
async function loadList(){
  // Először ellenőrizzük, hogy a lista konténer létezik-e az oldalon
  const listContainer = document.getElementById('list');
  if (!listContainer) return; // Ha nem, (pl. részletes oldalon vagyunk), nem csinálunk semmit
  
  const q=document.getElementById('q').value.trim();
  const cat=document.getElementById('filterCategory').value;
  const sort=document.getElementById('sortBy').value;
  let query=supa.from('hirdetesek').select('*');
  if(q)query=query.or(`cim.ilike.%${q}%,leiras.ilike.%${q}%`);
  if(cat)query=query.eq('kategoria',cat);
  if(sort==='price_asc')query=query.order('ar',{ascending:true});
  else if(sort==='price_desc')query=query.order('ar',{ascending:false});
  else query=query.order('created_at',{ascending:false});
  
  const { data: { session } } = await supa.auth.getSession();
  const currentUserId = session?.user?.id; 
  const currentUserEmail = session?.user?.email;
  const isAdmin = currentUserEmail === ADMIN_EMAIL; 

  const { data, error }=await query.limit(60);
  const list=document.getElementById('list');
  const empty=document.getElementById('emptyState');
  list.innerHTML='';
  if(error||!data||data.length===0){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  
  data.forEach(ad=>{
    const coverImage = (ad.kepek && ad.kepek[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
    const price=ad.ar?new Intl.NumberFormat('hu-HU').format(ad.ar)+' Ft':'–';

    let deleteButtonHtml = '';
    const isOwner = currentUserId && ad.user_id === currentUserId;
    if (isOwner || isAdmin) {
      deleteButtonHtml = `
        <button 
          data-id="${ad.id}" 
          class="delete-btn ${isAdmin && !isOwner ? 'bg-yellow-500' : 'bg-red-500'} text-white px-3 py-1 rounded text-xs mt-2 self-start hover:opacity-80">
          Törlés ${isAdmin && !isOwner ? '(Admin)' : ''}
        </button>`;
    }

    // *** JAVÍTÁS: A kártya most már egy link a részletes oldalra ***
    list.innerHTML+=`
      <article class="bg-white rounded shadow overflow-hidden flex flex-col">
        <a href="#ad/${ad.id}" class="ad-link block">
          <img src="${coverImage}" class="h-40 w-full object-cover">
        </a>
        <div class="p-3 flex-1 flex flex-col">
          <div class="text-xs text-violet-700">${ad.kategoria||''}</div>
          <a href="#ad/${ad.id}" class="ad-link block">
            <h3 class="font-semibold hover:text-violet-600">${ad.cim}</h3>
          </a>
          <p class="text-sm text-gray-600 flex-1">${ad.leiras.substring(0, 100)}${ad.leiras.length > 100 ? '...' : ''}</p>
          <div class="mt-2 font-bold text-violet-700">${price}</div>
          ${deleteButtonHtml} 
        </div>
      </article>`;
  });
}

// *** ÚJ FUNKCIÓ: RÉSZLETES OLDAL MEGJELENÍTÉSE ***
async function showDetailPage(adId) {
  const detailPage = document.getElementById('detail-page');
  detailPage.innerHTML = '<p class="text-center text-lg p-10">Hirdetés betöltése...</p>';
  
  try {
    const { data: ad, error } = await supa.from('hirdetesek').select('*').eq('id', adId).single();
    if (error) throw error;
    if (!ad) throw new Error('Hirdetés nem található.');

    const price = ad.ar ? new Intl.NumberFormat('hu-HU').format(ad.ar) + ' Ft' : 'Nincs megadva';
    const coverImage = (ad.kepek && ad.kepek[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
    
    // Képgaléria HTML generálása
    let galleryHtml = '';
    if (ad.kepek && ad.kepek.length > 0) {
      galleryHtml = `
        <h3 class="text-2xl font-semibold mb-4">Képek</h3>
        <div class="detail-gallery mb-6">
          ${ad.kepek.map(imgUrl => `
            <a href="${imgUrl}" target="_blank">
              <img src="${imgUrl}" alt="Hirdetés kép" class="w-full h-full object-cover rounded-md shadow-md hover:opacity-80 transition-opacity">
            </a>
          `).join('')}
        </div>`;
    } else {
      galleryHtml = `
        <h3 class="text-2xl font-semibold mb-4">Kép</h3>
        <img src="${coverImage}" alt="Hirdetés kép" class="w-full max-w-lg mx-auto rounded-md shadow-md mb-6">
      `;
    }

    // A részletes oldal HTML-jének összeállítása
    detailPage.innerHTML = `
      <div class="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-4xl mx-auto">
        <a href="#" class="inline-block text-violet-600 hover:text-violet-800 mb-4">&larr; Vissza a listához</a>
        
        <div class="mb-4">
          <span class="text-sm font-medium text-violet-700 bg-violet-100 px-3 py-1 rounded-full">${ad.kategoria}</span>
        </div>
        
        <h1 class="text-4xl font-bold mb-2">${ad.cim}</h1>
        <p class="text-3xl font-bold text-violet-600 mb-6">${price}</p>
        
        <div class="border-t border-b border-gray-200 py-6 mb-6">
          <h3 class="text-2xl font-semibold mb-4">Leírás</h3>
          <p class="text-gray-700 whitespace-pre-wrap">${ad.leiras}</p>
        </div>

        ${galleryHtml}

        <div class="border-t border-gray-200 pt-6">
          <h3 class="text-2xl font-semibold mb-4">Kapcsolat</h3>
          <ul class="space-y-2">
            ${ad.telefon ? `<li><strong>Telefon:</strong> <a href="tel:${ad.telefon}" class="text-violet-600 hover:underline">${ad.telefon}</a></li>` : ''}
            ${ad.weboldal ? `<li><strong>Weboldal:</strong> <a href="${ad.weboldal}" target="_blank" rel="noopener" class="text-violet-600 hover:underline">${ad.weboldal}</a></li>` : ''}
            </ul>
        </div>
      </div>
    `;
    
  } catch (err) {
    detailPage.innerHTML = `<p class="text-center text-lg p-10 text-red-600">Hiba: ${err.message}</p>`;
  }
}

// *** ÚJ FUNKCIÓ: Oldalváltó (Router) ***
function handleRouting() {
  const hash = window.location.hash || '#';
  const mainPage = document.getElementById('main-page');
  const detailPage = document.getElementById('detail-page');

  if (hash.startsWith('#ad/')) {
    // Részletes oldal mutatása
    const adId = hash.substring(4); // Levágjuk a '#ad/' részt
    mainPage.classList.remove('active');
    detailPage.classList.add('active');
    showDetailPage(adId);
  } else {
    // Főoldal (lista) mutatása
    mainPage.classList.add('active');
    detailPage.classList.remove('active');
    loadList(); // Betöltjük a listát, amikor a főoldalra lépünk
  }
}

// Keresés és Törlés eseményfigyelői
document.addEventListener('DOMContentLoaded',()=>{
  // A router és a linkek kezelése
  window.addEventListener('hashchange', handleRouting);
  handleRouting(); // Az oldal betöltésekor is le kell futnia
  
  // A "Vissza a főoldalra" linkek (logó) kezelése
  document.getElementById('home-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#';
  });

  // A főoldali elemek eseményfigyelői (csak ha léteznek)
  if (document.getElementById('searchBtn')) {
    document.getElementById('searchBtn').addEventListener('click', loadList);
    ['q','filterCategory','sortBy'].forEach(id => {
      document.getElementById(id).addEventListener('change', loadList);
    });
  }

  // Törlés gomb eseményfigyelő (delegálással a listára)
  if (document.getElementById('list')) {
    document.getElementById('list').addEventListener('click', async (e) => {
      // Meg kell keresni a gombot, akkor is ha a szövegre kattintott
      const deleteButton = e.target.closest('.delete-btn');
      if (deleteButton) {
        e.preventDefault(); // Megakadályozzuk, hogy a linkre is kattintson
        e.stopPropagation(); // Megakadályozzuk, hogy a kártya linkje is aktiválódjon
        
        const id = deleteButton.dataset.id; 
        
        if (confirm('Biztosan törölni szeretnéd ezt a hirdetést? Ezt nem lehet visszavonni.')) {
          try {
            const { error } = await supa.from('hirdetesek').delete().eq('id', id);
            if (error) throw error;
            loadList(); // Lista újratöltése
          } catch (err) {
            alert('Hiba a törlés során: ' + err.message);
          }
        }
      }
    });
  }
});

// Gemini AI
document.addEventListener('DOMContentLoaded',()=>{
  if (document.getElementById('aiSuggest')) {
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
  }
});
