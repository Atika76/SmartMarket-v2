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
    const key=`public/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`; 
    const { data, error } = await supa.storage.from(BUCKET).upload(key,f);
    if(error)throw error;
    const { data:pub } = supa.storage.from(BUCKET).getPublicUrl(data.path);
    urls.push(pub.publicUrl);
  }
  return urls;
}

// Mentés (Helymeghatározással)
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
    
    const zip=document.getElementById('zip_code').value.trim()||null;
    const city=document.getElementById('city').value.trim();

    if (!city) {
        msg.className='text-red-600 text-sm'; 
        msg.textContent='Hiba: A Város megadása kötelező!';
        return; 
    }
    
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
        iranyitoszam: zip, 
        varos: city,       
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

// Lista (Profil Linkkel)
async function loadList(){
  const formContainer = document.getElementById('form-container');
  if (window.innerWidth < 768 && formContainer && !formContainer.classList.contains('hidden')) {
    return;
  }

  const q=document.getElementById('q').value.trim();
  const cat=document.getElementById('filterCategory').value;
  const sort=document.getElementById('sortBy').value;
  const cityFilter = document.getElementById('filterCity').value.trim();
  
  let query=supa.from('hirdetesek').select(`
    *,
    profiles ( id, username, avatar_url )
  `);
  
  if(q)query=query.or(`cim.ilike.%${q}%,leiras.ilike.%${q}%`);
  if(cat)query=query.eq('kategoria',cat);
  if(cityFilter) query = query.ilike('varos', `%${cityFilter}%`);
  
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
    
    const sellerName = ad.profiles?.username ? ad.profiles.username.split('@')[0] : 'Névtelen';
    const sellerId = ad.profiles?.id || null;
    
    const sellerHtml = sellerId 
      ? `<a href="#" class="profile-link font-medium text-gray-800 hover:text-violet-600 hover:underline" data-userid="${sellerId}">
          ${sellerName}
         </a>`
      : `<span class="font-medium text-gray-800">${sellerName}</span>`;

    list.innerHTML+=`<article class="bg-white rounded shadow overflow-hidden flex flex-col">
      ${imageHtml}
      <div class="p-3 flex-1 flex-col">
        <div class="text-xs text-violet-700">
          ${ad.kategoria || ''}
          <strong class="float-right">${ad.varos || ''}</strong>
        </div>
        <h3 class="font-semibold">${ad.cim}</h3>
        <p class="text-sm text-gray-600 flex-1">${ad.leiras||''}</p>
        
        <div class="mt-2 text-xs text-gray-500">
          Eladó: ${sellerHtml}
        </div>
        
        <div class="mt-2 font-bold text-violet-700">${price}</div>
        ${deleteButtonHtml} 
      </div></article>`;
  });
}

// Keresés és Törlés eseményfigyelői
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('searchBtn').addEventListener('click',loadList);
  ['filterCategory','sortBy'].forEach(id => {
      if (document.getElementById(id)) {
          document.getElementById(id).addEventListener('change', loadList);
      }
  });
  
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

// Gemini AI (Elrejtve)
document.addEventListener('DOMContentLoaded',()=>{
  const aiBtn=document.getElementById('aiSuggest');
  if (aiBtn) {
    const aiLoading=document.getElementById('aiLoading');
    const keywordsInput = document.getElementById('aiKeywords'); 
    const titleInput = document.getElementById('title'); 
    const descInput = document.getElementById('description'); 
    
    aiBtn.addEventListener('click',async()=>{
      const keywords = keywordsInput.value.trim(); 
      if(!keywords){alert('Adj meg kulcsszavakat a generáláshoz!');return;} 
      
      aiLoading.classList.remove('hidden');aiBtn.disabled=true;
      try{
        const res=await fetch(EDGE_FUNCTION_URL,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${SUPABASE_ANON_KEY}`},
          body:JSON.stringify({ query: keywords }) 
        });
        
        if(!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: 'Ismeretlen válasz' }));
          console.error('Gemini API hiba:', errorBody);
          throw new Error(`Gemini API hiba (${res.status}): ${errorBody.error || 'Ismeretlen hiba'}`);
        }
        
        const data=await res.json();
        
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
  } 
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

// *** PROFIL OLDAL KEZELÉSE ÉS SZERKESZTÉSE ***

let selectedAvatarFile = null;

function showMainPage() {
  document.getElementById('main-content').classList.remove('hidden');
  document.getElementById('profile-page-container').classList.add('hidden');
  document.getElementById('profile-page-container').innerHTML = ''; 
  loadList(); 
}

async function showProfilePage(userId) {
  const mainContent = document.getElementById('main-content');
  const profileContainer = document.getElementById('profile-page-container');

  mainContent.classList.add('hidden');
  profileContainer.classList.remove('hidden');
  profileContainer.innerHTML = '<p class="text-center text-lg p-10">Profil betöltése...</p>';
  window.scrollTo(0, 0); 

  try {
    const { data: { session } } = await supa.auth.getSession();
    const currentUserId = session?.user?.id;
    const isOwnProfile = userId === currentUserId;

    const { data: profile, error: profileError } = await supa
      .from('profiles')
      .select('username, bio, avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;
    
    const { data: ads, error: adsError } = await supa
      .from('hirdetesek')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (adsError) throw adsError;
    
    const username = profile.username ? profile.username.split('@')[0] : 'Névtelen';
    const avatar = profile.avatar_url || 'https://via.placeholder.com/150'; 
    
    let adsHtml = '<h3 class="text-2xl font-semibold mb-4">Eladó hirdetései</h3>';
    if (ads.length === 0) {
      adsHtml += '<p class="text-gray-500">Ennek a felhasználónak még nincsenek aktív hirdetései.</p>';
    } else {
      adsHtml += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
      ads.forEach(ad => {
        const coverImage = (ad.kepek && ad.kepek[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
        const price = ad.ar ? new Intl.NumberFormat('hu-HU').format(ad.ar) + ' Ft' : '–';
        adsHtml += `
          <article class="bg-white rounded shadow overflow-hidden flex flex-col">
            <img src="${coverImage}" class="h-40 w-full object-cover">
            <div class="p-3 flex-1 flex-col">
              <div class="text-xs text-violet-700">
                ${ad.kategoria || ''}
                <strong class="float-right">${ad.varos || ''}</strong>
              </div>
              <h3 class="font-semibold">${ad.cim}</h3>
              <p class="text-sm text-gray-600 flex-1">${ad.leiras.substring(0, 100)}${ad.leiras.length > 100 ? '...' : ''}</p>
              <div class="mt-2 font-bold text-violet-700">${price}</div>
            </div>
          </article>
        `;
      });
      adsHtml += '</div>';
    }

    const editButtonHtml = isOwnProfile 
      ? `<button id="edit-profile-btn" class="bg-violet-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-violet-700">Profil szerkesztése</button>`
      : '';

    profileContainer.innerHTML = `
      <div class="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-5xl mx-auto">
        <button id="back-to-list-btn" class="inline-block text-violet-600 hover:text-violet-800 mb-6">&larr; Vissza a listához</button>
        
        <div class="flex flex-col md:flex-row items-center gap-6 border-b pb-6 mb-6">
          <img src="${avatar}" alt="Profilkép" class="w-32 h-32 rounded-full object-cover border-4 border-violet-100">
          <div class="flex-1 text-center md:text-left">
            <h1 class="text-4xl font-bold">${username}</h1>
            <p class="text-lg text-gray-600 mt-2">${profile.bio || 'Ez a felhasználó még nem adott meg bemutatkozást.'}</p>
          </div>
          ${editButtonHtml}
        </div>
        
        ${adsHtml}
      </div>
    `;
    
  } catch (err) {
    console.error('Hiba a profiloldal betöltésekor:', err);
    profileContainer.innerHTML = `<p class="text-center text-lg p-10 text-red-600">Hiba a profil betöltésekor: ${err.message}</p>`;
  }
}

async function showProfileEditForm() {
  const profileContainer = document.getElementById('profile-page-container');
  profileContainer.innerHTML = '<p class="text-center text-lg p-10">Szerkesztő betöltése...</p>';

  try {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) throw new Error('Nem vagy bejelentkezve.');

    const { data: profile, error } = await supa
      .from('profiles')
      .select('username, bio, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (error) throw error;
    
    const avatar = profile.avatar_url || 'https://via.placeholder.com/150';
    selectedAvatarFile = null; 

    profileContainer.innerHTML = `
      <div class="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Profil szerkesztése</h1>
        
        <form id="profile-edit-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Profilkép</label>
            <div class="mt-2 flex items-center gap-4">
              <img id="avatar-preview" src="${avatar}" class="w-20 h-20 rounded-full object-cover border">
              <label for="avatar-upload" class="cursor-pointer text-sm text-violet-600 bg-violet-50 border border-violet-200 rounded-md p-2 hover:bg-violet-100">
                Új kép feltöltése...
                <input type="file" id="avatar-upload" class="hidden" accept="image/*">
              </label>
            </div>
          </div>

          <div>
            <label for="username-edit" class="block text-sm font-medium text-gray-700">Felhasználónév</label>
            <input type="text" id="username-edit" value="${profile.username || ''}" required class="mt-1 w-full border border-gray-300 rounded-md shadow-sm p-2">
          </div>
          
          <div>
            <label for="bio-edit" class="block text-sm font-medium text-gray-700">Bemutatkozás (Bio)</label>
            <textarea id="bio-edit" rows="4" class="mt-1 w-full border border-gray-300 rounded-md shadow-sm p-2">${profile.bio || ''}</textarea>
          </div>
          
          <div class="flex gap-4 pt-4">
             <button type="submit" id="save-profile-btn" class="w-full bg-violet-600 text-white rounded-md p-2 font-semibold hover:bg-violet-700">Mentés</button>
             <button type="button" id="cancel-edit-btn" class="w-full bg-gray-500 text-white rounded-md p-2 font-semibold hover:bg-gray-600">Mégse</button>
          </div>
          <p id="profile-edit-msg" class="text-center text-sm"></p>
        </form>
      </div>
    `;

    document.getElementById('avatar-upload').addEventListener('change', handleAvatarPreview);
    document.getElementById('profile-edit-form').addEventListener('submit', handleProfileUpdate);

  } catch (err) {
    console.error('Hiba a szerkesztő betöltésekor:', err);
    profileContainer.innerHTML = `<p class="text-center text-lg p-10 text-red-600">Hiba: ${err.message}</p>`;
  }
}

async function handleAvatarPreview(event) {
  const file = event.target.files[0];
  if (!file) return;

  const preview = document.getElementById('avatar-preview');
  
  const options = { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: true };
  try {
    const compressedFile = await imageCompression(file, options);
    selectedAvatarFile = compressedFile; 
    
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(compressedFile);
  } catch (error) {
    console.error('Avatar tömörítési hiba:', error);
    alert('Hiba a kép feldolgozása során.');
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const msg = document.getElementById('profile-edit-msg');
  msg.textContent = 'Mentés...';
  msg.className = 'text-sm text-violet-600';

  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    msg.textContent = 'Hiba: Nem vagy bejelentkezve.';
    return;
  }

  try {
    let avatarUrl = null;
    
    if (selectedAvatarFile) {
      // *** JAVÍTÁS: A 'public/' prefix eltávolítva a mappából ***
      const filePath = `${user.id}/${Date.now()}-${selectedAvatarFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supa.storage
        .from('avatars')
        .upload(filePath, selectedAvatarFile, {
          cacheControl: '3600',
          upsert: true 
        });
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supa.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);
        
      avatarUrl = publicUrlData.publicUrl;
    }

    const updates = {
      username: document.getElementById('username-edit').value.trim(),
      bio: document.getElementById('bio-edit').value.trim(),
      updated_at: new Date()
    };
    
    if (avatarUrl) {
      updates.avatar_url = avatarUrl;
    }

    const { error: updateError } = await supa
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
      
    if (updateError) throw updateError;
    
    msg.textContent = 'Sikeresen mentve!';
    msg.className = 'text-sm text-green-600';

    setTimeout(() => {
      showProfilePage(user.id);
    }, 2000);

  } catch (err) {
    console.error('Profil mentési hiba:', err);
    msg.textContent = `Hiba: ${err.message}`;
    msg.className = 'text-sm text-red-600';
  }
}


// Eseményfigyelő a profil linkekre, "Vissza" és "Szerkesztés" gombokra
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (e) => {
    const profileLink = e.target.closest('.profile-link');
    const backButton = e.target.closest('#back-to-list-btn');
    const editButton = e.target.closest('#edit-profile-btn');
    const cancelEditButton = e.target.closest('#cancel-edit-btn');

    if (profileLink) {
      e.preventDefault();
      const userId = profileLink.dataset.userid;
      if (userId) {
        showProfilePage(userId);
      }
    }

    if (backButton) {
      e.preventDefault();
      showMainPage();
    }
    
    if (editButton) {
      e.preventDefault();
      showProfileEditForm();
    }
    
    if (cancelEditButton) {
      e.preventDefault();
      // Mivel a getUser() aszinkron, itt inkább a session-ből vesszük az ID-t
      supa.auth.getSession().then(({ data: { session } }) => {
        if (session) showProfilePage(session.user.id);
      });
    }
  });
});
