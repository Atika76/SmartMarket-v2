/* SmartMarket – AI hirdetés generálás (Gemini) */
window.AI = (function () {
  const C = window.__CONFIG__ || {};

  async function suggest({ title, category } = {}) {
    if (!C.EDGE_FUNCTION_URL) {
      throw new Error("Hiányzik az EDGE_FUNCTION_URL a config.js-ben");
    }

    const res = await fetch(C.EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ⬇️ Pont ezt várja a Supabase Edge Function
      body: JSON.stringify({ title, category })
    });

    const js = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        js?.error?.details?.error?.message ||
        js?.error?.message ||
        JSON.stringify(js);
      throw new Error(msg || "Gemini API hiba");
    }
    return js.text || "";
  }

  return { suggest };
})();

/* Gomb esemény – beírja a leírás mezőbe a generált szöveget */
document.addEventListener('DOMContentLoaded', () => {
  const btn      = document.getElementById('aiSuggest') || document.getElementById('genBtn');
  const titleEl  = document.getElementById('title');
  const catEl    = document.getElementById('category');
  const descEl   = document.getElementById('description');
  const loading  = document.getElementById('aiLoading');

  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();

    const title = (titleEl?.value || "").trim();
    const category = (catEl?.value || "").trim();
    if (!title) { alert("Előbb adj meg egy címet!"); return; }

    if (loading) loading.classList.remove('hidden');
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Gemini generál…";

    try {
      const text = await window.AI.suggest({ title, category });
      if (descEl && text) descEl.value = text;
      if (!text) alert("Nem érkezett válasz a Geminitől.");
    } catch (err) {
      console.error(err);
      alert("Gemini hiba: " + (err?.message || String(err)));
    } finally {
      if (loading) loading.classList.add('hidden');
      btn.disabled = false;
      btn.textContent = old;
    }
  });
});
