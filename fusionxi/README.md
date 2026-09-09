# FusionXi

A ChatGPT-style app with chat (Claude) and image generation (OpenAI), ready to deploy on Vercel.

## 1. Get your API keys

- **Google Gemini (chat) — free:** aistudio.google.com/apikey → Create API Key. No credit card needed for the free tier.
- **OpenAI (images) — paid:** platform.openai.com → API Keys → Create new secret key. Needs billing enabled.

Keep both keys somewhere safe — you'll paste them into Vercel in step 3, not into any code file.

## 1b. Set up Supabase (login + saved chats)

FusionXi now has sign in / sign up and per-user chat history, powered by [Supabase](https://supabase.com) (free tier).

1. Go to supabase.com → sign up → **New project**. Pick any name/password/region and wait ~2 minutes for it to spin up.
2. In your project, go to **Project Settings → API**. Copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Go to **SQL Editor → New query**, paste the contents of `supabase-schema.sql` (included in this project), and click **Run**. This creates the `chats` and `messages` tables with row-level security, so every user can only ever see their own chats.
4. (Optional, for the "Continue with Google" button) Go to **Authentication → Providers → Google**, enable it, and follow Supabase's instructions to add your Google OAuth client ID/secret. If you skip this, email/password sign in and sign up still work fine — the Google button just won't work until this is set up.
5. Go to **Authentication → URL Configuration** and set your **Site URL** (e.g. `https://fusionxi-yourname.vercel.app`, or `http://localhost:3000` while testing locally) so login redirects land in the right place.

By default Supabase requires users to confirm their email before signing in. You can turn this off for faster testing under **Authentication → Providers → Email → Confirm email**.

## 2. Put this project on GitHub

1. Go to github.com → New repository → name it `fusionxi` → Create.
2. Upload all the files in this folder to that repository (drag-and-drop works, or use `git push` if you're comfortable with git).

## 3. Deploy on Vercel

1. Go to vercel.com → sign up / log in (you can use your GitHub account to sign in — it's free).
2. Click **Add New → Project**.
3. Import the `fusionxi` GitHub repo you just created.
4. Before clicking Deploy, open **Environment Variables** and add:
   - `GEMINI_API_KEY` = your Gemini key
   - `OPENAI_API_KEY` = your OpenAI key (only needed if you want image generation)
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**. Wait about a minute.
6. Once deployed, go back to Supabase → **Authentication → URL Configuration** and update the Site URL to your real `.vercel.app` link (see step 1b.5).

## 4. Your URL

Vercel will give you a link like `fusionxi-yourname.vercel.app` (or exactly `fusionxi.vercel.app` if that exact name is still free — first come, first served). You can rename the project anytime in Vercel → Project Settings → General → Project Name, which changes the `.vercel.app` subdomain to match.

If you own a real domain (e.g. `fusionxi.com`), you can also attach it for free under Project Settings → Domains.

## Using it locally first (optional)

If you want to test on your own computer before deploying:

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste in your keys (Gemini, Supabase URL + anon key)
npm run dev
```

Then open http://localhost:3000 — it'll send you to `/login` first.

## What's inside

- `pages/login.js` — sign in / sign up page (email+password, plus Google if you set that up)
- `pages/index.js` — the chat + image UI, with a sidebar of previous chats (toggle the square icon next to the input to switch to image generation)
- `pages/api/chat.js` — server-side route that calls Google Gemini (free), keeping your key private
- `pages/api/image.js` — server-side route that calls OpenAI's image model, keeping your OpenAI key private
- `lib/supabaseClient.js` — the Supabase client used for auth and saving chats
- `supabase-schema.sql` — run this once in Supabase's SQL Editor to create the `chats`/`messages` tables
- All keys live only in environment variables (`.env.local` locally, Vercel's Environment Variables in production) — never in the browser bundle, never in your code. Only the Supabase URL and anon key are exposed to the browser (that's expected — row-level security keeps everyone's data private anyway).
