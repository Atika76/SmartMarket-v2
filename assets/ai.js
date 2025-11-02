/* SmartMarket – AI hirdetés generálás */
window.AI = (function () {
  const C = window.__CONFIG__ || {};
  async function suggest({ title, category, price } = {}) {
    if (C.EDGE_FUNCTION_URL) {
      const res = await fetch(C.EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ⬇️ A szerver nálad ezt várja:
        body: JSON.stringify({ title, category })
      });

      const js = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Hibát dobjunk vissza, hogy a hívó fél tudjon reagálni
        const msg =
          js?.error?.details?.error?.message ||
          js?.error?.message ||
          JSON.stringify(js);
        throw new Error(msg || "Gemini API hiba");
      }
      return js.text || ""; // a szerver "text" kulccsal adja vissza
    }

    // Helyi mock – ha nincs Edge Function URL, akkor is adjon valamit
    const base = title || "Termék";
    const parts = [
      `${base} – Megkímélt állapot, azonnal elvihető.`,
      `Kipróbálható átvételkor, személyes átvétel vagy csomagküldés.`,
      price ? `Ár: ${Number(price).toLocaleString("hu-HU")} Ft.` : "",
      category ? `Kategória: ${category}.` : ""
    ].filter(Boolean);
    return parts.join(" ");
  }
  return { suggest };
})();
