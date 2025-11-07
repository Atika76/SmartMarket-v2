// Javított app.js — SmartMarket
// Fő változtatások:
// - Robustabb Supabase storage public URL kezelés
// - Gemini hívás: model frissítve "models/gemini-1.5-flash"-re, többféle válaszforma kezelése
// - Hibakezelések részletesebbek, konzolba is írunk
// - Kis finomítások mobil és lista kezeléshez

const { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, EDGE_FUNCTION_URL } = window.__CONFIG__;
const { createClient } = supabase;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// *** Admin email cím ***
const ADMIN_EMAIL = 'atika.76@windowslive.com';

// AUTH állapot
document.addEventListener('DOMContentLoaded', async () => {
  try{
    const { data: { session } } = await supa.auth.getSession();
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');
    if (session) {
      loginLink.textContent = session.user.email;
      loginLink.href = '#';
      logoutBtn.classList.remove('hidden');
      logoutBtn.onclick = async ()=>{ await supa.auth.signOut(); location.reload(); };
    }
  }catch(err){ console.error('Auth init hiba', err); }
});

// Képfeltöltés (max 5)
async function uploadImages(files){
  const urls=[];
  const max=Math.min(files.length, 5);
  for(let i=0;i<max;i++){
    const f=files[i];
    const key=`ad-${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
    const { data, error } = await supa.storage.from(BUCKET).upload(key,f);
    if(error){
      console.error('Storage upload error', error);
      throw error;
    }
    // getPublicUrl visszatérési forma változhat, ezért óvatosan kezeljük
    const pubRes = await supa.storage.from(BUCKET).getPublicUrl(data.path);
    // pubRes lehet: { data: { publicUrl: '...' } } vagy { data: { public_url: '...' } }
    const publicUrl = pubRes?.data?.publicUrl || pubRes?.data?.public_url || '';
    if(!publicUrl) console.warn('Nem kaptunk public URL-t a feltöltés után:', pubRes);
    urls.push(publicUrl);
  }
  return urls;
}

// Mentés (insert) — gondoskodunk róla, hogy user legyen
document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('adForm');
  if(!form) return;
  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const msg=document.getElementById('adFormMsg');
    msg.className='text-gray-700 text-sm'; msg.textContent='Mentés...';
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
      if(files && files.length>0) urls = await uploadImages(files);

      // Ha RLS miatt szükséges lehet select után az insert
      const insertObj = {
        user_id: user.id,
        cim: title,
        leiras: desc,
        kategoria: cat,
        ar: price,
        telefon: phone,
        weboldal: web,
        kepek: urls
      };

      const { data: insertData, error } = await supa.from('hirdetesek').insert(insertObj).select();
      if(error) throw error;

      msg.className='text-green-600 text-sm'; msg.textContent='Sikeresen mentve!';
      e.target.reset();
      loadList();

      if (window.innerWidth < 768) showMobileView('list');

    }catch(err){
      console.error('Mentés hiba', err);
      msg.className='text-red-600 text-sm'; msg.textContent='Hiba: '+(err.message||err);
    }
  });
});

// Lista (ADMIN TÖRLÉSSEL és GALÉRIÁVAL)
async function loadList(){
  const formContainer = document.getElementById('form-container');
  if (window.innerWidth < 768 && formContainer && !formContainer.classList.contains('hidden')) {
    return; // mobilon ha űrlap nyitva, ne töltsük be
  }

  const q=document.getElementById('q')?.value.trim();
  const cat=document.getElementById('filterCategory')?.value;
  const sort=document.getElementById('sortBy')?.value;
  let query=supa.from('hirdetesek').select('*');
  if(q) query = query.or(`cim.ilike.%${q}%,leiras.ilike.%${q}%`);
  if(cat) query = query.eq('kategoria',cat);
  if(sort==='price_asc') query = query.order('ar',{ascending:true});
  else if(sort==='price_desc') query = query.order('ar',{ascending:false});
  else query = query.order('created_at',{ascending:false});

  try{
    const { data: { session } } = await supa.auth.getSession();
    const currentUserId = session?.user?.id;
    const currentUserEmail = session?.user?.email;
    const isAdmin = currentUserEmail === ADMIN_EMAIL;

    const { data, error } = await query.limit(60);
    const list=document.getElementById('list');
    const empty=document.getElementById('emptyState');
    list.innerHTML='';
    if(error){
      console.error('Lekérdezési hiba', error);
      empty.classList.remove('hidden');
      return;
    }
    if(!data || data.length===0){ empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    data.forEach(ad=>{
      const hasImages = Array.isArray(ad.kepek) && ad.kepek.length > 0;
      const coverImage = hasImages ? ad.kepek[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
      const imagesData = hasImages ? JSON.stringify(ad.kepek) : '[]';
      const price = ad.ar?new Intl.NumberFormat('hu-HU').format(ad.ar)+' Ft':'–';

      let deleteButtonHtml = '';
      const isOwner = currentUserId && ad.user_id === currentUserId;
      if (isOwner || isAdmin) {
        deleteButtonHtml = `\n        <button\n          data-id="${ad.id}"\n          class="delete-btn ${isAdmin && !isOwner ? 'bg-yellow-500' : 'bg-red-500'} text-white px-3 py-1 rounded text-xs mt-2 self-start hover:opacity-80">\n          Törlés ${isAdmin && !isOwner ? '(Admin)' : ''}\n        </button>`;
      }

      list.innerHTML+=`<article class="bg-white rounded shadow overflow-hidden flex flex-col">\n      <img src="${coverImage}" class="h-40 w-full object-cover ${hasImages ? 'clickable-gallery' : ''}" ${hasImages ? `data-images='${imagesData}'` : ''}>\n      <div class="p-3 flex-1 flex flex-col">\n        <div class="text-xs text-violet-700">${ad.kategoria||''}</div>\n        <h3 class="font-semibold">${ad.cim}</h3>\n        <p class="text-sm text-gray-600 flex-1">${ad.leiras||''}</p>\n        <div class="mt-2 font-bold text-violet-700">${price}</div>\n        ${deleteButtonHtml} \n      </div></article>`;
    });
  }catch(err){ console.error('loadList hiba', err); }
}

// Keresés és Törlés eseményfigyelői
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchBtn')?.addEventListener('click',loadList);
  ['q','filterCategory','sortBy'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('change',loadList); });
  loadList();

  document.getElementById('list')?.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete-btn')) {
      e.preventDefault();
      const id = e.target.dataset.id;
      if (confirm('Biztosan törölni szeretnéd ezt a hirdetést? Ezt nem lehet visszavonni.')) {
        try {
          const { error } = await supa.from('hirdetesek').delete().eq('id', id);
          if (error) throw error;
          loadList();
        } catch (err) {
          console.error('Törlés hiba', err);
          alert('Hiba a törlés során: ' + (err.message||err));
        }
      }
    }
  });
});

// Gemini AI javaslat — model frissítve és válaszformátumok kezelve
document.addEventListener('DOMContentLoaded',()=>{
  const aiBtn=document.getElementById('aiSuggest');
  const aiLoading=document.getElementById('aiLoading');
  const title=document.getElementById('title');
  const desc=document.getElementById('description');
  if(!aiBtn) return;

  aiBtn.addEventListener('click',async()=>{
    if(!title.value.trim()){alert('Adj meg egy címet!');return;}
    aiLoading.classList.remove('hidden');aiBtn.disabled=true;
    try{
      const prompt=`Írj rövid, eladható magyar hirdetést ehhez: "${title.value.trim()}". Adj meg kiemelt előnyöket, állapotot, és zárd felhívással.`;

      // Küldés az edge function-nek — hozzáadunk explicit modellt (frissítve)
      const body = {
        model: 'models/gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      };

      const res=await fetch(EDGE_FUNCTION_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_ANON_KEY}`},
        body:JSON.stringify(body)
      });

      if(!res.ok){
        const txt = await res.text().catch(()=>null);
        console.error('Gemini edge hiba', res.status, txt);
        throw new Error('Gemini hiba: ' + res.status);
      }

      const data = await res.json().catch(()=>null);
      console.log('Gemini válasz raw:', data);

      // Többféle válaszformátum kezelése
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text
        || data?.output?.[0]?.content?.text
        || data?.candidates?.[0]?.message?.content?.[0]?.text
        || data?.candidates?.[0]?.message?.content?.parts?.[0]?.text;

      if(candidateText){
        desc.value = candidateText.trim();
      } else {
        alert('Nincs válasz a Gemini-től (váratlan formátum). Nézd meg a konzolt.');
      }

    }catch(err){
      console.error('AI javaslat hiba', err);
      alert('Hiba: '+(err.message||err));
    }finally{ aiLoading.classList.add('hidden'); aiBtn.disabled=false; }
  });
});

// Lightbox galéria (ugyanaz mint korábban)
document.addEventListener('DOMContentLoaded', () => {
  const lightboxHtml = `
    <div id="lightbox" class="lightbox-overlay">
      <div class="lightbox-content">
        <span id="lightbox-close" class="lightbox-close">&times;</span>
        <button id="lightbox-prev" class="lightbox-nav lightbox-prev">&lt;</button>
        <img id="lightbox-image" src="" alt="Nagyított kép" class="lightbox-image">
        <button id="lightbox-next" class="lightbox-nav lightbox-next">&gt;</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', lightboxHtml);

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const btnClose = document.getElementById('lightbox-close');
  const btnPrev = document.getElementById('lightbox-prev');
  const btnNext = document.getElementById('lightbox-next');
  const adList = document.getElementById('list');

  let currentImages = [];
  let currentIndex = 0;

  function showLightbox(images, startIndex) {
    currentImages = images;
    currentIndex = startIndex;
    updateImage();
    lightbox.classList.add('visible');
    updateNavButtons();
  }

  function hideLightbox() { lightbox.classList.remove('visible'); }
  function updateImage() { if (currentImages.length > 0) lightboxImage.src = currentImages[currentIndex]; }
  function updateNavButtons() { btnPrev.style.display = (currentIndex > 0) ? 'block' : 'none'; btnNext.style.display = (currentIndex < currentImages.length - 1) ? 'block' : 'none'; }
  function showPrev(){ if(currentIndex>0){ currentIndex--; updateImage(); updateNavButtons(); } }
  function showNext(){ if(currentIndex < currentImages.length-1){ currentIndex++; updateImage(); updateNavButtons(); } }

  adList?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('clickable-gallery')) {
      try{
        const images = JSON.parse(e.target.dataset.images);
        if (images && images.length > 0) showLightbox(images, 0);
      }catch(err){ console.warn('Hibás images adat', e.target.dataset.images); }
    }
  });

  btnClose.addEventListener('click', hideLightbox);
  btnPrev.addEventListener('click', showPrev);
  btnNext.addEventListener('click', showNext);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) hideLightbox(); });
  document.addEventListener('keydown', (e) => { if (lightbox.classList.contains('visible')){ if (e.key==='Escape') hideLightbox(); if (e.key==='ArrowLeft') showPrev(); if (e.key==='ArrowRight') showNext(); } });
});

// Mobilnézet váltása
function showMobileView(viewToShow) {
  const formContainer = document.getElementById('form-container');
  const listContainer = document.getElementById('list-container');
  const fab = document.getElementById('show-form-fab');
  if (!formContainer || !listContainer || !fab) return;
  if (viewToShow === 'form') {
    listContainer.classList.add('hidden');
    formContainer.classList.remove('hidden');
    fab.classList.add('hidden');
    window.scrollTo(0, 0);
  } else {
    listContainer.classList.remove('hidden');
    formContainer.classList.add('hidden');
    fab.classList.remove('hidden');
    loadList();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fab = document.getElementById('show-form-fab');
  const cancelBtn = document.getElementById('cancel-form-btn');
  if (fab) fab.addEventListener('click', () => showMobileView('form'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => showMobileView('list'));
  if (window.innerWidth < 768) showMobileView('list');
});
