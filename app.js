const { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, EDGE_FUNCTION_URL } = window.__CONFIG__;
const { createClient } = supabase;
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = 'atika.76@windowslive.com';
let selectedFiles = [];
const MAX_FILES = 5;

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

// Képfeltöltés (Optimalizálva)
async function uploadImages(files){
  const urls=[];
  const max=Math.min(files.length, MAX_FILES);
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
    const files = selectedFiles; 
    
    try{
      const { data: { user } } = await supa.auth.getUser();
      if (!user) {
        throw new Error('Nem vagy bejelentkezve! Jelentkezz be az auth.html oldalon.');
      }
      
      let urls=[];
      if(files.length > 0) urls=await uploadImages(files);
      
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
      msg.className='text-green-600 text-sm'; msg.textContent='Sikeresen mentve!'; 
      e.target.reset();
      selectedFiles = [];
      renderFilePreviews();
      loadList();
      
      if (window.innerWidth < 768) {
        showMobileView('list');
      }

    }catch(err){ msg.className='text-red-600 text-sm'; msg.textContent='Hiba: '+err.message; }
  });
});

// Lista (ADMIN TÖRLÉSSEL és GALÉRIÁVAL)
async function loadList(){
  const formContainer = document.getElementById('form-container');
  if (window.innerWidth < 768 && formContainer && !formContainer.classList.contains('hidden')) {
    return;
  }

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
    const hasImages = ad.kepek && ad.kepek.length > 0;
    const coverImage = hasImages ? ad.kepek[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
    const imagesData = hasImages ? JSON.stringify(ad.kepek) : '[]';
    
    const imageHtml = `
      <img 
        src="${coverImage}" 
        class="h-40 w-full object-cover ${hasImages ? 'clickable-gallery' : ''}"
        ${hasImages ? `data-images='${imagesData}'` : ''}
      >`;

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

    list.innerHTML+=`<article class="bg-white rounded shadow overflow-hidden flex flex-col">
      ${imageHtml}
      <div class="p-3 flex-1 flex-col">
        <div class="text-xs text-violet-700">${ad.kategoria||''}</div>
        <h3 class="font-semibold">${ad.cim}</h3>
        <p class="text-sm text-gray-600 flex-1">${ad.leiras||''}</p>
        <div class="mt-2 font-bold text-violet-700">${price}</div>
        ${deleteButtonHtml} 
      </div></article>`;
  });
}

// Keresés és Törlés eseményfigyelői
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchBtn').addEventListener('click',loadList);
  ['q','filterCategory','sortBy'].forEach(id=>document.getElementById(id).addEventListener('change',loadList));
  loadList();

  document.getElementById('list').addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete-btn')) {
      e.preventDefault();
      const id = e.target.dataset.id; 
      
      if (confirm('Biztosan törölni szeretnéd ezt a hirdetést? Ezt nem lehet visszavonni.')) {
        try {
          const { error } = await supa.from('hirdetesek').delete().eq('id', id);
          if (error) throw error;
          loadList(); 
        } catch (err) {
          alert('Hiba a törlés során: ' + err.message);
        }
      }
    }
  });
});

// *** JAVÍTVA: Gemini AI (A SzakiPiac kódjához igazítva) ***
document.addEventListener('DOMContentLoaded',()=>{
  const aiBtn=document.getElementById('aiSuggest');
  const aiLoading=document.getElementById('aiLoading');
  const keywordsInput = document.getElementById('aiKeywords'); 
  const titleInput = document.getElementById('title'); // <-- Cél: a cím
  const descInput = document.getElementById('description'); // <-- Cél: a leírás
  
  aiBtn.addEventListener('click',async()=>{
    const keywords = keywordsInput.value.trim(); 
    if(!keywords){alert('Adj meg kulcsszavakat a generáláshoz!');return;} 
    
    aiLoading.classList.remove('hidden');aiBtn.disabled=true;
    try{
      // JAVÍTVA: A 'query'-t küldjük, ahogy a proxy (a SzakiPiac kódja) várja
      const res=await fetch(EDGE_FUNCTION_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_ANON_KEY}`},
        body:JSON.stringify({ query: keywords }) // 'query'-t küldünk
      });
      
      if(!res.ok) {
        const errorBody = await res.json().catch(() => ({ error: 'Ismeretlen válasz' }));
        console.error('Gemini API hiba:', errorBody);
        throw new Error(`Gemini API hiba (${res.status}): ${errorBody.error || 'Ismeretlen hiba'}`);
      }
      
      const data=await res.json();
      
      // JAVÍTVA: A 'title' és 'description' mezőket várjuk
      if (data.title && data.description) {
        titleInput.value = data.title;
        descInput.value = data.description;
      } else {
        console.error('Nincs cím/leírás a Gemini válaszában:', data);
        alert('Nincs válasz a hiba miatt.');
      }
    }catch(err){
      console.error('Hiba az AI generáláskor:', err);
      alert('Hiba: '+err.message);
    }finally{
      aiLoading.classList.add('hidden');aiBtn.disabled=false;
    }
  });
});


// LIGHTBOX GALÉRIA MŰKÖDÉSE
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
  function hideLightbox() {
    lightbox.classList.remove('visible');
  }
  function updateImage() {
    if (currentImages.length > 0) {
      lightboxImage.src = currentImages[currentIndex];
    }
  }
  function updateNavButtons() {
    btnPrev.style.display = (currentIndex > 0) ? 'block' : 'none';
    btnNext.style.display = (currentIndex < currentImages.length - 1) ? 'block' : 'none';
  }
  function showPrev() {
    if (currentIndex > 0) {
      currentIndex--;
      updateImage();
      updateNavButtons();
    }
  }
  function showNext() {
    if (currentIndex < currentImages.length - 1) {
      currentIndex++;
      updateImage();
      updateNavButtons();
    }
  }

  adList.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('clickable-gallery')) {
      const images = JSON.parse(e.target.dataset.images);
      if (images && images.length > 0) {
        showLightbox(images, 0);
      }
    }
  });

  btnClose.addEventListener('click', hideLightbox);
  btnPrev.addEventListener('click', showPrev);
  btnNext.addEventListener('click', showNext);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      hideLightbox();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('visible')) {
      if (e.key === 'Escape') hideLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    }
  });
});

// Mobilnézet váltása (Űrlap/Lista)
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
  } else { // 'list'
    listContainer.classList.remove('hidden');
    formContainer.classList.add('hidden');
    fab.classList.remove('hidden');
    loadList(); 
  }
}

// Eseményfigyelők a mobil gombokhoz
document.addEventListener('DOMContentLoaded', () => {
  const fab = document.getElementById('show-form-fab');
  const cancelBtn = document.getElementById('cancel-form-btn');
  
  if (fab) {
    fab.addEventListener('click', () => showMobileView('form'));
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => showMobileView('list'));
  }

  if (window.innerWidth < 768) {
     showMobileView('list');
  }
});

// Képfeltöltés (egyesével) és Optimalizálás
function renderFilePreviews() {
  const previewContainer = document.getElementById('image-previews');
  if (!previewContainer) return;
  previewContainer.innerHTML = '';
  
  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewContainer.innerHTML += `
        <div class="relative group aspect-square">
          <img src="${e.target.result}" class="w-full h-full object-cover rounded-md border">
          <button type="button" data-index="${index}" 
                  class="remove-file-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Kép törlése">
            &times;
          </button>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFileSelection(event) {
  const newFiles = Array.from(event.target.files);
  const totalFiles = selectedFiles.length + newFiles.length;

  if (totalFiles > MAX_FILES) {
    alert(`Maximum ${MAX_FILES} képet tölthetsz fel.`);
    event.target.value = '';
    return;
  }
  
  const msg = document.getElementById('adFormMsg');
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true
  };
  
  msg.textContent = 'Képek optimalizálása...';
  msg.className = 'text-sm text-violet-600';

  try {
    for (const file of newFiles) {
      const compressedFile = await imageCompression(file, options);
      selectedFiles.push(compressedFile);
    }
    renderFilePreviews();
  } catch (error) {
    console.error('Képtömörítési hiba:', error);
    alert('Hiba a képek optimalizálása során. Próbálja újra.');
  } finally {
    msg.textContent = '';
    event.target.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('images');
  const previewContainer = document.getElementById('image-previews');

  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelection);
  }

  if (previewContainer) {
    previewContainer.addEventListener('click', (e) => {
      const targetButton = e.target.closest('.remove-file-btn');
      if (targetButton) {
        e.preventDefault();
        const index = parseInt(targetButton.dataset.index, 10);
        selectedFiles.splice(index, 1);
        renderFilePreviews();
      }
    });
  }
});
