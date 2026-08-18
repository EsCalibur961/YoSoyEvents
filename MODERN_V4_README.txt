YoSoyEvents Modern V4

Include:
- Tutti i fix contrasto della V3.1.
- Profilo Admin completamente ridisegnato in vera griglia 2 colonne.
- Rimossi gli emoji web dal menu: solo Ionicons coerenti.
- Badge richieste integrato nella card.
- Logout separato a larghezza piena.
- Profilo più compatto e mobile-first.
- Rifiniture Home, Monitoraggio maestri, Gestione utenti ed Eventi.
- Nessuna modifica intenzionale a Firebase, collezioni o logica dati.

Test:
npm install
npx expo start -c

Pubblicazione live dopo approvazione:
eas update --branch production --message "YoSoyEvents Modern V4"
