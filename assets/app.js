(async () => {
  // Várunk, míg minden script betölt (biztos ami biztos)
  if (!window.__CONFIG__) { console.error("config.js nem töltődött be"); return; }
  if (!window.supabase) { console.error("Supabase CDN nem töltődött be"); return; }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, EDGE_FUNCTION_URL } = window.__CONFIG__;
  const { createClient } = supabase;
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- Auth UI állapot ---
  document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supa.auth.getSession();
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');

    if (session) {
      loginLink.textContent = session.user.email;
      loginLink.href = '#';
      logoutBtn.classList.remove('hidden');
      logoutBtn.addEventListener('click', async () => {
        await supa.auth.signOut();
        location.reload();
      });
    } else {
      loginLink.textContent = 'Bejelentkezés / Regisztráció';
      loginLink.href = './auth.html';
      logoutBtn.classList.add('hidden');
    }
  });

  // --- Lista betöltése ---
  async function loadList() {
    const listEl = document.getElementById('list');
    const emptyEl = document.getElementById('emptyState');
    listEl.innerHTML = '';

    let q = document.getElementById('q').value.trim();
    let cat = document.getElementById('filterCategory').value;
    let sort = document.getElementById('sortBy').value;

    let query = supa.from('hirdetesek').select('*');

    if (q) query = query.or(`cim.ilike.%${q}%,leiras.ilike.%${q}%`);
    if (cat) query = query.eq('kategoria', cat);

    if (sort === 'price_asc') query = query.order('ar', { ascending: true });
    else if (sort === 'price_desc') query = query.order('ar', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    const { data, error } = await query.limit(60);
    if (error || !data || data.length === 0) {
      emptyEl.classList.remove('hidden');
      emptyEl.textContent = error ? ('Hiba a lista betöltésekor: ' + error.message) : 'Nincs találat.';
      return;
    }
    emptyEl.classList.add('hidden');

    for (const ad of data) {
      const pics = Array.isArray(ad.kepek) ? ad.kepek : [];
      const cover = pics[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop';
      const price = ad.ar ? new Intl.NumberFormat('hu-HU').format(ad.ar) + ' Ft' : '–';

      const card = document.createElement('article');
      card.className = 'rounded-2xl overflow-hidden bg-white shadow border border-gray-100 flex flex-col';
      card.innerHTML = `
        <div class="h-40 w-full bg-gray-100">
          <img src="${cover}" alt="" class="w-full h-full object-cover">
        </div>
        <div class="p-4 flex-1 flex flex-col gap-2">
          <div class="text-xs text-violet-700 font-semibold">${ad.kategoria || '—'}</div>
          <h3 class="font-semibold line-clamp-2">${ad.cim}</h3>
          <p class="text-sm text-gray-600 line-clamp-3">${ad.leiras || ''}</p>
          <div class="mt-auto flex items-center justify-between">
            <div class="font-semibold text-violet-700">${price}</div>
            <a class="text-sm underline" href="${ad.weboldal || '#'}" target="_blank" rel="noopener">${ad.weboldal ? 'Weboldal' : ''}</a>
          </div>
        </div>`;
      listEl.appendChild(card);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchBtn').addEventListener('click', loadList);
    ['q','filterCategory','sortBy'].forEach(id=>{
      document.getElementById(id).addEventListener('change', loadList);
    });
    loadList();
  });

  // --- Képfeltöltés ---
  async function uploadImagesAndGetUrls(files) {
    const urls = [];
    const max = Math.min(files.length, 3);
    for (let i=0; i<max; i++) {
      const f = files[i];
      const key = `ad-${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
      const { data, error } = await supa.storage.from(BUCKET).upload(key, f, { upsert: false });
      if (error) throw error;
      const { data:pub } = supa.storage.from(BUCKET).getPublicUrl(data.path);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }
    return urls;
  }

  // --- Hirdetés mentése ---
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adForm');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const msg = document.getElementById('adFormMsg');
      msg.textContent = 'Mentés...';

      const title = document.getElementById('title').value.trim();
      const desc  = document.getElementById('description').value.trim();
      const cat   = document.getElementById('category').value;
      const price = document.getElementById('price').value ? parseInt(document.getElementById('price').value) : null;
      const phone = document.getElementById('phone').value.trim() || null;
      const web   = document.getElementById('website').value.trim() || null;
      const files = document.getElementById('images').files;

      try{
        let picUrls = [];
        if (files && files.length>0) picUrls = await uploadImagesAndGetUrls(files);

        const { error } = await supa.from('hirdetesek').insert({
          cim: title, leiras: desc, kategoria: cat, ar: price, telefon: phone, weboldal: web, kepek: picUrls
        });
        if (error) throw error;

        msg.className = 'text-sm mt-2 text-green-600';
        msg.textContent = 'Sikeresen mentve!';
        form.reset();
        loadList();
      }catch(err){
        msg.className = 'text-sm mt-2 text-red-600';
        msg.textContent = 'Hiba: ' + err.message;
      }
    });
  });

  // --- Gemini AI – Edge Function hívás (Authorization fejléc KÖTELEZŐ) ---
  document.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('aiSuggest');
    const aiLoading = document.getElementById('aiLoading');
    const titleInput = document.getElementById('title');
    const descInput  = document.getElementById('description');

    aiBtn.addEventListener('click', async ()=>{
      const title = titleInput.value.trim();
      if (!title) { alert('Előbb adj meg egy címet!'); return; }

      aiLoading.classList.remove('hidden');
      aiBtn.disabled = true;

      try {
        const prompt = `Írj rövid, eladható magyar hirdetészöveget ehhez: "${title}". Adj meg kiemelt előnyöket, állapotot, és zárd felhívással. 3-5 mondat.`;

        const res = await fetch(EDGE_FUNCTION_URL, {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            // EZ SZÜKSÉGES -> különben "Missing authorization header"
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ contents: [ { parts: [ { text: prompt } ] } ] })
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error('Gemini proxy hiba: ' + t);
        }
        const data = await res.json();
        // v1beta válasz struktúra
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt) descInput.value = txt;
        else alert('Nem érkezett válasz a Geminitől.');
      } catch (err) {
        console.error(err);
        alert('Hiba történt a Gemini AI hívásakor.');
      } finally {
        aiLoading.classList.add('hidden');
        aiBtn.disabled = false;
      }
    });
  });
})();
