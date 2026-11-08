# Chillyforum 😎🍿

*Chilly + cineforum: il cineforum del gruppo Chilly.*

Web-app per il gruppo Chilly: aggiungete i film che vedete, votateli da 0 a 5 (con i mezzi voti) o da 0 a 10, lasciate una nota e reagite con le emoji ai voti degli altri.

**Costo: 0 €** — tutto rientra nei piani gratuiti di Cloudflare (Workers, database D1, Access fino a 50 persone) e di TMDB.

---

## Come è fatta

| Parte | Cosa usa |
|---|---|
| Sito (pagine, stile) | HTML + CSS + JavaScript, nessun framework, cartella `public/` |
| Server | Cloudflare Worker, `src/worker.js` (risponde solo a `/api/*`) |
| Database | Cloudflare D1 (SQLite), schema in `migrations/` |
| Accesso | Cloudflare Access: email → codice → dentro |
| Dati dei film | TMDB (locandine, trama, anno, regia, generi in italiano) |

### Dove cambiare le cose (tutto centralizzato)

| Cosa | File |
|---|---|
| Colori tema chiaro/scuro, font, raggi | `public/css/theme.css` |
| Nome app, generi, emoji reazioni, scala voti, lunghezza note | `public/js/config.js` (usato sia dal sito che dal server) |
| Email admin, dominio Access, lingua TMDB | `wrangler.jsonc` → `vars` |
| Chiave TMDB | segreto Cloudflare (`npx wrangler secret put TMDB_API_KEY`) |

I voti sono salvati come numeri interi 0–10 (3,5★ = 7): le due scale sono lo stesso voto visto in due modi, quindi il pulsante 0–5★ / 0–10 non cambia nessun dato. La scelta della scala e del tema resta salvata sul singolo telefono.

### Pagine

- **Film visti** — griglia con locandine, data “visto il”, voto medio, bollino “Da votare”, ricerca, filtro per genere, ordinamento.
- **Da vedere** — film proposti per le prossime serate: ognuno tocca 🙋 su quelli che vuole vedere, in cima c'è il più richiesto 👑. Quando l'avete visto: “Visto” con la data, e si può votare.
- **Film singolo** — trama e dati, media con distribuzione dei voti, il tuo voto (trascina o tocca le stelle, si salva da solo), nota, voti di tutti con reazioni emoji (si vede chi le ha messe).
- **Aggiungi film** — scegli “Già visto” (con data) o “Da vedere”, scrivi il titolo, tocca il risultato, conferma. I generi arrivano già scelti da TMDB. Se non lo trovi, inserimento a mano con link della locandina.
- **Classifica** — migliori, peggiori, più divisivi, filtrabile per genere.
- **Persone** — il gruppo, gli ultimi voti; gli admin aggiungono/modificano/rimuovono persone.
- **Persona** — tutti i suoi voti confrontati con la media del gruppo.
- **Profilo** — nome, tema chiaro/scuro/automatico, scala voti, esci.

Chi può fare cosa: tutti aggiungono e modificano film; un film lo elimina chi l'ha aggiunto o un admin; solo gli admin gestiscono le persone. Gli admin in `ADMIN_EMAILS` vengono creati da soli al primo accesso.

---

## Provare in locale

Serve [Node.js](https://nodejs.org) 20 o più recente.

```bash
npm install
npm run db:migrate:local     # crea il database locale
npm run db:seed:local        # (facoltativo) dati di prova: 5 amici e 5 film
npm run dev                  # apre http://localhost:8787
```

In locale il login è simulato con l'email in `.dev.vars` (`DEV_USER_EMAIL`). Per provare come un altro utente, nella console del browser:
`localStorage.setItem('chilly.devUser', 'luca@example.com')` e ricarica (`removeItem` per tornare te).

Con `MOCK_TMDB=1` la ricerca usa dati finti (prova “Inter”, “Matrix”). Metti la tua chiave in `TMDB_API_KEY` per quella vera.

---

## Pubblicare su Cloudflare (circa 15 minuti)

### 1. Chiave TMDB (gratis)
1. Crea un account su [themoviedb.org](https://www.themoviedb.org/signup).
2. Impostazioni → **API** → richiedi una chiave “Developer” per uso personale.
3. Copia la **API Key** (o il “Read Access Token”, vanno bene entrambi).

### 2. Database e pubblicazione
```bash
npx wrangler login                      # si apre il browser, accedi a Cloudflare
npx wrangler d1 create chillyforum-db        # copia il "database_id" che stampa
```
Incolla il `database_id` in `wrangler.jsonc` al posto di `INCOLLA-QUI-IL-DATABASE-ID`, poi:
```bash
npm run db:migrate                      # crea le tabelle sul database online
npx wrangler secret put TMDB_API_KEY    # incolla la chiave TMDB
npm run deploy                          # pubblica: ti dà l'indirizzo …workers.dev
```

### 3. Accesso con codice via email (Cloudflare Access)
1. Dashboard Cloudflare → **Zero Trust**. La prima volta scegli un nome del team (es. `chilly`) e il piano **Free**.
2. **Access → Applications → Add an application → Self-hosted**.
   - Domain: l'indirizzo del punto 2 (es. `chillyforum.tuonome.workers.dev`).
   - Login methods: **One-time PIN** (è quello del codice via email).
3. Policy: **Action = Allow**, **Include = Everyone**.
   Chiunque può ricevere un codice, ma l'app fa entrare solo le email presenti nella pagina Persone: così per aggiungere un amico basta farlo dall'app, senza toccare Cloudflare.
   (Se preferisci un doppio filtro, usa **Include = Emails** e aggiungi lì ogni email: dovrai però ricordarti di farlo a ogni nuova persona.)
4. Salva, poi apri l'applicazione appena creata e copia l'**Application Audience (AUD) Tag**.
5. In `wrangler.jsonc` compila:
   - `ACCESS_TEAM_DOMAIN`: `chilly.cloudflareaccess.com` (con il tuo nome team)
   - `ACCESS_AUD`: il tag copiato
6. `npm run deploy` di nuovo. Fatto: apri il sito, metti la tua email, inserisci il codice.

Il server verifica la firma del token di Access a ogni richiesta, quindi senza login non si legge nulla.

### 4. Aggiungere gli amici
Entra, vai su **Persone → Aggiungi**, metti nome ed email. Mandagli il link: inseriranno la loro email e riceveranno il codice. Dal telefono conviene “Aggiungi a schermata Home”.

### Aggiornamenti futuri
Modifichi i file → `npm run deploy`. Se aggiungi una tabella o colonna, crea un nuovo file in `migrations/` (es. `0002_….sql`) e lancia `npm run db:migrate`.

---

Dati dei film forniti da [TMDB](https://www.themoviedb.org). Questo prodotto usa l'API di TMDB ma non è approvato né certificato da TMDB.
