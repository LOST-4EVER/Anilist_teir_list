# AniTier - AniList Tier List

A beautiful, modern tier list builder powered by your AniList account. Dark & light mode, drag-and-drop tiers, search and import from AniList.

## Live Site

https://LOST-4EVER.github.io/Anilist_teir_list/

## Features

- 🏆 Drag-and-drop tier list builder
- 🔍 Search & add anime / manga from AniList
- 🔐 Login with your AniList account to auto-import your list
- 🌙 / ☀️ Dark & light theme toggle (in Settings)
- 📦 Export your tier list as JSON
- ✅ Fully client-side, no backend required (runs on GitHub Pages)

## Local Development

```bash
npm install
npm start
# -> http://localhost:3000
```

## GitHub Pages Deployment

The site is deployed via a GitHub Actions workflow (see `.github/workflows/deploy.yml`) which publishes the `public/` folder to GitHub Pages on every push to `main`. The **Settings -> Pages** source must be set to **GitHub Actions**.

### AniList OAuth (Login)

Login only works with **your own** AniList API client. The bundled demo client can't return a token to this site, so set up your own (free, 1 minute):

1. Go to https://anilist.co/settings/developer and click **Create New Client**.
2. Set the client's **Redirect URL** to exactly:
   `https://LOST-4EVER.github.io/Anilist_teir_list/callback.html`
   (If you fork, use your own username/path.)
3. Open the app, click **Login**, paste your **Client ID** in the login modal, and click **Save**.
4. Click **Continue with AniList** — approve, and you'll be logged in automatically.

No account or registration is needed to **search** anime, or to **manually paste a token** (obtain one at https://anilist.co/api/v2/oauth/authorize?client_id=4410&response_type=token).

## Project Structure

```
public/
├── index.html        # Main app
├── callback.html     # OAuth callback (popup)
├── css/style.css     # Styles (dark/light)
└── js/app.js         # App logic (AniList API, DnD, theme)
server.js             # Optional local dev server (Express)
.github/workflows/    # GitHub Pages deployment
```

> Note: Login uses AniList's OAuth. If the shared demo client is rate-limited or the redirect isn't registered, create your own client as described above.
