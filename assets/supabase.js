/* Supabase helper réteg: auth státusz, DB CRUD, Storage upload */
window.SM = (function () {
  const C = window.__CONFIG__;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  async function getUser() {
    const { data } = await sb.auth.getUser();
    return data.user || null;
  }

  async function ensureLoggedIn() {
    const user = await getUser();
    if (!user) throw new Error("Jelentkezz be az 'auth.html' oldalon.");
    return user;
  }

  async function uploadImages(files, prefix = "ad") {
    const urls = [];
    const limited = Array.from(files || []).slice(0, 3);
    for (const f of limited) {
      const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
      const { error } = await sb.storage.from(C.BUCKET).upload(name, f, { upsert: false });
      if (error) throw error;
      const { data } = sb.storage.from(C.BUCKET).getPublicUrl(name);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function createAd(input) {
    const user = await ensureLoggedIn();
    const payload = {
      user_id: user.id,
      title: input.title,
      description: input.description,
      category: input.category,
      price: input.price ? Number(input.price) : null,
      phone: input.phone || null,
      website: input.website || null,
      images: input.images || [],
    };
    const { data, error } = await sb.from("hirdetesek").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  async function listAds(query) {
    let q = sb.from("hirdetesek").select("*").order("created_at", { ascending: false }).limit(60);
    if (query?.category) q = q.eq("category", query.category);
    if (query?.text) q = q.ilike("title", f"%{query.text}%");
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  return { sb, getUser, ensureLoggedIn, uploadImages, createAd, listAds };
})();
