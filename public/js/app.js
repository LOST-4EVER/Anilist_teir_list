/**
 * AniTier - Main Application Core
 */
window.AniApp = (function () {
  'use strict';

  const STORAGE_KEY = 'anitier_state_v2';

  const state = {
    user: null,
    token: null,
    username: null,
    mediaType: 'ANIME',
    statusFilter: 'ALL',
    sortUnranked: 'default',
    tiers: [],
    media: [],
    rawCollection: []
  };

  function init() {
    loadPersistedState();

    // Initialize Submodules
    if (window.AniUI && window.AniUI.init) window.AniUI.init();
    if (window.AniTierList && window.AniTierList.init) window.AniTierList.init();
    if (window.AniMediaModal && window.AniMediaModal.init) window.AniMediaModal.init();
    if (window.AniExport && window.AniExport.init) window.AniExport.init();
    if (window.AniExplorer && window.AniExplorer.init) window.AniExplorer.init();

    setupAuthHandlers();
    setupTypeAndFilterControls();
    setupCollectionSyncHandlers();

    // Render initial view
    window.AniTierList.renderAll();
    window.AniUI.updateUserHeader();

    // If user has saved username/token, offer auto-refresh
    if (state.username && !state.rawCollection.length) {
      loadUserLibrary(state.username, state.token);
    }
  }

  function loadPersistedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('anitier');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.user = parsed.user || null;
        state.token = parsed.token || null;
        state.username = parsed.username || state.user?.name || null;
        state.mediaType = parsed.mediaType || 'ANIME';
        state.statusFilter = parsed.statusFilter || 'ALL';
        state.sortUnranked = parsed.sortUnranked || 'default';
        state.tiers = (parsed.tiers && parsed.tiers.length) ? parsed.tiers : window.AniTierList.defaultTiers();
        state.media = parsed.media || [];
        state.rawCollection = parsed.rawCollection || [];
      } else {
        state.tiers = window.AniTierList.defaultTiers();
      }
    } catch (e) {
      console.warn('Failed to parse saved state:', e);
      state.tiers = window.AniTierList.defaultTiers();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: state.user,
        token: state.token,
        username: state.username,
        mediaType: state.mediaType,
        statusFilter: state.statusFilter,
        sortUnranked: state.sortUnranked,
        tiers: state.tiers,
        media: state.media,
        rawCollection: state.rawCollection
      }));
    } catch (e) {
      console.warn('State persist failed:', e);
    }
  }

  function getState() {
    return state;
  }

  /* ============ AUTH & IMPORT ============ */
  function setupAuthHandlers() {
    // Auth Listener from popup / hash
    window.AniAuth.onAuthChange((authData) => {
      if (authData.error) {
        window.AniUI.showToast(authData.error, true);
        return;
      }

      if (authData.token) {
        state.token = authData.token;
        state.user = authData.user || { name: authData.username };
        state.username = authData.username || authData.user?.name;
        persist();
        window.AniUI.updateUserHeader();
        window.AniUI.closeModal('loginModal');
        window.AniUI.showToast(`Logged in as ${state.username}!`);
        loadUserLibrary(state.username, state.token);
      }
    });

    // Login Modal: OAuth Button
    const oauthBtn = document.getElementById('loginOAuthBtn');
    if (oauthBtn) {
      oauthBtn.addEventListener('click', () => {
        const { popup, authUrl, pinUrl } = window.AniAuth.openAuthPopup();
        if (!popup) {
          const fallbackLink = document.getElementById('popupBlockedLink');
          if (fallbackLink) {
            fallbackLink.href = authUrl;
            document.getElementById('popupBlockedWrap')?.classList.remove('hidden');
          }
          window.AniUI.showToast('Popup was blocked by browser. Click the manual link below.', true);
        } else {
          window.AniUI.showToast('Approve on AniList popup to connect...');
        }
      });
    }

    // Login Modal: Username Import Form
    const usernameInput = document.getElementById('usernameImportInput');
    const usernameBtn = document.getElementById('usernameImportBtn');
    const handleUsernameImport = () => {
      const val = window.AniAuth.parseUsername(usernameInput?.value);
      if (!val) {
        window.AniUI.showToast('Please enter an AniList username or profile link', true);
        return;
      }
      window.AniUI.showToast(`Fetching collection for ${val}...`);
      loadUserLibrary(val, null, () => {
        window.AniUI.closeModal('loginModal');
        if (usernameInput) usernameInput.value = '';
      });
    };

    if (usernameBtn) usernameBtn.addEventListener('click', handleUsernameImport);
    if (usernameInput) {
      usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUsernameImport();
      });
    }

    // Hero Import Form (empty state)
    const heroInput = document.getElementById('heroUsernameInput');
    const heroBtn = document.getElementById('heroImportBtn');
    const handleHeroImport = () => {
      const val = window.AniAuth.parseUsername(heroInput?.value);
      if (!val) {
        window.AniUI.showToast('Please enter an AniList username', true);
        return;
      }
      window.AniUI.showToast(`Loading AniList list for ${val}...`);
      loadUserLibrary(val, null, () => {
        if (heroInput) heroInput.value = '';
      });
    };

    if (heroBtn) heroBtn.addEventListener('click', handleHeroImport);
    if (heroInput) {
      heroInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleHeroImport();
      });
    }

    // Instant Presets
    const presetTopAnimeBtn = document.getElementById('presetTopAnimeBtn');
    if (presetTopAnimeBtn) {
      presetTopAnimeBtn.addEventListener('click', () => loadPresetCollection('TOP_RATED', 'Top Rated Anime'));
    }

    const presetTrendingBtn = document.getElementById('presetTrendingBtn');
    if (presetTrendingBtn) {
      presetTrendingBtn.addEventListener('click', () => loadPresetCollection('TRENDING', 'Trending Anime'));
    }

    const presetDemoUserBtn = document.getElementById('presetDemoUserBtn');
    if (presetDemoUserBtn) {
      presetDemoUserBtn.addEventListener('click', () => {
        if (heroInput) heroInput.value = 'lost4ever';
        loadUserLibrary('lost4ever');
      });
    }

    // Manual Token Input Form
    const tokenInput = document.getElementById('manualTokenInput');
    const tokenBtn = document.getElementById('manualTokenConnectBtn');
    const handleTokenConnect = async () => {
      const raw = tokenInput?.value;
      const parsed = window.AniAuth.parseToken(raw);
      if (!parsed) {
        // If user typed a username in token box, fall back gracefully
        if (raw && !raw.includes('.') && raw.length < 35) {
          loadUserLibrary(raw.trim());
          window.AniUI.closeModal('loginModal');
          return;
        }
        window.AniUI.showToast('Please paste a valid AniList OAuth access token', true);
        return;
      }

      window.AniUI.showToast('Verifying token with AniList...');
      try {
        const viewer = await window.AniApi.fetchViewer(parsed);
        state.token = parsed;
        state.user = viewer;
        state.username = viewer.name;
        persist();
        window.AniUI.updateUserHeader();
        window.AniUI.closeModal('loginModal');
        window.AniUI.showToast(`Logged in as ${viewer.name}!`);
        loadUserLibrary(viewer.name, parsed);
        if (tokenInput) tokenInput.value = '';
      } catch (err) {
        console.error(err);
        window.AniUI.showToast('Token invalid or expired. Try "Web Access" tab instead!', true);
      }
    };

    if (tokenBtn) tokenBtn.addEventListener('click', handleTokenConnect);
    if (tokenInput) {
      tokenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleTokenConnect();
      });
    }

    // Client ID Setting
    const clientIdInput = document.getElementById('settingClientIdInput');
    const clientIdSaveBtn = document.getElementById('settingClientIdSaveBtn');
    if (clientIdInput) {
      clientIdInput.value = window.AniAuth.getClientId();
      if (clientIdSaveBtn) {
        clientIdSaveBtn.addEventListener('click', () => {
          window.AniAuth.setClientId(clientIdInput.value);
          window.AniUI.showToast('Saved Client ID');
        });
      }
    }

    // Logout / Clear Account
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        logout();
      });
    }
  }

  function logout() {
    state.user = null;
    state.token = null;
    state.username = null;
    persist();
    window.AniUI.updateUserHeader();
    window.AniUI.showToast('Signed out of AniList');
  }

  /* ============ COLLECTION DATA FETCHING ============ */
  async function loadUserLibrary(username, token = null, callback = null) {
    if (!username && !token) return;

    try {
      const result = await window.AniApi.fetchUserCollection({
        username: username || state.username,
        type: state.mediaType || 'ANIME',
        token: token || state.token
      });

      if (result.user) {
        state.user = {
          id: result.user.id,
          name: result.user.name,
          avatar: result.user.avatar,
          bannerImage: result.user.bannerImage,
          isUsernameImport: !token
        };
        state.username = result.user.name;
      }

      const lists = result.collection?.lists || [];
      const entries = lists.flatMap(l => (l.entries || []).map(e => ({
        ...e,
        listStatus: e.status || l.status || 'COMPLETED'
      })));

      processEntries(entries);
      persist();
      window.AniUI.updateUserHeader();
      window.AniTierList.renderAll();

      if (callback) callback();
      window.AniUI.showToast(`Loaded ${state.rawCollection.length} titles from ${result.user?.name || username}'s AniList library!`);
    } catch (err) {
      console.error('Failed to load user library:', err);
      window.AniUI.showToast(err.message || 'Could not fetch user list. Check username spelling.', true);
    }
  }

  async function loadPresetCollection(category, label) {
    window.AniUI.showToast(`Loading ${label} from AniList...`);
    try {
      const items = await window.AniApi.fetchPresetMedia(category, state.mediaType || 'ANIME', 30);
      const parsed = items.map(med => ({
        id: med.id,
        title: med.title?.english || med.title?.romaji || 'Item',
        cover: med.coverImage?.extraLarge || med.coverImage?.large || '',
        score: med.averageScore || 0,
        format: med.format || 'ANIME',
        status: 'COMPLETED',
        progress: 0,
        type: med.type || state.mediaType,
        tier: null
      }));

      state.rawCollection = parsed;
      state.media = [...parsed];
      persist();
      window.AniUI.updateUserHeader();
      window.AniTierList.renderAll();
      window.AniUI.showToast(`Loaded ${parsed.length} titles for ${label}! Ready to rank.`);
    } catch (err) {
      console.error('Failed to load preset:', err);
      window.AniUI.showToast('Failed to load preset list from AniList', true);
    }
  }

  function processEntries(entries) {
    // Preserve existing tier placements
    const existingTierMap = new Map();
    state.media.forEach(m => {
      if (m.tier) existingTierMap.set(String(m.id), m.tier);
    });

    const parsed = entries.filter(e => e && e.media).map(e => {
      const med = e.media;
      return {
        id: med.id,
        title: med.title?.english || med.title?.romaji || med.title?.native || 'Unknown',
        cover: med.coverImage?.extraLarge || med.coverImage?.large || '',
        score: e.score || med.averageScore || 0,
        format: med.format || 'ANIME',
        status: e.status || e.listStatus || 'COMPLETED',
        progress: e.progress || 0,
        type: med.type || state.mediaType,
        tier: existingTierMap.get(String(med.id)) || null
      };
    });

    // Deduplicate
    const seen = new Set();
    state.rawCollection = parsed.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    applyFilters();
  }

  function applyFilters() {
    let filtered = state.rawCollection.filter(item => {
      if (item.type !== state.mediaType) return false;
      if (state.statusFilter !== 'ALL' && item.status !== state.statusFilter) return false;
      return true;
    });

    // Keep any custom-added items that may not be in raw collection
    const customItems = state.media.filter(m => !state.rawCollection.some(r => String(r.id) === String(m.id)));
    state.media = [...filtered, ...customItems];

    persist();
    window.AniTierList.renderAll();
  }

  function setupTypeAndFilterControls() {
    // Anime / Manga Type Switcher
    const animeBtn = document.getElementById('typeAnimeBtn');
    const mangaBtn = document.getElementById('typeMangaBtn');

    const switchMediaType = (type) => {
      if (state.mediaType === type) return;
      state.mediaType = type;
      if (animeBtn) animeBtn.classList.toggle('active', type === 'ANIME');
      if (mangaBtn) mangaBtn.classList.toggle('active', type === 'MANGA');

      if (state.username || state.token) {
        window.AniUI.showToast(`Loading ${type.toLowerCase()} library...`);
        loadUserLibrary(state.username, state.token);
      } else {
        applyFilters();
      }
    };

    if (animeBtn) animeBtn.addEventListener('click', () => switchMediaType('ANIME'));
    if (mangaBtn) mangaBtn.addEventListener('click', () => switchMediaType('MANGA'));

    // Status Filter Chips
    document.querySelectorAll('.m3-filter-chip, .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.m3-filter-chip, .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.statusFilter = pill.dataset.status;
        applyFilters();
      });
    });
  }

  function setupCollectionSyncHandlers() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        if (state.username || state.token) {
          window.AniUI.showToast('Syncing with AniList...');
          loadUserLibrary(state.username, state.token);
        } else {
          window.AniUI.openModal('loginModal');
        }
      });
    }
  }

  function updateMediaItemLocal(updated) {
    const idx = state.media.findIndex(m => String(m.id) === String(updated.id));
    if (idx > -1) {
      state.media[idx] = { ...state.media[idx], ...updated };
    } else {
      state.media.push({ ...updated, tier: null });
    }

    const rawIdx = state.rawCollection.findIndex(r => String(r.id) === String(updated.id));
    if (rawIdx > -1) {
      state.rawCollection[rawIdx] = { ...state.rawCollection[rawIdx], ...updated };
    } else {
      state.rawCollection.push(updated);
    }

    persist();
    window.AniTierList.renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getState,
    persist,
    loadUserLibrary,
    updateMediaItemLocal,
    logout
  };
})();
