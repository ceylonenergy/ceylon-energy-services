# Putting the site online

The whole site is **one Node.js program**: it serves the website, the
admin panel and the API from a single address. There is no PHP, no
second server, and no separate `.env` for a PHP panel any more.

Every host follows the same four steps:

1. **Node.js 20.19 or newer** (22 LTS recommended).
2. **Settings** — the variables from [`.env.example`](../.env.example),
   entered in the host's environment-variables screen (or a `.env` file
   in the project root).
3. **Build and start** — `npm install && npm run build`, then `npm start`.
4. **Atlas access** — in MongoDB Atlas → **Network Access**, allow the
   server's outgoing IP address.

Then, once, from the server's terminal (or your own computer pointed at
the same Atlas database): `npm run seed` and `npm run create-admin`.

> **Settings to use in production**
>
> | Name | Value |
> |---|---|
> | `NODE_ENV` | `production` |
> | `MONGODB_URI` | your Atlas connection string |
> | `MONGODB_DB_NAME` | `ceylonenergy` |
> | `JWT_SECRET` | 48+ random characters (see `.env.example`) |
> | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from Cloudinary → Settings → API Keys |
> | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | your mailbox, for contact-form email |
>
> Do **not** set `PORT` on Render or cPanel — they choose it themselves.
> `ADMIN_API_TOKEN` and `GALLERY_API_BASE` from the old setup are no
> longer used; delete them.

---

## Option A — Render (simplest)

1. [render.com](https://render.com) → **New → Web Service** → connect this GitHub repository.
2. Fill in:

   | Field | Value |
   |---|---|
   | Runtime | Node |
   | Build command | `npm install && npm run build` |
   | Start command | `npm start` |
   | Health check path | `/api/health` |

3. **Environment** tab → add the production settings above.
4. Atlas → Network Access → add Render's outbound IP addresses (shown on
   the service's **Connect → Outbound** panel).
5. Deploy. Open `https://<your-service>.onrender.com/api/health` — you
   should see `"mongo":"connected"`.
6. Settings → **Custom Domains** → add `ceylonenergyservices.com` and
   `www.ceylonenergyservices.com`, and update your DNS as Render shows.

The free plan sleeps after ~15 minutes without visitors, so the first
visit after a quiet spell takes up to a minute. A paid instance stays awake.

---

## Option B — cPanel "Setup Node.js App"

This replaces the old PHP site on the same hosting account. The exact
screens differ a little between hosts.

**Before you start:** in File Manager, download a backup of
`public_html` (right-click → Compress → download). The new app does not
need anything in it.

1. **cPanel → Software → Setup Node.js App → Create Application.**

   | Field | Value |
   |---|---|
   | Node.js version | the highest offered — **20.19 or newer** (the app will not start on older versions) |
   | Application mode | Production |
   | Application root | `ceylon-energy` (a folder in your home directory, **not** inside `public_html`) |
   | Application URL | `ceylonenergyservices.com` |
   | Application startup file | `server/src/server.js` |

   Add the production settings under **Environment variables**. Type
   values by hand rather than pasting — a pasted trailing space is the
   usual cause of the "Directory should not contain spaces" error.
   Leave out `PORT` and `NODE_ENV` (the form sets both).
   Click **Create**.

2. **Upload the code** into `~/ceylon-energy`: everything in this
   repository **except** `node_modules` and `.git`. (Or, if your plan has
   Terminal/SSH: `git clone <repo-url> ceylon-energy`.)

3. Back on the app's page: **Run NPM Install**, then under **Run JS
   script** choose **build**. (Or in Terminal, run the "enter the virtual
   environment" command the page shows, then `npm run build`.)

4. **Clear the old site out of the way.** Apache serves any file it finds
   in `public_html` before the Node app sees the request, so the old
   `index.html` and PHP files would hide the new site. Move everything
   out of `public_html` **except** `.htaccess` (cPanel just wrote Node
   settings into it) and `.well-known` (SSL renewals).

5. Atlas → Network Access → add the **Shared IP Address** from cPanel's
   right-hand sidebar.

6. **Restart** the app, then open `https://ceylonenergyservices.com/api/health`.

7. In Terminal (inside the virtual environment): `npm run check`,
   `npm run seed`, `npm run create-admin`.

| What you see | Fix |
|---|---|
| A cPanel/Passenger error page instead of the site | The app crashed at start. Open the **stderr.log** in the application root — missing settings are listed there by name |
| `SyntaxError` or `Unsupported engine` in the log | Node.js version too old — pick 20.19+ in step 1 |
| The old website still appears | Old files are still in `public_html` (step 4) |
| `"mongo":"disconnected"` | Atlas IP allowlist (step 5) or the password in `MONGODB_URI` |
| Uploads fail on large PDFs | Ask the host for a request-body limit of at least 100 MB |

Serving the app from a sub-folder (e.g. `…/nodeapi`) also works — the
server removes the folder prefix automatically — but hosting at the
domain root is simpler.

---

## Option C — Your own server (VPS)

```bash
# Node 22 via nvm, then:
git clone <repo-url> /srv/ceylon-energy && cd /srv/ceylon-energy
cp .env.example .env && nano .env        # NODE_ENV=production, PORT=5050, ...
npm ci && npm run build
npm run check && npm run seed && npm run create-admin

# keep it running and start it on boot
sudo npm i -g pm2
pm2 start npm --name ceylon-energy -- start
pm2 save && pm2 startup
```

Nginx in front (with `certbot --nginx` for HTTPS):

```nginx
server {
    server_name ceylonenergyservices.com www.ceylonenergyservices.com;
    client_max_body_size 100m;   # the company profile upload is ~30 MB; nginx's default is 1 MB

    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
}
```

Updating later: `git pull && npm ci && npm run build && pm2 restart ceylon-energy`.

---

## Option D — Vercel

Vercel does not run `npm start`. It serves the built website from its
CDN and runs the API as a serverless function. The repository already
has the files for this: `vercel.json`, `api/index.js` and
`server/index.js`.

1. [vercel.com](https://vercel.com) → **Add New → Project** → import this repository.
2. **Root Directory: leave it as the repository root (`./`)**, not
   `server` or `client`. `vercel.json` sets the build command, the output
   folder and the framework, and sends `/api/*` to the API. The website
   and the API then share one address, so the admin login cookie works in
   every browser.
3. **Environment Variables**: add the production settings above.
   Leave out `PORT`. Vercel only applies a changed variable to new
   deployments, so **Redeploy** after editing one.
4. Atlas → **Network Access** → **Add IP Address** → **Allow access from
   anywhere** (`0.0.0.0/0`). Vercel has no fixed IP address, so Atlas
   refuses it otherwise. The password in `MONGODB_URI` still protects the
   database.
5. Deploy. Open `https://<your-project>.vercel.app/api/health`. You should
   see `"mongo":"connected"`.
6. Run `npm run seed` and `npm run create-admin` on your own computer,
   with `.env` pointing at the same Atlas database.

**Limits on Vercel.** A request can be at most 4.5 MB. The admin panel
sends photos in batches under that size, so gallery uploads work (a
single PNG over 4.5 MB does not). **Replacing the Company Profile PDF
(~26 MB) and very large award images cannot work on Vercel.** Do those
from the admin panel on your own computer (`npm run dev` with the same
`.env`): it writes to the same Atlas database and Cloudinary, so the live
site shows the change straight away. The login and contact-form rate
limits are counted separately by each running copy of the function.

| What you see | Fix |
|---|---|
| `500 FUNCTION_INVOCATION_FAILED` on every page | The function crashed while loading. **Logs** on the deployment page shows why |
| `"The server is missing required settings"` with a `problems` list | Add those variables (step 3), then Redeploy |
| `503` `"could not connect to the database"` | Atlas Network Access (step 4) or the password in `MONGODB_URI`. The **Logs** show the exact error |
| The site loads but `/admin` or `/api/...` gives 404 | Root Directory is `client` or `server`. Set it back to the repository root |
| `"This upload is larger than the hosting service accepts"` | The 4.5 MB limit above |

A project whose Root Directory is `server` runs the API alone, using
`server/index.js`. The website must then be hosted somewhere else (see
the last section).

---

## After going live

1. `https://<your-domain>/api/health` shows `"ok":true` and `"mongo":"connected"`.
2. The home page gallery, awards and "Attachments" sections show content.
3. Log in at `/admin`; the dashboard's **System status** is all green.
4. Send yourself a message through the contact form. It should appear in
   **Admin → Messages** and, if SMTP is set, in the team inbox.
5. Remove `ADMIN_SETUP_TOKEN` from the settings if you used it.

## Hosting the website and API separately (not recommended)

Possible, but the admin login then depends on third-party cookies,
which Safari blocks. If you must: build the client with
`VITE_API_URL=https://api.example.com`, and on the API set
`ALLOWED_ORIGINS=https://www.example.com`, `COOKIE_SAMESITE=none`,
`COOKIE_SECURE=true`.
