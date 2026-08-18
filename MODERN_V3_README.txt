YoSoyEvents Modern V3 — Mobile polish

Partenza: Modern V2.

Interventi V3:
- Profilo Admin corretto in vera griglia 2 colonne.
- Card admin più compatte e mobile-friendly.
- Logout a larghezza piena quando previsto dallo stile esistente.
- Esplora: locandina evento leggermente più compatta.
- Dettaglio evento e pack più compatti.
- Bottom bar rifinita.
- Home mantenuta quasi invariata, con piccoli aggiustamenti di spaziatura.
- Nessuna modifica intenzionale a Firebase, collezioni o logica dati.

Test:
npm install
npx expo start -c

Per pubblicare live dopo i test:
eas update --branch production --message "YoSoyEvents Modern V3"
