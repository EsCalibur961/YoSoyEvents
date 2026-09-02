# Security audit YoSoyEvents

Data audit: 31 agosto 2026. Ambito: Expo iOS/Android, React Native Web,
Expo Router, Firebase/Firestore/Storage/Functions e configurazione Vercel.

## Sintesi

Il controllo ha trovato un rischio critico strutturale: il login legge le
credenziali da Firestore e crea una sessione locale con AsyncStorage, senza una
identita Firebase verificata. I route guard Web riducono l'accesso accidentale
all'interfaccia, ma non sono un confine di autorizzazione. Le regole restrittive
non possono essere attivate senza una migrazione coordinata, perche bloccherebbero
tutte le versioni correnti dell'app.

| ID | Gravita | Area | Vulnerabilita | Impatto | Correzione | Stato |
|---|---|---|---|---|---|---|
| SEC-001 | CRITICAL | Auth | Ruolo/sessione attendibili solo lato client | Escalation Admin modificando lo stato locale | Migrazione Firebase Auth + custom claims documentata | APERTO, migrazione richiesta |
| SEC-002 | CRITICAL | Password/Firestore | Password/hash e credenziali iniziali leggibili dal client; supporto legacy plaintext | Furto credenziali e attacchi offline | Spostamento credenziali su trusted boundary, rimozione graduale documentata | APERTO, migrazione dati richiesta |
| SEC-003 | HIGH | Firestore | Nessuna rules versionata; accesso anonimo ai dati osservato | Lettura/scrittura non autorizzata di PII e dati gestionali | Rules deny-by-default proposte, non collegate al deploy | PREPARATO, non attivo |
| SEC-004 | HIGH | Storage | Nessuna storage rules versionata | Upload/sovrascrittura e abuso storage | Rules proposte con auth, ownership, MIME e limite 5 MiB | PREPARATO, non attivo |
| SEC-005 | HIGH | Pagamenti | Il client Maestro puo aggiornare direttamente `roomPayments` | Alterazione stato/importi | Scrittura Admin/backend nelle rules proposte; migrare a Function | APERTO, business migration |
| SEC-006 | HIGH | Admin operations | Utenti, eventi, artisti, camere e richieste sono amministrati dal client | Escalation se Firestore non valida il ruolo | Custom claim Admin e Functions privilegiate | APERTO, migrazione richiesta |
| SEC-007 | HIGH | Push token | Client legge l'intera collection `pushTokens` e invia push direttamente | Esposizione token, spam, impersonazione destinatari | Trigger filtrato e log ridotti; spostamento completo backend documentato | PARZIALE |
| SEC-008 | MEDIUM | Functions | Il trigger TS inviava a tutti i token e `targetRole=all` era gestito male nel JS | Notifiche a destinatari errati | Query per ruolo/username, caso `all`, limiti input, log minimizzati | RISOLTO nel codice, deploy richiesto |
| SEC-009 | MEDIUM | Abuse | Login, upload e scritture non hanno App Check/rate limiting | Enumerazione, abuso quota e automazione | Piano App Check e rate limit server-side | APERTO, Console richiesta |
| SEC-010 | MEDIUM | Privacy | Query client scaricano intere collection di maestri e notifiche | Sovraesposizione PII | Query/ownership nelle rules proposte; separare profilo pubblico/privato | APERTO, schema compatibile da progettare |
| SEC-011 | MEDIUM | Audit trail | Operazioni economiche/Admin senza audit trail immutabile trusted | Scarsa attribuzione e non ripudio | Proposto log append-only creato da Functions | APERTO |
| SEC-012 | MEDIUM | Dependency | Root: 31 advisory (17 high, 14 moderate); Functions: 11 (1 high, 9 moderate, 1 low) | Rischi runtime/tooling/transitivi | Nessun major upgrade cieco; piano upgrade controllato | APERTO |
| SEC-013 | MEDIUM | URL navigation | URL Instagram provenienti dai dati potevano usare schemi/host arbitrari | Apertura di URI pericolosi/phishing | Allowlist HTTPS `instagram.com` | RISOLTO |
| SEC-014 | LOW | Web headers | Header browser difensivi assenti | Clickjacking, MIME sniffing, leakage referrer | CSP, HSTS, frame deny, nosniff, referrer e permissions policy | RISOLTO nel codice, deploy richiesto |
| SEC-015 | LOW | Search indexing | Aree private indicizzabili | Esposizione di metadati/URL | Meta noindex globale, X-Robots e robots.txt | RISOLTO |
| SEC-016 | LOW | Logging | Risposta completa Expo push nei log client/Functions | Dati tecnici non necessari nei log | Solo status/count | RISOLTO |
| SEC-017 | INFO | Secrets | Nessuna private key/service account/client secret trovata nel tree o history analizzata | Nessuna evidenza di secret reale committato | Pattern sensibili aggiunti a `.gitignore` | VERIFICATO |

## Evidenze principali

- `app/login.tsx` e `app/web/login.tsx` leggono `settings/adminAuth` e
  `teachers`, confrontano password/hash SHA-256 lato client e impostano
  `isLogged`/`loggedUser` in AsyncStorage.
- I layout Web verificano le stesse chiavi locali. Questo previene il rendering
  casuale delle route ma non prova l'identita al backend.
- I documenti Maestro includono `password` e `initialPassword`; il flusso Admin
  prepara inoltre l'invio della password via WhatsApp.
- `services/pushNotifications.ts` registra token con ruolo/username dichiarati
  dal client e legge la collection per inviare direttamente a Expo.
- Non sono presenti rules attive nel repository. Le proposte sono isolate sotto
  `security/` e non referenziate da `firebase.json`.
- Non sono emersi `dangerouslySetInnerHTML`, `eval`, `new Function` o WebView.
- Le Firebase Web API key e i file GoogleService non sono stati classificati come
  service-account secret.

## Dipendenze

- Root: 31 advisory, nessuna critical. `xlsx@0.18.5` ha advisory high senza fix
  npm disponibile; va sostituito con una libreria mantenuta dopo test degli export.
- Expo/Metro/React Native e varie dipendenze transitive richiedono upgrade major
  per eliminare tutti gli advisory. Un aggiornamento forzato non e stato eseguito.
- Functions: `firebase-admin@12` e transitive hanno 11 advisory; la correzione
  completa richiede upgrade major e test Emulator/integrazione.

## Test eseguiti

- `npx expo lint`: PASS, 0 errori e 81 warning preesistenti.
- `npx expo export --platform web`: PASS, 53 route esportate.
- TypeScript Functions dopo `npm ci`: PASS.
- `node --check functions/index.js`: PASS.
- `git diff --check`: PASS.
- Meta noindex/referrer e `robots.txt`: presenti nell'export.
- Scansione statica XSS/injection, URL dinamici, logging e segreti: completata.
- Test browser locale: tentato, ma il browser integrato non ha potuto raggiungere
  il server localhost del workspace. Non viene dichiarato superato.
- Test Rules Emulator: non eseguiti, perche le rules sono una proposta per il
  modello Firebase Auth futuro e non rappresentano l'identita corrente.

## Interventi manuali richiesti

1. Firebase: implementare e distribuire l'autenticazione descritta in
   `SECURITY_MIGRATION.md`, poi testare e attivare rules Firestore/Storage.
2. Firebase Console: abilitare App Check (reCAPTCHA Enterprise Web, Play
   Integrity Android, App Attest/DeviceCheck iOS) prima in monitoraggio, poi
   enforcement dopo verifica metriche.
3. Vercel: distribuire `vercel.json` e verificare gli header sulla URL reale.
4. Expo/EAS: pianificare versione minima obbligatoria prima di chiudere il legacy.
5. Firebase/Expo: distribuire la Function corretta e solo dopo rimuovere l'invio
   push e la lettura token dai client.
6. GitHub: attivare secret scanning, push protection e Dependabot/Renovate.

Questo audit riduce alcuni rischi immediati ma non dimostra sicurezza assoluta.
Il rischio residuo resta alto finche autenticazione e autorizzazione non vengono
spostate su un trusted boundary verificato da Firebase.
