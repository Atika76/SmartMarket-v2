<script>
window.AI = (function () {
  const C = window.__CONFIG__;

  async function suggest({ title, category, price }) {
    // Ha van Edge Function URL, azt hívjuk
    if (C && C.EDGE_FUNCTION_URL) {
      try {
        const res = await fetch(C.EDGE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Nem kötelező, de nem árt:
            ...(C.SUPABASE_ANON_KEY ? { Authorization: `Bearer ${C.SUPABASE_ANON_KEY}` } : {})
          },
          // Egyszerű szerződés: title + category (a proxy készíti a promptot)
          body: JSON.stringify({ title, category })
        });

        const js = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(js?.error || "Gemini hívás nem sikerült");

        return (js.text || js?.raw?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      } catch (err) {
        console.error("AI suggest hiba:", err);
        // Ha bármi gond van, essen vissza a lokális sablonra
      }
    }

    // Helyi (offline) fallback – mindig ad szöveget
    const base = title || "Termék";
    const parts = [
      `${base} – megkímélt állapot, azonnal elvihető.`,
      `Kipróbálható átvételkor, személyes átvétel vagy csomagküldés.`,
      price ? `Ár: ${Number(price).toLocaleString("hu-HU")} Ft.` : "",
      category ? `Kategória: ${category}.` : ""
    ].filter(Boolean);
    return parts.join(" ");
  }

  return { suggest };
})();
</script>
