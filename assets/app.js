/* Frontend logika: űrlap, keresés, renderelés */
(function () {
  const el = (id) => document.getElementById(id);
  const listEl = el("list");
  const emptyEl = el("emptyState");
  const msgEl = el("adFormMsg");

  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

  function card(ad) {
    return `<div class="bg-white rounded-2xl shadow p-5 border border-gray-100 flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <span class="text-xs px-2 py-1 rounded-full bg-gray-100">${escapeHtml(ad.category||"Egyéb")}</span>
        <span class="text-xs text-gray-400 ml-auto">${new Date(ad.created_at||Date.now()).toLocaleString('hu-HU')}</span>
      </div>
      ${ad.images?.length ? `<img src="${ad.images[0]}" class="w-full h-44 object-cover rounded-xl border">` : ""}
      <h3 class="font-semibold text-lg">${escapeHtml(ad.title)}</h3>
      <p class="text-sm text-gray-600">${escapeHtml(ad.description)}</p>
      <div class="flex items-center gap-3">
        ${ad.price ? `<div class="font-semibold">${Number(ad.price).toLocaleString('hu-HU')} Ft</div>` : ""}
        ${ad.website ? `<a class="text-sm underline" href="${ad.website}" target="_blank">Web</a>` : ""}
        ${ad.phone ? `<a class="text-sm underline" href="tel:${ad.phone}">Hívás</a>` : ""}
      </div>
    </div>`;
  }

  async function refresh() {
    try {
      const text = (el("q").value||"").trim();
      const category = el("filterCategory").value;
      const sortBy = el("sortBy").value;
      let ads = await window.SM.listAds({ text, category });
      if (sortBy === "price_asc") ads.sort((a,b)=>(+a.price||0)-(+b.price||0));
      if (sortBy === "price_desc") ads.sort((a,b)=>(+b.price||0)-(+a.price||0));
      listEl.innerHTML = ads.map(card).join("");
      if (!ads.length) emptyEl.classList.remove("hidden"); else emptyEl.classList.add("hidden");
    } catch (e) {
      listEl.innerHTML = `<p class="text-red-600">Hiba a lista betöltésekor: ${e.message||e}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", refresh);
  ["searchBtn","q","filterCategory","sortBy"].forEach(id=>{
    const n = document.getElementById(id);
    if (!n) return;
    (id==="searchBtn" ? n : n).addEventListener(id==="searchBtn"?"click":"change", refresh);
  });

  // Új hirdetés
  const form = document.getElementById("adForm");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";
    try {
      const title = el("title").value.trim();
      const description = el("description").value.trim();
      const category = el("category").value;
      const price = el("price").value;
      const phone = el("phone").value.trim();
      const website = el("website").value.trim();
      if (!title || !description || !category) throw new Error("Kérlek töltsd ki a kötelező mezőket!");

      // képfeltöltés
      const imagesInput = document.getElementById("images");
      const imageUrls = await window.SM.uploadImages(imagesInput.files);

      const ad = await window.SM.createAd({ title, description, category, price, phone, website, images: imageUrls });
      form.reset();
      msgEl.className = "text-sm mt-2 text-green-600";
      msgEl.textContent = "✅ Hirdetés közzétéve.";
      await refresh();
    } catch (err) {
      msgEl.className = "text-sm mt-2 text-red-600";
      msgEl.textContent = "Hiba: " + (err?.message || err);
    }
  });

  // AI szöveg gomb
  const aiBtn = document.getElementById("aiSuggest");
  if (aiBtn) aiBtn.addEventListener("click", async () => {
    msgEl.textContent = "";
    try {
      const title = el("title").value.trim();
      const category = el("category").value;
      const price = el("price").value;
      const txt = await window.AI.suggest({ title, category, price });
      const descEl = el("description");
      descEl.value = txt;
      descEl.dispatchEvent(new Event("input"));
      msgEl.className = "text-sm mt-2 text-green-600";
      msgEl.textContent = "🤖 AI javaslat beillesztve.";
    } catch (e) {
      msgEl.className = "text-sm mt-2 text-red-600";
      msgEl.textContent = "AI hiba: " + (e?.message || e);
    }
  });
})();