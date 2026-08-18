YoSoyEvents Modern V5 — Internal Screens Polish

Base:
- Modern V4 restyling
- V4.1 notification count/delete fix
- latest web notification delete confirmation

V5 focuses on the internal admin/teacher screens:
- Monitoraggio maestri
- Gestione utenti
- Pagamenti
- Gestione stanze
- Gestione eventi
- Richieste/camere
- Notifiche
- Dettaglio evento / Pack
- Impostazioni / Modifica profilo

Changes are intentionally visual:
- tighter mobile spacing
- more consistent typography
- cleaner radii
- card borders and subtle shadows
- improved hierarchy across internal screens

Firebase/data/business logic intentionally left unchanged.

Test:
npm install
npx expo start -c

After approval:
eas update --branch production --message "YoSoyEvents Modern V5"
