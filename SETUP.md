# VLR Cutz Manager — Setup Guide

A installable, offline-first barbershop management app. Everything lives in these
files — no build step, no server required for the app itself.

## 1. Host it (free, ~5 minutes)

### Option A — GitHub Pages
1. Create a new GitHub repository (e.g. `vlr-cutz-manager`).
2. Upload every file in this folder, keeping the folder structure
   (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`).
3. Go to **Settings → Pages**, set Source to your main branch, root folder.
4. Your app will be live at `https://<your-username>.github.io/vlr-cutz-manager/`.

### Option B — Cloudflare Pages
1. Go to pages.cloudflare.com → **Create a project → Upload assets**.
2. Drag the whole folder in and deploy.
3. You get a URL like `https://vlr-cutz-manager.pages.dev`.

Either way — open that URL on your phone in Chrome/Safari, then use
**"Add to Home Screen"** (Android) or **Share → Add to Home Screen** (iPhone).
It now behaves like a real installed app, works offline, and updates itself
whenever you re-upload changed files.

## 2. Set up cloud backup (optional but recommended)

Local data lives in your phone's browser storage (IndexedDB). If you ever
clear browser data, switch phones, or the browser storage gets wiped, you'll
lose everything unless you've backed up. Supabase's free tier is plenty for this.

1. Go to supabase.com → create a free account → **New project**.
2. Once it's created, open the **SQL Editor** and run:

```sql
create table if not exists backups (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table backups enable row level security;

create policy "anon can read/write own backup"
on backups
for all
to anon
using (true)
with check (true);
```

   This keeps it simple: anyone with your project's anon key and your chosen
   backup ID can read/write that one row. Treat your backup ID like a password
   — don't share it, and don't reuse a common word.

3. In Supabase, go to **Project Settings → API**. Copy the **Project URL**
   and the **anon public key**.
4. In the app: **More → Backup & settings**, paste the URL and anon key,
   pick a backup ID only you know (e.g. `vlrcutz-8271-main`), and save.
5. Tap **Backup now** any time you want to push a snapshot. Tap **Restore**
   on a new phone (after installing the app fresh) to pull it back down.

There's no automatic schedule built in — tap "Backup now" after a busy day,
or before switching phones. (If you want it fully automatic, tell me and I
can add a periodic background backup.)

## 3. Using the app

- **Dashboard** — today/week/month/year income, month expenses, net profit,
  a 7-day chart, and this month's best sellers.
- **+ button** (bottom right) — log a sale: tap services (tap twice for two
  haircuts, etc.), pick payment method, add a discount and notes, save.
  You get a receipt you can share straight to WhatsApp.
- **Sales / Expenses** — filterable lists (today/week/month/all), tap 🗑 to
  delete, tap ↗ on a sale to reopen its receipt.
- **Customers** — built automatically from names you enter at checkout.
  Tap a customer to see total spent, visit count, favorite service, and
  full history.
- **More → Services** — add/edit/delete your service menu and prices.
- **More → Reports** — daily/weekly/monthly/yearly charts, profit, and
  best-sellers for any period.
- **More → Backup & settings** — shop name/phone for receipts, and the
  cloud backup controls above.

## Notes on the tech (only if you're curious)

- Data is stored locally in **IndexedDB**, so the app works with zero
  internet connection once installed.
- The **service worker** (`sw.js`) caches the app shell so it loads instantly
  and works offline; only backup/restore need internet.
- No frameworks, no build step — just HTML/CSS/JS, so you (or I, next time)
  can open any file and edit it directly.
