# FusionXi

A ChatGPT-style app with chat (Claude) and image generation (OpenAI), ready to deploy on Vercel.

## 1. Get your API keys

- **Google Gemini (chat) — free:** aistudio.google.com/apikey → Create API Key. No credit card needed for the free tier.
- **OpenAI (images) — paid:** platform.openai.com → API Keys → Create new secret key. Needs billing enabled.

Keep both keys somewhere safe — you'll paste them into Vercel in step 3, not into any code file.

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
5. Click **Deploy**. Wait about a minute.

## 4. Your URL

Vercel will give you a link like `fusionxi-yourname.vercel.app` (or exactly `fusionxi.vercel.app` if that exact name is still free — first come, first served). You can rename the project anytime in Vercel → Project Settings → General → Project Name, which changes the `.vercel.app` subdomain to match.

If you own a real domain (e.g. `fusionxi.com`), you can also attach it for free under Project Settings → Domains.

## Using it locally first (optional)

If you want to test on your own computer before deploying:

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste in your two keys
npm run dev
```

Then open http://localhost:3000

## What's inside

- `pages/index.js` — the chat + image UI (toggle the square icon next to the input to switch to image generation)
- `pages/api/chat.js` — server-side route that calls Google Gemini (free), keeping your key private
- `pages/api/image.js` — server-side route that calls OpenAI's image model, keeping your OpenAI key private
- Both API keys live only in Vercel's Environment Variables — never in the browser, never in your code.
