YoSoyEvents Modern V2 — Mobile First

Partenza: Modern V1.

Interventi V2:
- Home più compatta su iPhone/Android.
- Logo superiore ridotto.
- Sezione maestri Home limitata a 3 righe per evitare una dashboard infinita.
- Spaziature mobile ridotte e maggiore spazio di sicurezza sopra la bottom bar.
- Eventi e Stanze più compatti.
- Profilo/Admin predisposto per card più compatte e griglia quando compatibile con gli stili esistenti.
- Bottom bar leggermente più leggibile e touch-friendly.
- Artisti mantiene expo-image e cache memory-disk.
- Nessuna modifica intenzionale a Firebase, collezioni, autenticazione o logica dati.

Test:
npm install
npx expo start -c
poi aprire Web e simulare iPhone Pro Max 440x956.

Per pubblicare live, dopo i test:
eas update --branch production --message "YoSoyEvents Modern V2"
