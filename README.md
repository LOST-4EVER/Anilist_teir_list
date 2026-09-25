# AniTier - Material Design 3 AniList Tier List Maker

> Build, rank, and export beautiful anime & manga tier lists directly from your AniList library.

AniTier connects directly with AniList's GraphQL API to fetch your anime and manga collections and rank them in a modern, interactive Material Design 3 (Material You) tier list maker.

---

## ✨ Features

- **⚡ Instant AniList Ingestion (No Password Required)**:
  - Enter any public AniList username or profile link (`https://anilist.co/user/...`) to load your entire library in seconds.
  - Multi-chunk pagination support for large collections (handles 1,000+ entries effortlessly).
  - Instant presets for **Top Rated Anime**, **Trending Anime**, and sample accounts.

- **🎨 Material Design 3 UI & Animations**:
  - Expressive motion curves (`cubic-bezier(0.2, 0.0, 0.0, 1.0)`) with smooth elevation shadows.
  - 3 Crafted Themes: **Cyber Dark**, **Clean Light**, and **Midnight OLED**.
  - 100% Crisp Vector SVG icons (zero emoji placeholders).
  - Responsive layout optimized for desktop, tablets, and mobile screens.

- **🏆 Powerful Tier List Engine**:
  - **Fluid Drag-and-Drop**: Drag entries directly into tiers with dropzone indicators and touch drag ghost support on mobile.
  - **Auto-Rank by AniList Score**: Automatically places unranked items into tiers (S, A, B, C, D, F) based on user ratings with one click.
  - **Full Tier Customization**: Rename tier labels inline, pick custom colors with the built-in color picker, add new tiers, or reorder tiers up/down.
  - **Unranked Pool Controls**: Filter by AniList status (*Completed*, *Watching/Reading*, *Planning*, *Paused*, *Dropped*) or sort by score and title (A-Z).

- **🔍 Media Inspector & Quick Search**:
  - Real-time live search with debounced autocomplete for any title in the entire AniList database.
  - Interactive inspector modal with synopsis, genres, format, episode counts, studio, and trailers.

- **💾 Export & Backup**:
  - **High-Res PNG Export**: Generates a clean, watermark-branded screenshot ready for sharing on social media or Discord.
  - **JSON Backup & Restore**: Export and import your complete tier list state as a JSON file.
  - **Local Persistence**: State auto-saves to `localStorage` so you never lose your rankings across sessions.

---

## 📁 Project Architecture

```text
├── server.js               # Express server (static file hosting, /api/proxy-image)
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables (PORT, CLIENT_ID)
├── README.md               # Project documentation
└── public/
    ├── index.html          # Material 3 Semantic HTML5 markup
    ├── callback.html       # OAuth popup receiver page
    ├── css/
    │   └── style.css       # Material 3 CSS tokens, elevations & responsive layout
    └── js/
        ├── api.js          # AniList GraphQL client (queries & mutations)
        ├── auth.js         # Authentication manager (OAuth, token, web profile)
        ├── icons.js        # Pure SVG icon registry
        ├── tierlist.js     # Drag-and-drop tier list core engine
        ├── media-modal.js  # Media details inspector dialog
        ├── export.js       # HTML2Canvas PNG export & JSON state manager
        ├── ui.js           # Material 3 theme controller, dialogs & toasts
        └── app.js          # Main application orchestrator & state manager
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Running Locally

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`

---

## 🛠️ Configuration & API Integration

- **AniList Public GraphQL Endpoint**: `https://graphql.anilist.co` (No API key required for public user lists or media search).
- **AniList OAuth (Optional)**: If you want to connect your own AniList Developer Client ID for live 2-way sync:
  - Add your client ID in the **Settings Dialog** or in `.env` under `CLIENT_ID`.
  - Redirect URI: `http://localhost:3000/callback.html`

---

## 📄 License

MIT License. AniList is a trademark of AniList.co. This project is an independent community application.
