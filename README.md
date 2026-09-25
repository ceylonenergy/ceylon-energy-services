# Ceylon Energy Services — website & admin panel

The public website for Ceylon Energy & Engineering Services, plus the
admin panel the team uses to manage it. A complete **MERN** application:

| | |
|---|---|
| **MongoDB Atlas** | All content: project gallery, awards, documents, contact messages, admin accounts. PDFs are stored in MongoDB GridFS. |
| **Express 5** | The REST API, login sessions, uploads — and, in production, serving the website itself. |
| **React 19 + Vite** | The website (same design as before) and the admin panel. |
| **Node.js 20.19+** | Runs it all as one program. |

Project photos are served from **Cloudinary** when it is configured (it
already holds the existing 51 photos). Without Cloudinary, images are
stored in MongoDB too, so the site can run on Atlas alone.

> Coming from the old PHP version? [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md)
> explains what changed and where every PHP feature went.

---

## Quick start (your computer)

You need **Node.js 20.19 or newer** (`node -v`) and a **MongoDB Atlas** cluster.

```bash
# 1. Install everything (website + server) in one go
npm install

# 2. Create your settings file, then open .env and fill it in
cp .env.example .env
```

The only required settings are `MONGODB_URI` and `JWT_SECRET` — the
comments in `.env.example` say where to find or how to generate each one.

```bash
# 3. In Atlas -> Network Access, allow your computer's IP address. Then:
npm run check          # confirms MongoDB, Cloudinary and email all answer

# 4. Import the existing gallery and company profile (safe to re-run)
npm run seed

# 5. Create your admin login
npm run create-admin

# 6. Start the website and the API together
npm run dev
```

Open **http://localhost:5173** for the website and
**http://localhost:5173/admin** for the admin panel.

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Website (Vite, with instant reload) + API (restarts on change) |
| `npm run build` | Compiles the website into `client/dist` |
| `npm start` | Runs the production server: API **and** the built website on one port |
| `npm run check` | Tests the connections to MongoDB, Cloudinary and your mail server |
| `npm run seed` | Imports the old site's content (see below) |
| `npm run create-admin` | Adds an admin account |
| `npm run create-admin -- --email you@example.com --reset` | Resets a forgotten password |
| `npm test` | Runs the server test suite (needs a MongoDB — see [Tests](#tests)) |

## Putting it online

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — step-by-step for Render,
cPanel ("Setup Node.js App") and a plain VPS. In short: set the same
variables as your `.env` on the host, then

```bash
npm install && npm run build && npm start
```

---

## Project layout

```
client/                 React app (Vite)
  index.html
  public/assets/        images and icon fonts used by the site
  src/
    site/               the public website — one component per section
    admin/              the admin panel (separate bundle, never sent to visitors)
    lib/                API client
    styles/             main.css (the site's original stylesheet), admin.css
server/                 Express API
  src/
    config/             settings, MongoDB, Cloudinary
    models/             Admin, Location (gallery), Award, Document, Message
    routes/             public routes, auth, admin/*
    services/           file storage (Cloudinary / GridFS), email, serializers
    middleware/         sessions, uploads, rate limits, errors
  scripts/              seed, create-admin, check-connection
  seed-data/            the old site's content, imported by `npm run seed`
  test/                 integration tests
docs/                   migration plan, deployment guide
```

## What the admin panel manages

| Page | What you can do | Where it shows on the site |
|---|---|---|
| **Projects** | Add / rename / hide / reorder locations and projects; upload many photos at once (large photos are shrunk in the browser first); captions; reorder; delete | "Our Projects" |
| **Awards** | Add with a photo, edit, replace the image, hide, reorder, delete | "Awards" |
| **Documents** | Replace the Company Profile (pages are generated from the PDF in your browser), add more documents, restore any of the last 5 profile versions | "Attachments" + page viewer |
| **Messages** | Every contact-form enquiry — read, reply by email, archive, delete | — |
| **Settings** | Change your password; add or remove admin accounts | — |

## Importing the existing content (`npm run seed`)

- **Gallery** — the 7 locations, 16 projects and 51 photos. They are
  already in Cloudinary, so the seed only records them in Atlas; nothing
  is uploaded again. If those Cloudinary copies are ever gone, run
  `npm run seed -- --gallery-from-files` to upload the originals from
  `server/seed-data/completed-projects/` instead.
- **Company profile** — the 26 MB PDF (to GridFS) and its 23 page images.
- Re-running is safe: anything already imported is skipped, and nothing
  created in the admin panel is touched. `--dry` shows the plan without
  changing anything; `--only=gallery` or `--only=profile` limits it.

## Contact form email

Every enquiry is saved in MongoDB first and appears in **Admin →
Messages**, so nothing is lost even if email fails. To also receive it by
email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (your cPanel
mailbox works — see `.env.example`), then run `npm run check`. While
developing, `MAIL_TRANSPORT=console` prints the emails in the terminal
instead of sending them.

## Tests

The server tests run against a real MongoDB, each file in its own
temporary database that is dropped afterwards. Any MongoDB works — the
quickest is Docker:

```bash
docker run -d -p 27017:27017 --name ceylon-test-mongo mongo:7
npm test
```

Or point them at another server (never your live database):
`MONGODB_URI_TEST="mongodb+srv://..." npm test`.

---

## When something is wrong

| What you see | What it usually means |
|---|---|
| `The server cannot start: MONGODB_URI is missing` | No `.env` file, or the line is blank — copy `.env.example` to `.env` |
| `JWT_SECRET is still the example placeholder` | Generate a real one (the command is in `.env.example`) |
| `querySrv ECONNREFUSED _mongodb._tcp…` (or `querySrv ETIMEOUT`) | This computer's DNS server refuses the lookup a `mongodb+srv://` address needs — common on Windows and with some routers. The server now retries through public DNS by itself; if it still fails, see [below](#if-querysrv-still-fails) |
| `MongoDB connection failed` … IP / timed out | Add this machine's IP in Atlas → **Network Access** |
| `MongoDB connection failed` … authentication | Wrong password, or a special character that needs percent-encoding (`@` → `%40`) |
| Gallery says "being updated" | The API returned no locations — run `npm run seed`, check `npm run check` |
| Photos show the grey placeholder | The image URL failed: Cloudinary account or credentials changed. `npm run seed -- --gallery-from-files` re-uploads the originals |
| `Too many failed attempts` | 6 wrong passwords lock that account for 5 minutes |
| Forgot the admin password | `npm run create-admin -- --email you@example.com --reset` on the server |
| Contact form works but no email arrives | Admin → Messages shows why on each message; run `npm run check` |
| Everything answers 403 on macOS with `PORT=5000` | macOS AirPlay Receiver holds port 5000 — keep the default `PORT=5050` |
| `Port 5050 is already in use` | Another copy is running (`lsof -i :5050`), or set a different `PORT` |

### If `querySrv` still fails

Your network blocks DNS lookups to public servers too. Either:

- **Change your PC's DNS** to `1.1.1.1` and `8.8.8.8` (Windows: Settings →
  Network & internet → your connection → DNS server assignment → Edit), or
- **Use the standard connection string**, which needs no special DNS
  lookup. It lists the cluster's three servers directly. Find them with
  (replace the cluster address with yours):

  ```powershell
  nslookup -type=SRV _mongodb._tcp.cluster0.xxxxx.mongodb.net 8.8.8.8
  nslookup -type=TXT cluster0.xxxxx.mongodb.net 8.8.8.8
  ```

  The first gives three `…-shard-00-0N…mongodb.net` servers, the second
  `authSource=admin&replicaSet=atlas-…-shard-0`. Put them together as:

  ```
  MONGODB_URI=mongodb://USER:PASSWORD@SERVER1:27017,SERVER2:27017,SERVER3:27017/?tls=true&authSource=admin&replicaSet=REPLICA_SET&retryWrites=true&w=majority
  ```
