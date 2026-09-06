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

**No setup needed.** Login uses AniList's built-in **Auth Pin flow** with the public demo client — you don't need to create your own API client:

1. Open the app and click **Login**.
2. Click **Continue with AniList** and log in / approve on AniList.
3. AniList shows your **access token** with a copy button — copy it.
4. Return to the app and paste the token in the box (it connects automatically).

Your token is stored only in your browser and stays valid for a year.

> Optional: Prefer your own API client (same pin flow, your own rate limits)? Create a free client at https://anilist.co/settings/developer, set its **Redirect URL** to exactly `https://anilist.co/api/v2/oauth/pin`, then enter your **Client ID** under the *Advanced* section of the login modal.

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

> Note: Login uses AniList's OAuth **Auth Pin flow** (copy-paste the token shown by AniList) — this works with the public demo client and needs no account or registration.
