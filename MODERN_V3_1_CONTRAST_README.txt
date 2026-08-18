YoSoyEvents Modern V3.1 — Contrast Fix

Correzione tema chiaro/scuro:
- Countdown "Mancano X giorni" ora usa testo/icona onPrimary (bianco) sul badge blu.
- Badge notifiche e altri badge blu corretti.
- Testi dei principali pulsanti primary/primaryDark uniformati a onPrimary.
- Nessuna modifica a Firebase, dati o logica applicativa.

Avvio:
npm install
npx expo start -c

Dopo il test, update live:
eas update --branch production --message "YoSoyEvents Modern V3.1 contrast fix"
