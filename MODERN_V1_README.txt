YoSoyEvents Modern V1

Restyling completo dell'interfaccia senza cambiare Firebase, collezioni,
logica di business o dati esistenti.

Interventi:
- Palette dark/light premium e più leggibile.
- Bottom bar flottante moderna.
- Login ridisegnato.
- Home con header Control Room / Live.
- Superfici, bordi e card uniformati.
- Artisti mantiene expo-image e cache stabile.
- Restano tutte le funzioni esistenti, incluso export PDF/Excel.

Avvio:
npm install
npx expo-doctor
npx expo start -c

Update live:
eas update --branch production --message "YoSoyEvents Modern V1"
