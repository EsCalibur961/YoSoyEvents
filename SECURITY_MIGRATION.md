# Migrazione di sicurezza YoSoyEvents

## Perche le regole proposte non sono attive

I client correnti verificano username e password leggendo direttamente
`settings/adminAuth` e `teachers`, poi salvano la sessione in AsyncStorage.
AsyncStorage protegge la navigazione dell'interfaccia, ma non genera una identita
Firebase: per Firestore e Storage ogni richiesta resta anonima. Attivare oggi le
regole in `security/*.rules.proposed` bloccherebbe login, dati, immagini e versioni
gia installate dell'app.

## Sequenza obbligatoria di migrazione

1. Creare un endpoint Callable HTTPS con App Check che valida una sola volta le
   credenziali legacy e restituisce un Firebase custom token.
2. Assegnare custom claims minime: `role`, `username` e, per i maestri,
   `teacherId`. Non inserire dati personali aggiuntivi nei claim.
3. Spostare hash/password fuori dai documenti leggibili dal client. Rimuovere
   `initialPassword` e ogni password in chiaro solo dopo aver verificato tutti gli
   account e predisposto recupero credenziali.
4. Aggiornare app nativa e Web per usare `signInWithCustomToken`, persistenza Auth
   e token verificato nei route guard. AsyncStorage puo conservare solo dati UI,
   mai essere la fonte di autorizzazione.
5. Spostare sul backend le operazioni privilegiate: pagamenti, applicazione cambi
   camera, gestione utenti, notifiche e lettura dei push token.
6. Provare le regole proposte con Firebase Emulator Suite e una matrice Admin,
   Maestro proprietario, Maestro non proprietario e anonimo.
7. Distribuire nell'ordine: Functions, nuova app/Web, verifica adozione, regole.
   Prevedere una versione minima obbligatoria prima di chiudere l'accesso legacy.
8. Solo dopo il rollout eliminare credenziali legacy e ruotare quelle che fossero
   state esposte. Questa fase richiede backup, finestra di manutenzione e piano di
   rollback.

## Vincoli da validare prima del deploy

- I nomi esatti dei campi proprietario in ogni documento storico.
- Le query necessarie e i relativi indici Firestore.
- I percorsi Storage effettivamente gia usati.
- La politica desiderata per la modifica di `roomPayments` da parte dei maestri.
- Compatibilita con tutte le versioni native ancora in uso.

Le regole proposte sono un modello deny-by-default e non sono referenziate da
`firebase.json`; non possono quindi essere distribuite accidentalmente dal deploy
corrente delle Functions.
