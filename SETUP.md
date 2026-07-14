# Go&Glow Speed Friending App — Setup Guide (v4)

What changed from earlier versions: **no email login.** Guests find their name in a list (loaded from your Ticket Tailor export) and tap it — that's their identity for the night. Their choices save to their phone instantly and sync to the dashboard in the background, even if wifi drops mid-event.

---

## Why this version

- No magic link emails to land in spam — removes the riskiest dependency
- Works on patchy wifi: choices save locally first, then sync automatically when connected
- Faster for guests — no typing an email or waiting for a link
- Still private: guests never see anyone's email, only names + Instagram

---

## Services needed (all free)

| Service  | What it does | Free tier |
|----------|--------------|-----------|
| Supabase | Database + live sync | 500MB, 50k requests/mo |
| Vercel   | Hosting + serverless API | 100GB bandwidth |
| Resend   | Sending match emails | 3,000 emails/mo |

---

## Step 1 — Supabase

1. **supabase.com** → New project → name it "go-glow-speed-friending"
2. Wait ~2 min to provision
3. **SQL Editor → New query** → paste `supabase-setup.sql` → Run
4. **Project Settings → API** → copy:
   - **Project URL**
   - **anon / public** key
   - **service_role** key (keep secret)

---

## Step 2 — Resend

1. **resend.com** → Create account
2. **API Keys** → Create API Key → copy it
3. **Domains** → verify Go&Glow's actual sending domain before the first real event — don't use the test domain (`resend.dev`) live, it's much more likely to land in spam

---

## Step 3 — Deploy to Vercel

1. Push this folder to GitHub
2. **vercel.com** → Add New Project → import the repo
3. Add Environment Variables:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | from Step 1 |
   | `SUPABASE_SERVICE_KEY` | from Step 1 |
   | `RESEND_API_KEY` | from Step 2 |
   | `HOST_PIN` | any 4-digit PIN, e.g. `7291` |

4. Open `public/index.html`, find this near the top of the `<script>`:
   ```js
   const SUPABASE_URL = cfg.url || window.GG_SUPABASE_URL;
   const ANON_KEY     = cfg.key || window.GG_ANON_KEY;
   ```
   Add two lines just above the `<script>` close tag (or directly hardcode the values here) with your real Supabase URL and anon key. The anon key is safe to expose publicly — it's designed to be.
5. Click **Deploy**

---

## Running an event

**Before guests arrive (Emily does this):**
1. Open the app → tap **Host ✨** → enter PIN
2. Export from Ticket Tailor: **Orders → Actions → Export → CSV**
3. Open the CSV, select all, copy
4. Paste into the **Paste CSV** box in the dashboard → tap **Import guest list**
   - The app automatically finds every name + email in the pasted text, no formatting needed
5. The QR code is ready to show guests

**During the event:**
- Guests scan the QR, find their name in the list, tap it
- They tick who they want to stay in touch with
- Every tick saves to their phone immediately — if wifi drops, nothing is lost, it just shows "Saved on your phone — will sync when back online" and quietly retries every few seconds until it gets through

**At the end:**
- Host taps **Find all mutual matches**
- Writes a short personal note
- Taps **Send match emails** — done

---

## How the offline-safety works

Every time a guest ticks a name, their full selection is saved to their phone's local storage instantly — this never depends on a network connection. In the background, the app tries to push that to the shared database every 4 seconds. If it succeeds, the little status pill at the top says "All saved." If it can't reach the server (wifi dropped, signal lost), it says "Saved on your phone — will sync when back online" and keeps trying silently — no error, no lost work, no need for the guest to do anything.

If a guest closes the browser tab and reopens the link later, their progress is exactly where they left it, even if they never successfully synced.

**What this doesn't fix:** if wifi is down for the *entire room* the whole night, the host's dashboard simply won't show any submissions until it comes back — at which point everyone's phone syncs at once. The event itself isn't blocked; only the host's live view is delayed. Worth checking the venue has decent wifi beforehand regardless.

---

## Claimed names

Once someone taps a name in the list, it's tagged as claimed on their device. If someone else tries to tap the same name (e.g. a friend with the same first name picks the wrong one), it shows as greyed out with "already signed in" — this avoids two people accidentally submitting under one identity. If a guest's name is genuinely a duplicate, Emily can add them again from the host dashboard with a distinguishing detail (e.g. "Sarah B").

---

## Resetting between events

```sql
-- Run in Supabase SQL Editor
delete from submissions where event_id = 'OLD_ID';
delete from guests      where event_id = 'OLD_ID';
```
Or simplest: clear `gg_eid_v4` from browser local storage on the host's device — a new event ID generates automatically.
