# SmartMarket v2 – készre beállítva
Ez a csomag **minden szükséges fájlt** tartalmaz a piactérhez.

## Mi van benne?
- Supabase **Auth** (auth.html)
- **Hirdetések** mentése a `hirdetesek` táblába
- **Képfeltöltés** a `hirdetes-kepek` bucketbe
- **AI** szövegjavaslat Edge Function-höz előkészítve (ha van URL)
- **Tailwind** UI
- Előre kitöltött `config.js` a te projekteddel

## Első lépések
1. Nyisd meg a `auth.html`-t és regisztrálj/bejelentkezz.
2. Nyisd meg az `index.html`-t és adj fel hirdetést.

## Supabase SQL – futtasd az SQL Editorban
A repo gyökerében találsz egy `hirdetesek.sql` fájlt. Futtasd le:
- létrejön a `hirdetesek` tábla
- beállítja a jogosultságokat (RLS)

## Storage bucket
Hozd létre a `hirdetes-kepek` bucketet (Public = ON), vagy állítsd át a `config.js`-ben a nevet.

## Edge Function (opcionális)
Állíts be egy Gemini-alapú edge funkciót `POST /generate-ad` végponttal, és add meg az URL-t a `config.js`-ben `EDGE_FUNCTION_URL`-ként.
