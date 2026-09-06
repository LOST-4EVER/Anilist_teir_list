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

If you want login to work with your own app, you must create your own AniList API client:

1. Go to https://anilist.co/settings/developer and create a new client.
2. Set the **Redirect URL** to your deployed site:
   `https://LOST-4EVER.github.io/Anilist_teir_list/callback.html`
   (If you fork, use your own username/path.)
3. Put your client ID in `public/js/app.js` (`CLIENT_ID`), or override it via a `?client_id=YOUR_ID` query param on the page.

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
