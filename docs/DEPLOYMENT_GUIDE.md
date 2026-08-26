# 🚀 Complete Deployment Guide: Vercel + Supabase

This guide walks you through every step to deploy the Family Tree app from zero to a live URL your family can use. Total time: ~30 minutes.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Part A: Supabase Setup](#part-a-supabase-setup)
   - [A1. Create a Supabase project](#a1-create-a-supabase-project)
   - [A2. Run the database schema](#a2-run-the-database-schema)
   - [A3. Configure email authentication](#a3-configure-email-authentication)
   - [A4. Configure Google OAuth (optional)](#a4-configure-google-oauth-optional)
   - [A5. Get your API keys](#a5-get-your-api-keys)
   - [A6. Configure redirect URLs (after Vercel deploy)](#a6-configure-redirect-urls-after-vercel-deploy)
3. [Part B: Vercel Setup](#part-b-vercel-setup)
   - [B1. Import the GitHub repo](#b1-import-the-github-repo)
   - [B2. Configure environment variables](#b2-configure-environment-variables)
   - [B3. Deploy](#b3-deploy)
   - [B4. Add the Vercel URL to Supabase](#b4-add-the-vercel-url-to-supabase)
4. [Part C: Verify Everything Works](#part-c-verify-everything-works)
5. [Part D: Optional Custom Domain](#part-d-optional-custom-domain)
6. [Troubleshooting](#troubleshooting)

---

## 1. Overview

### Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Your browser  │ ──HTTPS─▶  Vercel (Next.js)│ ──API──▶  Supabase        │
│  (Family member)│◀──HTTPS─│  Frontend + API │◀──API──│  Auth + DB +    │
└─────────────────┘         └─────────────────┘         │  Storage + RT   │
                                                        └─────────────────┘
```

- **Vercel** hosts the Next.js app (frontend + API routes + static assets)
- **Supabase** provides:
  - **Auth** (email/password + Google OAuth)
  - **Postgres database** (persons, family_units, timeline_events, activity_log, chat_messages, family_links)
  - **Storage** (uploaded photos, compressed to WebP)
  - **Realtime** (live updates when family members edit)

### Cost

Both Vercel and Supabase have generous free tiers that comfortably handle a family of 50+ members:

| Service | Free tier limit | Family Tree usage |
|---------|----------------|-------------------|
| Vercel | 100 GB bandwidth/month | ~5-10 GB (with photos) |
| Vercel | 1000 build minutes/month | ~10 minutes per deploy |
| Supabase | 500 MB database | <10 MB |
| Supabase | 1 GB storage | <100 MB (photos compressed) |
| Supabase | 1 GB egress/month | <500 MB |
| Supabase | 50,000 monthly active users | Your family |

---

## Part A: Supabase Setup

### A1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign in with GitHub (or email)
3. Click **New project**
4. Fill in:
   - **Name:** `family-tree` (or anything you like)
   - **Database Password:** click **Generate a password**, then **Save** it somewhere safe (you'll need it for direct DB access later, not for the app)
   - **Region:** choose the closest to your family (e.g., `Mumbai` for India, `Singapore` for Southeast Asia, `US East` for North America)
   - **Pricing Plan:** Free
5. Click **Create new project**
6. Wait ~2 minutes for provisioning to complete

### A2. Run the database schema

1. In your Supabase dashboard, click **SQL Editor** (left sidebar, looks like a `{}` icon)
2. Click **New query**
3. Open the file `supabase/schema.sql` from the GitHub repo — you can view it at:
   ```
   https://github.com/yadhukrishnanav/familytree/blob/main/supabase/schema.sql
   ```
4. Click the **Raw** button (top right of the file viewer) to see the plain SQL
5. **Copy everything** (Ctrl/Cmd+A → Ctrl/Cmd+C)
6. Paste it into the Supabase SQL Editor
7. Click **Run** (bottom right, green play button)
8. Wait for execution to complete — you should see `Success. No rows returned.`

### What the schema creates

The SQL creates 8 tables, all with **Row Level Security (RLS)** enabled:

| Table | Purpose |
|-------|---------|
| `families` | Top-level family groups (name + unique 6-char share code) |
| `family_members` | User ↔ family junction with role (admin/owner/editor) |
| `persons` | Individual people in trees (name, years, photo URL, etc.) |
| `family_units` | Couples + their children (with marriage year) |
| `timeline_events` | Birth/death/marriage auto-events + manual milestones |
| `activity_log` | Audit trail of every change (before/after JSON) |
| `chat_messages` | In-app family chat messages |
| `family_links` | Multi-family federation links |

It also creates:
- **A trigger** that auto-adds the family creator as `admin`
- **A storage bucket** named `photos` (public read, authenticated write)
- **Storage policies** for the photos bucket
- **Realtime publication** for all 8 tables

### Verify the schema worked

1. Click **Table Editor** (left sidebar, looks like a table icon)
2. You should see all 8 tables listed
3. Click on `families` — should be empty
4. Click **Authentication** → **Policies** — you should see policies for all tables

### A3. Configure email authentication

By default, Supabase requires email confirmation for new sign-ups. For a family app, you might want to **disable** this so family members can sign up immediately without checking their email.

1. Click **Authentication** (left sidebar, looks like a shield)
2. Click **Providers** → **Email**
3. Configure:
   - **Enable Email provider:** ✅ On (default)
   - **Confirm email:** ❌ Off (recommended for family use — faster onboarding)
     - If you leave this On, new users must click a confirmation link in their email before they can sign in
   - **Enable signup:** ✅ On (default)
4. Click **Save**

### (Optional) Configure SMTP for custom-branded emails

If you want password-reset emails to come from your own domain (e.g., `noreply@yourfamily.com`) instead of Supabase's default sender, you can configure SMTP:

1. **Authentication** → **Settings** → **SMTP Settings**
2. Toggle **Enable Custom SMTP**
3. Fill in your provider's settings:
   - **Host:** e.g., `smtp.gmail.com`, `smtp.sendgrid.net`, `smtp.mailgun.org`
   - **Port:** 587 (TLS) or 465 (SSL)
   - **Username:** your SMTP username
   - **Password:** your SMTP password (for Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your account password)
   - **Sender email:** `noreply@yourdomain.com`
   - **Sender name:** `Family Tree`
   - **Minimum interval:** 0 (no rate limit for testing)
4. Click **Save**

**Free SMTP options:**
- **Resend** — 3,000 emails/month free, easiest setup
- **SendGrid** — 100 emails/day free
- **Brevo** (formerly Sendinblue) — 300 emails/day free

For a family of 50, you'll send maybe 10 emails a year (password resets). Any of these works.

### A4. Configure Google OAuth (optional but recommended)

Google OAuth lets family members sign in with one click instead of typing a password. **Highly recommended for elderly family members** who may forget passwords.

#### Step 1: Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. **Project name:** `Family Tree Auth`
4. Click **Create**
5. From the left sidebar, open **APIs & Services** → **OAuth consent screen**
6. **User Type:** External (unless you're a Google Workspace user, then Internal)
7. Click **Create**
8. Fill in:
   - **App name:** `Family Tree`
   - **User support email:** your email
   - **App logo:** (optional) upload the `social-preview.png` from the screenshots folder
   - **Application home page:** (leave blank for now — you'll add your Vercel URL after deploy)
   - **Application privacy policy URL:** (optional, leave blank for family use)
   - **Authorized domains:** add your domain (e.g., `vercel.app` for now; add your custom domain later)
   - **Developer contact information:** your email
9. Click **Save and Continue**
10. **Scopes** page → click **Add or Remove Scopes**:
    - Check `userinfo.email` and `userinfo.profile` (should already be there)
    - Click **Save and Continue**
11. **Test users** page → click **Add Users**:
    - Add your email and any family members' emails you want to test with
    - Click **Save and Continue**
12. Review the summary → click **Back to Dashboard**

#### Step 2: Create the OAuth Client ID

1. From the left sidebar, click **Credentials** → **Create Credentials** → **OAuth client ID**
2. **Application type:** Web application
3. **Name:** `Family Tree`
4. **Authorized JavaScript origins:**
   - `http://localhost:3000` (for local dev)
   - `https://your-app.vercel.app` (replace with your Vercel URL after deploy)
5. **Authorized redirect URIs:**
   - `http://localhost:3000`
   - `https://your-app.vercel.app`
   - `https://your-app.vercel.app/auth/callback` (optional — Supabase handles the redirect)
6. Click **Create**
7. **Copy the Client ID and Client Secret** (you'll paste them into Supabase in the next step)

#### Step 3: Wire Google into Supabase

1. Back in your Supabase dashboard, click **Authentication** (left sidebar)
2. Click **Providers** → **Google**
3. Toggle **Enable Google provider** → On
4. Paste:
   - **Client ID:** from step 2 above
   - **Client Secret:** from step 2 above
5. **Authorized Client IDs** (this is the same as Client ID above, used for native Sign in with Google flows — leave it blank for our use case)
6. **Redirect URL:** Supabase shows you this URL (e.g., `https://your-project.supabase.co/auth/v1/callback`)
   - Add this exact URL to your Google Cloud Console **Authorized redirect URIs** list (step 5 in step 2 above)
7. Click **Save**

### A5. Get your API keys

1. In Supabase dashboard, click **Project Settings** (gear icon, bottom left)
2. Click **API**
3. You'll see three important values:
   - **Project URL:** `https://your-project.supabase.co` (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public:** `eyJhbGciOiJIUzI1NiIsInR5...` (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role:** `eyJhbGciOiJIUzI1NiIsInR5...` (NEVER expose this in the frontend — it bypasses RLS)

4. **Copy the Project URL and anon public key** — you'll paste these into Vercel in Part B

> ⚠️ **Security:** The `anon public` key is safe to expose in your frontend (it's only useful with proper RLS policies, which we have). The `service_role` key must **never** appear in your frontend code.

### A6. Configure redirect URLs (after Vercel deploy)

You'll come back to this step after deploying to Vercel in Part B. Leave Supabase open in a tab.

1. In Supabase, click **Authentication** → **URL Configuration**
2. **Site URL:** your Vercel URL (e.g., `https://family-tree.vercel.app`)
3. **Redirect URLs:** add these one by one:
   - `https://family-tree.vercel.app`
   - `https://family-tree.vercel.app/**`
   - `http://localhost:3000` (for local dev)
4. Click **Save**

---

## Part B: Vercel Setup

### B1. Import the GitHub repo

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New...** → **Project**
3. You should see `yadhukrishnanav/familytree` in the list of repos
4. Click **Import** next to it

### B2. Configure environment variables

On the project setup page:

1. **Framework Preset:** should auto-detect as **Next.js**
2. **Root Directory:** leave as `./` (default)
3. **Build Command:** leave as default (`next build`)
4. **Output Directory:** leave as default (`.next`)
5. **Install Command:** leave as default (Vercel will auto-detect `bun` if you have a `bun.lock`, otherwise `npm install`)
6. **Environment Variables:** click the dropdown and add these one by one:

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5...` | Production, Preview, Development |

Replace the values with the actual keys you copied from Supabase A5.

### B3. Deploy

1. Click **Deploy**
2. Wait ~2-5 minutes for the build to complete
3. You'll see a "Congratulations" page with confetti 🎉
4. Your live URL will be `https://family-tree-xxxx.vercel.app` (where `xxxx` is a random string)
5. Click **Visit** to open your live app

### B4. Add the Vercel URL to Supabase

Now that you have your Vercel URL, go back to Supabase:

1. **Authentication** → **URL Configuration**
2. **Site URL:** paste your Vercel URL (e.g., `https://family-tree-xxxx.vercel.app`)
3. **Redirect URLs:** add the Vercel URL + `http://localhost:3000` (for local dev)
4. Click **Save**

Also update Google OAuth (if you set it up):

1. Back to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Click your OAuth client (`Family Tree`)
3. **Authorized JavaScript origins:** add `https://family-tree-xxxx.vercel.app`
4. **Authorized redirect URIs:** add `https://your-project.supabase.co/auth/v1/callback` (already added by Supabase; double-check)
5. Click **Save**

---

## Part C: Verify Everything Works

### C1. Test the signup flow

1. Open your Vercel URL in a private/incognito window
2. Click **Create account**
3. Sign up with a real email + password
4. You should land on the "Create a family" screen

### C2. Test Google OAuth (if configured)

1. Open your Vercel URL in a private window
2. Click **Continue with Google**
3. Sign in with a Google account
4. You should land on the "Create a family" screen

### C3. Test family creation

1. Click **Create a family**
2. Name it anything (e.g., `The Nair Family`)
3. Click **Create**
4. You should see your family's empty tree workspace
5. Note the **share code** in the top right (e.g., `AB12CD`)

### C4. Test the full flow

1. **Add a person** — click **Add Person** → fill the form → **Add**
2. **Verify photo upload** — add a person with a photo, confirm it appears
3. **Test realtime** — open the URL in a second browser window (or send the share code to a family member), make an edit in one window, see it appear in the other within ~1 second
4. **Test chat** — click the chat icon → send a message
5. **Test search** — press Ctrl/Cmd+K → search for a name
6. **Test PWA install** — on Chrome (desktop or Android), you should see an "Install app" button in the toolbar

### C5. Check Supabase is receiving writes

1. Go to Supabase dashboard → **Table Editor** → **persons**
2. You should see the persons you added
3. Check **family_units**, **timeline_events**, **activity_log**, **chat_messages** — all should have rows

### C6. Check storage is receiving photos

1. Go to Supabase → **Storage** (left sidebar)
2. Click the `photos` bucket
3. You should see folders like `{familyId}/person/...webp` and `{familyId}/event/...webp`
4. Click any file to preview it

---

## Part D: Optional Custom Domain

### Free options

| Domain | Cost | How |
|--------|------|-----|
| `yourfamily.vercel.app` | $0 | Already done — comes with Vercel |
| `yourfamily.is-a.dev` | $0 | [is-a.dev](https://www.is-a.dev/) — PR-based, 24-48h approval |
| `yourfamily.js.org` | $0 | [js.org](https://js.org/) — for JS open-source projects |
| `yourfamily.duckdns.org` | $0 | [DuckDNS](https://www.duckdns.org/) — instant signup |

### Cheap real domain

| Registrar | Cost for `.com` | Notes |
|-----------|----------------|-------|
| **Cloudflare** | ~$10/year | Cheapest, no markup, free WHOIS privacy, free CDN |
| **Porkbun** | ~$10/year | Cheap, friendly UI, free WHOIS |
| **Namecheap** | ~$12/year | Popular, sometimes has $5 first-year promos |
| **Google Domains** | N/A | Sold to Squarespace — avoid |

### Pointing your custom domain to Vercel

1. Buy the domain from Cloudflare/Porkbun
2. In Vercel: your project → **Settings** → **Domains** → enter your domain → click **Add**
3. Vercel shows you DNS records to add:
   - **A record:** `@` → `76.76.21.21`
   - **CNAME:** `www` → `cname.vercel-dns.com`
4. Add these records at your registrar's DNS panel
5. Wait 5-60 minutes for DNS propagation
6. Vercel auto-provisions HTTPS via Let's Encrypt

### Update Supabase + Google OAuth with custom domain

1. **Supabase** → Authentication → URL Configuration:
   - Update **Site URL** to `https://yourfamily.com`
   - Add `https://yourfamily.com` to **Redirect URLs**
2. **Google Cloud Console** → Credentials → your OAuth client:
   - Add `https://yourfamily.com` to **Authorized JavaScript origins**
3. Update the Vercel env vars if needed (the Supabase URL/key don't change)

---

## Troubleshooting

### "Invalid API key" or "Auth session missing"

- Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel env vars
- Make sure there are no leading/trailing spaces in the values
- Redeploy after changing env vars (Vercel → Deployments → ⋯ → Redeploy)

### Google OAuth "redirect_uri_mismatch"

- The redirect URL Supabase gives you must exactly match what's in Google Cloud Console
- Compare character-by-character — even a trailing slash matters
- Supabase URL format: `https://your-project.supabase.co/auth/v1/callback`

### "Email not confirmed"

- You left "Confirm email" On in Supabase → Authentication → Providers → Email
- Either turn it Off, or check your email for the confirmation link

### Photos don't upload

- Check Supabase → Storage → `photos` bucket exists
- Check Storage → Policies → there should be 4 policies (read, insert, update, delete)
- Check browser console for CORS errors (shouldn't happen since we use the public URL)

### Realtime doesn't work (changes don't appear live)

- Check Supabase → Database → Replication → `supabase_realtime` publication includes all 8 tables
- Check that your Supabase project is on a version that supports realtime (all current projects are)
- Open browser DevTools → Network → look for WebSocket connections to `your-project.supabase.co/realtime/v1/websocket`

### Build fails on Vercel

- Check the build logs (Vercel → Deployments → click the failed deploy)
- Common causes:
  - Missing env vars (the build doesn't fail, but runtime does)
  - TypeScript errors (run `bun run lint` locally before pushing)
  - Out of memory (rare — only on huge projects)

### App loads but shows "Demo mode"

- This means `NEXT_PUBLIC_SUPABASE_URL` is missing or has a placeholder value
- Check Vercel → Settings → Environment Variables
- Make sure both vars are set for **Production** environment (not just Preview)
- Redeploy after fixing

### Push to GitHub doesn't trigger a Vercel deploy

- Check Vercel → Settings → Git → check that "Production Branch" is `main`
- Make sure your push was to `main` (not a feature branch — those go to Preview)

### Database writes fail with RLS error

- Make sure you ran `supabase/schema.sql` completely
- Check Supabase → Authentication → Policies → all 8 tables should have policies
- The error message in the browser console will tell you which table failed

### Need to wipe and start over

If you want to reset your Supabase data:

1. Supabase → SQL Editor → run:
   ```sql
   -- Drop all tables (CASCADE handles foreign keys)
   DROP TABLE IF EXISTS family_links CASCADE;
   DROP TABLE IF EXISTS chat_messages CASCADE;
   DROP TABLE IF EXISTS activity_log CASCADE;
   DROP TABLE IF EXISTS timeline_events CASCADE;
   DROP TABLE IF EXISTS family_units CASCADE;
   DROP TABLE IF EXISTS persons CASCADE;
   DROP TABLE IF EXISTS family_members CASCADE;
   DROP TABLE IF EXISTS families CASCADE;
   -- Drop functions
   DROP FUNCTION IF EXISTS is_family_member(uuid);
   DROP FUNCTION IF EXISTS handle_new_family_owner();
   DROP FUNCTION IF EXISTS touch_updated_at();
   -- Drop storage bucket
   DELETE FROM storage.buckets WHERE id = 'photos';
   ```
2. Re-run the full `supabase/schema.sql` to recreate everything

### Want to reset just auth (delete all users)

1. Supabase → Authentication → Users
2. Click each user → **Delete**
3. Or via SQL: `DELETE FROM auth.users;`

---

## Quick Reference

### Files you need to edit before deploy

| File | What to edit |
|------|-------------|
| `README.md` | Update the demo URL to your Vercel URL |
| (no other files need editing — env vars handle everything) |

### Environment variables

| Variable | Where to find it | Required? |
|----------|------------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | ✅ Yes |

That's it — just 2 env vars. No server-side secrets needed because the app uses RLS instead of service-role keys.

### URLs to remember

| Service | URL |
|---------|-----|
| Your app | `https://family-tree-xxxx.vercel.app` (or your custom domain) |
| Supabase dashboard | `https://supabase.com/dashboard/project/your-project-id` |
| Supabase API URL | `https://your-project.supabase.co` |
| Google Cloud Console | `https://console.cloud.google.com/` |
| Vercel dashboard | `https://vercel.com/dashboard` |

---

## Final checklist

Before sharing with family:

- [ ] Supabase project created
- [ ] `supabase/schema.sql` executed successfully
- [ ] Email auth configured (confirm email off for easier onboarding)
- [ ] Google OAuth configured (optional but recommended)
- [ ] Vercel project created, env vars set
- [ ] App deployed and accessible at Vercel URL
- [ ] Vercel URL added to Supabase redirect URLs
- [ ] Signed up successfully (test account)
- [ ] Created a family
- [ ] Added a person
- [ ] Uploaded a photo (verified it appears in Supabase Storage)
- [ ] Tested realtime (open in 2 windows, make an edit, see it sync)
- [ ] Tested chat
- [ ] Tested search (Ctrl/Cmd+K)
- [ ] (Optional) Custom domain configured
- [ ] (Optional) PWA install tested on mobile

Once all checked, share your URL + family share code with your family! 🎉
