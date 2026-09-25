# PHP → MERN migration plan

This document is the full plan for turning the Ceylon Energy Services site
from "static HTML + PHP admin panel + half a Node API" into one complete
**MERN** application:

| Letter | Technology | What it does here |
|---|---|---|
| **M** | MongoDB Atlas (Mongoose) | Every piece of editable content: gallery, awards, documents, contact messages, admin accounts. PDFs live in MongoDB GridFS. |
| **E** | Express 5 | The REST API, authentication, file uploads, and serving the built React app. |
| **R** | React 19 (Vite) | Both the public website and the admin panel, as one single-page app. |
| **N** | Node.js 20.19+ | Runs the server. |

Cloudinary stays as the image CDN (it already holds the 51 project photos).
It is optional: without Cloudinary credentials, images are stored in
MongoDB GridFS instead, so the whole site can run on Atlas alone.

---

## 1. Where the project started

| Part | Technology | Problem |
|---|---|---|
| Public site | `index.html` + `assets/js/main.js` (vanilla JS) | Content was read from JSON files on disk (`assets/data/*.json`, `assets/docs/*.json`) that only the PHP panel could write. |
| Admin panel | 20+ PHP files in `admin/` | Password hash in a PHP file, JSON files as the database, uploads written to the web folder, needed a PHP host *and* a Node host at the same time. |
| Contact form | `contact/vanilla-form.php` (CodeCanyon script) | **Silently broken.** The script rejects every message that lacks a `contact_secret` field, and the site never sent one, so nothing was ever emailed. `main.js` ignored the reply and showed "Thank you" anyway. Messages were lost. |
| Gallery API | `server/` (Express + Mongoose + Cloudinary) | Only covered the gallery, protected by a shared token that the PHP panel sent. |
| Repository | — | `node_modules/` (3,069 files) committed to git; every project photo stored twice (254 MB); PHP backup folders committed; an unused slider library that contains PHP. |

## 2. Where it ends up

```
ceylon-energy-new/
├── package.json            npm workspaces: runs client + server together
├── .env.example            every setting, documented
├── client/                 React (Vite)
│   ├── index.html
│   ├── public/assets/      static images and icon fonts
│   └── src/
│       ├── site/           the public website, one component per section
│       ├── admin/          the admin panel (lazy-loaded, never sent to visitors)
│       ├── lib/            API client, helpers
│       └── styles/         main.css (unchanged design) + admin.css
├── server/                 Express + Mongoose
│   ├── src/
│   │   ├── config/         env, database, Cloudinary
│   │   ├── models/         Admin, Location, Award, Document, Message
│   │   ├── services/       storage (Cloudinary / GridFS), mailer, serializers
│   │   ├── middleware/     auth, uploads, errors, rate limits
│   │   ├── routes/         public + admin routes
│   │   ├── app.js          the Express app (importable by tests)
│   │   └── server.js       connects to Atlas, listens, shuts down cleanly
│   ├── scripts/            seed, create-admin, check-connection
│   ├── seed-data/          the old site's content, imported once by `npm run seed`
│   └── test/               integration tests against a real MongoDB
└── docs/                   this plan + deployment guide
```

One process serves everything in production: `npm run build` compiles
React into `client/dist`, and Express serves it next to `/api`. That means
one host, one domain, one SSL certificate, and no CORS to configure.

---

## 3. Feature mapping — every PHP file and where it went

| Old file(s) | What it did | Replacement |
|---|---|---|
| `admin/setup.php` | First-run "create a password" | `/admin/setup` page + `POST /api/auth/setup` (only while no admin exists, and only with `ADMIN_SETUP_TOKEN`), or `npm run create-admin` on the server |
| `admin/login.php`, `logout.php`, `inc/auth.php`, `data/auth.php` | Session login, 6-attempt lockout | `POST /api/auth/login` / `logout`, JWT in an httpOnly cookie, per-account lockout (6 attempts → 5 minutes, same as before) plus a per-IP rate limit |
| `admin/change-password.php` | Change the single shared password | Settings page → `POST /api/auth/change-password`; logs out every other session |
| *(none)* | — | **New:** multiple named admin accounts (Settings → Admin users) |
| `admin/projects.php`, `project-actions.php`, `inc/projects.php`, `inc/api.php`, `inc/gallery.php`, `add-location.php`, `add-project.php`, `add-project-photos.php`, `delete-location.php`, `delete-project.php`, `delete-photo.php` | Gallery management through the Node API | Admin → Projects page + `/api/admin/gallery/*`. **New:** rename, hide/show, reorder, captions, multi-photo upload with a progress bar |
| `admin/awards.php`, `award-actions.php`, `inc/awards.php` | Awards (JSON file + images on disk) | Admin → Awards page + `/api/admin/awards`, `Award` model, images in Cloudinary/GridFS. **New:** edit, hide/show, reorder |
| `admin/attachments.php`, `upload.php`, `add-attachment.php`, `delete.php`, `inc/profile.php`, `inc/attachments.php`, `admin.js` | Company profile PDF + page images, extra documents, pdf.js page generation in the browser, 5 backups | Admin → Documents page + `/api/admin/documents`, `Document` model. PDFs in GridFS (no 10 MB Cloudinary limit), page images generated in the browser with pdf.js exactly as before. Replacing the profile archives the old version (last 5 kept) — **new:** one-click restore |
| `admin/check-env.php` | Explain `.env` problems | `GET /api/health`, the dashboard's system-status panel, and `npm run check` |
| `admin/inc/config.php`, `inc/nav.php`, `index.php`, `admin.css` | Shared layout | React admin layout (same look, same CSS variables) |
| `contact/vanilla-form.php` + `contact/inc/*` | Contact email (broken, see §1) | `POST /api/contact`: validated, rate-limited, spam honeypot, **saved to MongoDB first**, then emailed with Nodemailer over SMTP. New Admin → Messages inbox, so no enquiry is lost even when email fails |
| `index.html` | Page markup | `client/src/site/sections/*.jsx`, same markup and CSS classes |
| `assets/js/main.js` | Nav, cursor, Three.js hero, GSAP reveals, gallery, awards, page viewer, contact | React components + hooks (`useReveal`, `useScrollSpy`), Three.js and GSAP from npm instead of CDNs |
| `assets/data/projects.json`, `assets/data/awards.json`, `assets/docs/attachments.json`, `assets/docs/profile-meta.json`, `assets/docs/gallery.json` | JSON files as a database | MongoDB collections |
| `serve.sh`, `local-php.ini` | PHP dev server | `npm run dev` |
| `DEPLOY-CPANEL.md` | Two-program deployment | `docs/DEPLOYMENT.md` — one program |

---

## 4. Data model (MongoDB)

All file references share one embedded **asset** shape, so any file can
live in either Cloudinary or GridFS:

```js
asset = {
  provider: 'cloudinary' | 'gridfs',   // missing on old records = 'cloudinary'
  publicId: String,     // Cloudinary id  (provider = cloudinary)
  fileId:   ObjectId,   // GridFS file id (provider = gridfs)
  url:      String,     // canonical delivery URL
  width, height, format, bytes, mimeType, originalName
}
```

| Collection | Fields |
|---|---|
| `admins` | `email` (unique), `name`, `passwordHash` (bcrypt, cost 12), `tokenVersion` (bumped to log out every session), `failedLoginCount`, `lockUntil`, `lastLoginAt` |
| `locations` | `slug` (unique), `name`, `order`, `published`, `projects[]` → `{ slug, name, description, order, published, photos[] → { ...asset, caption, order } }`. **Same collection and shape the existing gallery API already wrote**, so data already in Atlas keeps working |
| `awards` | `title`, `year`, `image` (asset), `order`, `published` |
| `documents` | `title`, `kind` (`profile` \| `attachment` \| `archived`), `pdf` (asset, always GridFS), `pages[]` (assets), `originalName`, `published`, `order`, `archivedAt`, `seedKey` |
| `messages` | `name`, `email`, `phone`, `subject`, `message`, `status` (`new` \| `read` \| `archived`), `email delivery` result, `ip`, `userAgent` |
| `uploads.files` / `uploads.chunks` | GridFS bucket for PDFs (and images when Cloudinary is not configured) |

Why PDFs go to GridFS: the company profile is 26 MB, and Cloudinary's free
plan refuses raw files over 10 MB. GridFS has no per-file limit and the
Atlas free tier (512 MB) holds it comfortably.

---

## 5. API

Every response is JSON: `{ ok: true, ... }` or `{ ok: false, error: "readable sentence" }`.

### Public

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server, MongoDB, storage and mail status |
| GET | `/api/projects` | Published gallery tree (same shape as before) |
| GET | `/api/projects/:locationSlug` | One location |
| GET | `/api/awards` | Published awards |
| GET | `/api/documents` | Company profile + additional documents |
| GET | `/api/files/:id` | Stream a GridFS file (supports `Range`, long cache) |
| POST | `/api/contact` | Contact form |

### Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/setup-status` | Does the site still need its first admin? |
| POST | `/api/auth/setup` | Create the first admin (needs `ADMIN_SETUP_TOKEN`) |
| POST | `/api/auth/login` | Log in, sets the session cookie |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Who is logged in |
| POST | `/api/auth/change-password` | Change own password |

### Admin (logged in; every write also needs the `X-Requested-With` header the admin app sends)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard counts + system status |
| GET | `/api/admin/gallery` | Full gallery including hidden items |
| POST | `/api/admin/gallery/locations` | Add a location |
| PATCH / DELETE | `/api/admin/gallery/locations/:locId` | Rename, hide/show / remove |
| PUT | `/api/admin/gallery/locations/order` | Reorder locations |
| POST | `/api/admin/gallery/locations/:locId/projects` | Add a project |
| PATCH / DELETE | `/api/admin/gallery/locations/:locId/projects/:projId` | Rename, describe, hide/show / remove |
| PUT | `/api/admin/gallery/locations/:locId/projects/order` | Reorder projects |
| POST | `/api/admin/gallery/locations/:locId/projects/:projId/photos` | Upload up to 20 photos |
| PATCH / DELETE | `.../photos/:photoId` | Caption / remove |
| PUT | `.../photos/order` | Reorder photos |
| GET / POST | `/api/admin/awards` | List / add |
| PATCH / DELETE | `/api/admin/awards/:id` | Edit (optionally new image) / remove |
| PUT | `/api/admin/awards/order` | Reorder |
| GET | `/api/admin/documents` | Profile, attachments, archived versions |
| PUT | `/api/admin/documents/profile` | Replace the company profile (old one archived) |
| POST | `/api/admin/documents` | Add a document |
| PATCH / DELETE | `/api/admin/documents/:id` | Rename, hide/show / remove |
| POST | `/api/admin/documents/:id/restore` | Make an archived version the live profile again |
| GET | `/api/admin/messages` | Inbox (filter by status, paginated) |
| PATCH / DELETE | `/api/admin/messages/:id` | Mark read/archived / remove |
| GET / POST | `/api/admin/users` | List / add admin accounts |
| DELETE | `/api/admin/users/:id` | Remove an admin (never yourself, never the last one) |

---

## 6. Security

| Risk | Control |
|---|---|
| Password theft | bcrypt (cost 12); minimum 8 characters (the PHP version allowed 4) |
| Session theft | JWT in an **httpOnly** cookie (JavaScript cannot read it), `Secure` in production, `SameSite=Lax`, 12-hour lifetime; changing a password invalidates every other session |
| Guessing passwords | 6 wrong passwords lock the account for 5 minutes; per-IP limit of 20 login attempts per 15 minutes |
| Cross-site request forgery | `SameSite` cookie **and** a required `X-Requested-With` header on every admin write (a foreign site cannot add custom headers without passing CORS) |
| Claiming a fresh install | Web setup only works while no admin exists **and** with the secret `ADMIN_SETUP_TOKEN` |
| Malicious uploads | File type checked by the file's actual bytes (like PHP's `finfo`), not its name; size and count limits; uploads never touch a public folder |
| XSS | React escapes all content; strict Content-Security-Policy via Helmet |
| Contact spam | Honeypot field, per-IP rate limit (5 per 15 minutes), length limits |
| Leaked secrets | All secrets only in `.env` / host environment; the server refuses to start with a placeholder or short `JWT_SECRET` in production |

---

## 7. Migration of existing content (`npm run seed`)

The seed is safe to run more than once — anything already imported is
skipped.

1. **Gallery** — reads `server/seed-data/projects.json` (the 7 locations,
   16 projects and 51 photos already uploaded to Cloudinary) and records
   them in Atlas **without re-uploading anything**. If the same records
   already exist in Atlas (from the old gallery API), they are left alone.
   `npm run seed -- --gallery-from-files` instead uploads the original
   photos from `server/seed-data/completed-projects/` through the current
   storage driver — use it if the Cloudinary copies are gone.
2. **Company profile** — uploads the 26 MB PDF to GridFS and its 23 page
   images to Cloudinary (or GridFS).
3. **Awards / extra documents** — the old JSON files were empty (`[]`), so
   there is nothing to import; add them from the admin panel.

Then `npm run create-admin` creates the first login.

---

## 8. What gets deleted, and why it is safe

Everything below stays in git history and can be restored with
`git checkout <commit> -- <path>`.

| Removed | Reason |
|---|---|
| `node_modules/` from git | Installed by `npm install`; should never be committed |
| All `*.php`, `admin/`, `contact/`, `serve.sh`, `local-php.ini` | Replaced (§3) |
| `admin/completed-projects/` | Byte-for-byte duplicate of the photos (127 MB) |
| `assets/images/completed-projects/` | Moved to `server/seed-data/completed-projects/` (fallback seed source) |
| `admin/storage/backups/`, `storage/backups/` | PHP-era backups of old profile versions and deleted photos (102 MB); versioning now lives in the database |
| `assets/images/company-profile/`, `assets/docs/Ceylon-Energy-Company-Profile.pdf` | Moved to `server/seed-data/company-profile/`; now served from the database |
| `assets/revolution/` | Unused third-party slider that ships its own PHP |
| Unused images: other slider photos, `package-1..3.png`, `what-we-do/*.svg`, `contact/*.svg`, `ceylon-logo.jpg`, `marker@2x.png`, `blank.gif`, `digitecz-footer.svg` | Not used by the page. Images the site does use moved to `client/public/assets/images/` |
| `assets/images/awards/award 01.jpg`, `award 2.jpg` | Never registered in the old awards list (it was empty). Restore with `git checkout b8a8700 -- "assets/images/awards"` and add them in Admin → Awards if wanted |
| `assets/js/{jquery,bootstrap,plugins,scripts,jquery.fancybox}.*`, `assets/css/{bootstrap,plugins,jquery.fancybox,alt-font}.css`, `assets/css/color/`, `style.css` | Not loaded by the page |
| `.DS_Store` files | macOS clutter |

---

## 9. Implementation order

1. Repository hygiene: workspaces, `.gitignore`, untrack `node_modules`.
2. Server: config → models → storage → auth → routes → security → static hosting.
3. Server integration tests against a real MongoDB.
4. React public site: port each section, then connect gallery, awards,
   documents and contact to the API.
5. React admin panel: login/setup → dashboard → projects → awards →
   documents → messages → settings.
6. Seed and admin scripts; move legacy content; delete PHP.
7. End-to-end check in a real browser (public site + every admin flow).
8. README and deployment guide.

## 10. Going live checklist

1. `npm install`
2. Copy `.env.example` to `.env`; fill in `MONGODB_URI`, `JWT_SECRET`,
   Cloudinary (optional) and SMTP (optional).
3. Atlas → Network Access → allow the server's IP.
4. `npm run check` — confirms MongoDB, Cloudinary and SMTP.
5. `npm run seed` — imports the gallery and company profile.
6. `npm run create-admin` — creates your login.
7. `npm run build && npm start` — or follow `docs/DEPLOYMENT.md`.
8. Log in at `/admin`, send yourself a test message through the contact
   form, and check it arrives by email and in Admin → Messages.

---

## 11. Notes from the implementation

Things the build and testing turned up, for whoever maintains this next:

- **The old contact form never delivered mail** (see §1). The new one was
  tested end to end: saved to MongoDB, emailed, and listed in the inbox.
- **pdf.js 6** uses JavaScript features only the newest browsers have
  (`Map#getOrInsertComputed`), so the admin loads its *legacy* build,
  which works in any current browser. Its `destroy()` also moved from the
  document to the loading task.
- **Three.js r183+** deprecates `THREE.Clock`; the hero uses
  `performance.now()` instead, and imports only the Three.js classes it
  needs (about 30% smaller).
- **Vite is a regular dependency**, not a dev-dependency: cPanel's
  "Production" mode (and any host with `NODE_ENV=production`) skips
  dev-dependencies during `npm install`, which would make `npm run build`
  fail on the server.
- **The site and admin panel are separate bundles with separate
  stylesheets.** Both style plain elements and share class names such as
  `.btn`, so links between them are full page loads, never client-side
  navigation.
- **Mongoose 9** no longer passes `next` to pre-hooks; the models avoid
  middleware entirely.

### How it was verified

- 37 server integration tests against a real MongoDB 7 (auth, lockout,
  sessions, CSRF guard, gallery, awards, documents incl. archive/restore
  and byte ranges, contact + inbox, rate limits), plus spot checks that
  the tests fail when the behaviour is broken.
- Browser tests (Playwright/Chromium) of every public section and every
  admin flow, including replacing the real 26 MB, 23-page company
  profile (pages rendered in the browser in under 4 seconds).
- Side-by-side screenshots of the old and new home page.
- A clean production install (`NODE_ENV=production npm ci && npm run build && npm start`)
  with its security headers and cookies checked.
- `npm run seed` run twice against a fresh database (second run imports
  nothing), in both Cloudinary-reference and from-files modes.
