(() => {
  'use strict';

  const ANILIST_API = 'https://graphql.anilist.co';
  const AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';
  const PIN_REDIRECT = 'https://anilist.co/api/v2/oauth/pin';
  const getClientId = () => localStorage.getItem('anitier-clientid') ||
    new URLSearchParams(window.location.search).get('client_id') || '4410';

  const TIER_COLORS = [
    '#FF4D4D', '#FF8C42', '#FFD700', '#7BC950',
    '#4DB8FF', '#9B7BFF', '#F75BB8', '#8B99A8',
    '#26C6DA', '#66BB6A', '#FF7043', '#AB47BC'
  ];

  const SCORE_LABELS = ['★', 'S', 'A', 'B', 'C', 'D', 'F'];

  const state = {
    user: null, // { id, name, avatar, isUsernameImport?: boolean }
    token: null,
    username: null,
    mediaType: 'ANIME', // 'ANIME' | 'MANGA'
    statusFilter: 'ALL', // 'ALL' | 'COMPLETED' | 'CURRENT' | 'PLANNING' | 'PAUSED' | 'DROPPED'
    media: [], // [{ id, title, cover, score, format, status, progress, type, tier: null | tierId }]
    rawCollection: [], // All raw entries fetched from AniList
    tiers: [],
    sortUnranked: 'default'
  };

  const defaultTiers = () => [
    { id: 'tier-s', label: 'S', color: '#FF6B6B' },
    { id: 'tier-a', label: 'A', color: '#FFA94D' },
    { id: 'tier-b', label: 'B', color: '#FFD43B' },
    { id: 'tier-c', label: 'C', color: '#82C91E' },
    { id: 'tier-d', label: 'D', color: '#4DABF7' },
    { id: 'tier-f', label: 'F', color: '#868E96' },
  ];

  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function (predicate) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (predicate(this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    applyTheme();
    loadState();
    setupAuth();
    setupCollectionControls();
    setupListeners();
    checkURLForToken();
    updateUserUI();

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'anitier-auth') {
        if (e.data.token) {
          state.token = e.data.token;
          state.user = e.data.user;
          state.username = e.data.user?.name;
          persistState();
          updateUserUI();
          loadUserCollection();
          showToast('Logged in as ' + (state.user?.name || 'user'));
        } else {
          showToast('Login failed', true);
        }
      }
    });
  }

  /* ============ STORAGE ============ */
  function loadState() {
    try {
      const saved = localStorage.getItem('anitier');
      if (saved) {
        const data = JSON.parse(saved);
        state.user = data.user || null;
        state.token = data.token || null;
        state.username = data.username || (state.user?.name) || null;
        state.mediaType = data.mediaType || 'ANIME';
        state.statusFilter = data.statusFilter || 'ALL';
        state.tiers = data.tiers && data.tiers.length ? data.tiers : defaultTiers();
        state.media = data.media || [];
        state.rawCollection = data.rawCollection || [];

        renderAll();
        if (!state.media.length) {
          document.getElementById('emptyState').classList.remove('hidden');
        } else {
          document.getElementById('emptyState').classList.add('hidden');
          document.getElementById('collectionBar').classList.remove('hidden');
        }
      } else {
        state.tiers = defaultTiers();
      }
    } catch (e) {
      state.tiers = defaultTiers();
      state.media = [];
    }
  }

  function persistState() {
    localStorage.setItem('anitier', JSON.stringify({
      user: state.user,
      token: state.token,
      username: state.username,
      mediaType: state.mediaType,
      statusFilter: state.statusFilter,
      tiers: state.tiers,
      media: state.media,
      rawCollection: state.rawCollection
    }));
  }

  /* ============ THEME ============ */
  function applyTheme() {
    const theme = localStorage.getItem('anitier-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  /* ============ AUTH & IMPORT ============ */
  function setupAuth() {
    const loginModal = document.getElementById('loginModal');
    const showLoginModal = () => {
      loginModal.classList.add('show');
    };
    const hideLoginModal = () => {
      loginModal.classList.remove('show');
    };

    document.getElementById('openLoginModal').addEventListener('click', showLoginModal);
    document.getElementById('closeLoginModal').addEventListener('click', hideLoginModal);
    document.getElementById('emptyLoginBtn').addEventListener('click', showLoginModal);

    // Modal Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.getElementById('tabUsername')?.classList.toggle('active', target === 'username');
        document.getElementById('tabGoogle')?.classList.toggle('active', target === 'google');
        document.getElementById('tabToken')?.classList.toggle('active', target === 'token');
      });
    });

    const switchToUsernameBtn = document.getElementById('switchToUsernameBtn');
    if (switchToUsernameBtn) {
      switchToUsernameBtn.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'username'));
        document.getElementById('tabUsername')?.classList.add('active');
        document.getElementById('tabGoogle')?.classList.remove('active');
        document.getElementById('tabToken')?.classList.remove('active');
        document.getElementById('usernameInput')?.focus();
      });
    }

    // Google Sign-In Handler
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const googleConnectBtn = document.getElementById('googleConnectBtn');
    const googleNameInput = document.getElementById('googleNameInput');

    const doGoogleSignIn = (profileName) => {
      const name = (profileName || googleNameInput?.value || 'Google User').trim();
      state.user = {
        id: 'google-' + Date.now(),
        name: name,
        avatar: { large: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
        isGoogle: true
      };
      state.username = name;
      persistState();
      updateUserUI();
      hideLoginModal();
      showToast(`Signed in as ${name}`);
    };

    if (googleSignInBtn) googleSignInBtn.addEventListener('click', () => doGoogleSignIn());
    if (googleConnectBtn) googleConnectBtn.addEventListener('click', () => doGoogleSignIn());

    // Username / Web Access Import Handler (Modal)
    const usernameInput = document.getElementById('usernameInput');
    const usernameImportBtn = document.getElementById('usernameImportBtn');

    function extractUsernameFromInput(raw) {
      if (!raw) return '';
      let s = String(raw).trim();
      if (s.includes('anilist.co/user/')) {
        const m = s.match(/anilist\.co\/user\/([^\/\?#]+)/i);
        if (m && m[1]) return decodeURIComponent(m[1]);
      }
      return s;
    }

    const doUsernameImport = (inputEl) => {
      const username = extractUsernameFromInput(inputEl.value);
      if (!username) {
        showToast('Please enter an AniList username or profile link', true);
        return;
      }
      showToast('Fetching AniList profile for ' + username + '...');
      loadUserCollectionByUsername(username, () => {
        hideLoginModal();
        inputEl.value = '';
      });
    };

    usernameImportBtn.addEventListener('click', () => doUsernameImport(usernameInput));
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doUsernameImport(usernameInput);
    });

    // Username Import Handler (Hero Box)
    const heroUsernameInput = document.getElementById('heroUsernameInput');
    const heroImportBtn = document.getElementById('heroImportBtn');
    if (heroImportBtn && heroUsernameInput) {
      heroImportBtn.addEventListener('click', () => doUsernameImport(heroUsernameInput));
      heroUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doUsernameImport(heroUsernameInput);
      });
    }

    // Token OAuth Setup
    const clientIdInput = document.getElementById('clientIdInput');
    if (clientIdInput) {
      clientIdInput.value = getClientId();
      document.getElementById('clientIdSaveBtn')?.addEventListener('click', () => {
        const val = clientIdInput.value.trim();
        if (val) localStorage.setItem('anitier-clientid', val);
        else localStorage.removeItem('anitier-clientid');
        showToast('Client ID saved');
      });
    }

    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
    });

    const manualAuthLink = document.getElementById('manualAuthLink');
    const manualAuthWrap = document.getElementById('manualAuthWrap');
    const loginBtn = document.getElementById('loginBtn');

    const openAuth = () => {
      const clientId = getClientId();
      // Ensure redirect_uri=https://anilist.co/api/v2/oauth/pin is passed so AniList displays the PIN token page without redirecting to localhost!
      const redirectUri = encodeURIComponent(PIN_REDIRECT);
      const authUrl = `${AUTH_URL}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&response_type=token`;
      const width = 600, height = 700;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      let popup = null;
      try {
        popup = window.open(authUrl, 'anilistAuth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`);
      } catch (e) {}
      if (popup) {
        manualAuthWrap.classList.add('hidden');
        showToast('Approve on AniList, then copy your token and paste it below');
        tokenInput.focus();
      } else {
        manualAuthLink.href = authUrl;
        manualAuthWrap.classList.remove('hidden');
        showToast('Popup blocked - click the link below to open AniList', true);
      }
    };

    loginBtn.addEventListener('click', openAuth);

    const tokenInput = document.getElementById('tokenInput');
    document.getElementById('tokenConnectBtn').addEventListener('click', () => connectToken(tokenInput.value));

    tokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') connectToken(tokenInput.value);
    });
    tokenInput.addEventListener('paste', () => {
      setTimeout(() => { if (tokenInput.value) connectToken(tokenInput.value); }, 60);
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      state.user = null;
      state.token = null;
      state.username = null;
      state.rawCollection = [];
      state.media = [];
      persistState();
      updateUserUI();
      renderAll();
      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('collectionBar').classList.add('hidden');
      showToast('Account cleared');
    });

    document.getElementById('syncBtn').addEventListener('click', () => {
      if (state.username) {
        showToast('Refreshing list from AniList...');
        loadUserCollectionByUsername(state.username);
      } else if (state.token) {
        showToast('Refreshing list from AniList...');
        loadUserCollection();
      } else {
        showToast('No user account linked', true);
      }
    });

    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('resetBtn').addEventListener('click', resetTiers);
    document.getElementById('exportImageBtn').addEventListener('click', exportTierListImage);
    const headerExportBtn = document.getElementById('headerExportImageBtn');
    if (headerExportBtn) headerExportBtn.addEventListener('click', exportTierListImage);
  }

  function extractToken(rawInput) {
    if (!rawInput) return '';
    let str = String(rawInput).trim();

    // Catch if user pasted JSON error string like {"error":"unsupported_grant_type"...}
    if (str.includes('unsupported_grant_type') || str.includes('"error"') || str.includes('grant_type')) {
      showToast('Pasted text contains an error response! Use "Import by Username" tab above.', true);
      return '';
    }

    // Extract access token if user pasted full URL or hash (e.g., https://anilist.co/api/v2/oauth/pin#access_token=eyJ...)
    if (str.includes('access_token=')) {
      const match = str.match(/access_token=([^&"'\s]+)/);
      if (match && match[1]) return match[1];
    }

    // Extract access token if user pasted JSON string
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.access_token) return parsed.access_token;
      } catch (e) {}
    }

    // If string looks like a username rather than a token (no dots, short length, no eyJ prefix)
    if (!str.startsWith('eyJ') && str.length < 35 && !str.includes('.')) {
      showToast(`Loading AniList profile for "${str}"...`);
      loadUserCollectionByUsername(str, () => {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.remove('show');
        const tokenInput = document.getElementById('tokenInput');
        if (tokenInput) tokenInput.value = '';
      });
      return '';
    }

    return str;
  }

  function connectToken(rawToken) {
    const token = extractToken(rawToken);
    if (!token) return;

    finalizeLogin(token, () => {
      document.getElementById('tokenInput').value = '';
    });
  }

  function finalizeLogin(token, onSuccess) {
    if (state.loggingIn) return;
    state.loggingIn = true;
    state.token = token;
    fetchViewer(token).then(user => {
      state.loggingIn = false;
      state.user = user;
      state.username = user?.name;
      persistState();
      updateUserUI();
      loadUserCollection();
      document.getElementById('loginModal').classList.remove('show');
      if (onSuccess) onSuccess();
      showToast('Logged in as ' + (user?.name || 'user'));
    }).catch(err => {
      state.loggingIn = false;
      showToast('Token rejected by AniList. Use "Import by Username" instead!', true);
    });
  }

  function checkURLForToken() {
    const hash = window.location.hash || window.location.search;
    if (hash && hash.includes('access_token=')) {
      const match = hash.match(/access_token=([^&]+)/);
      if (match && match[1]) {
        window.location.hash = '';
        finalizeLogin(match[1]);
      }
    }
  }

  function fetchViewer(token) {
    const query = `
      query {
        Viewer {
          id
          name
          avatar { large }
          bannerImage
        }
      }
    `;
    return fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ query })
    }).then(r => {
      if (!r.ok) {
        return r.json().then(err => {
          throw new Error(err.message || 'Token error');
        });
      }
      return r.json();
    }).then(d => {
      if (d.errors && d.errors.length) {
        throw new Error(d.errors[0].message);
      }
      return d.data?.Viewer;
    });
  }

  /* ============ COLLECTION FETCHING & FILTERING ============ */
  function loadUserCollectionByUsername(username, callback) {
    const query = `
      query ($userName: String, $type: MediaType) {
        User(name: $userName) {
          id
          name
          avatar { large }
          bannerImage
        }
        MediaListCollection(userName: $userName, type: $type) {
          lists {
            name
            status
            entries {
              id
              score(raw: false)
              progress
              status
              media {
                id
                title { romaji english native }
                coverImage { extraLarge large color }
                averageScore
                format
                episodes
                chapters
                type
              }
            }
          }
        }
      }
    `;

    fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { userName: username, type: state.mediaType } })
    })
    .then(r => r.json())
    .then(result => {
      if (result.errors && result.errors.length) {
        throw new Error(result.errors[0].message || 'User not found');
      }
      const user = result.data?.User;
      if (!user) throw new Error('User not found on AniList');

      state.user = { id: user.id, name: user.name, avatar: user.avatar, isUsernameImport: true };
      state.username = user.name;

      const lists = result.data?.MediaListCollection?.lists || [];
      const entries = lists.flatMap(l => (l.entries || []).map(e => ({
        ...e,
        listStatus: e.status || l.status || 'COMPLETED'
      })));

      processRawEntries(entries);
      updateUserUI();

      if (callback) callback();
      showToast(`Loaded ${state.rawCollection.length} items for ${user.name}`);
    })
    .catch(err => {
      console.error(err);
      showToast(err.message || 'Failed to load list for user', true);
    });
  }

  function loadUserCollection() {
    if (!state.token && !state.username) return;
    if (state.user?.isUsernameImport || (!state.token && state.username)) {
      loadUserCollectionByUsername(state.username);
      return;
    }

    const query = `
      query ($userId: Int, $type: MediaType) {
        MediaListCollection(userId: $userId, type: $type) {
          lists {
            name
            status
            entries {
              id
              score(raw: false)
              progress
              status
              media {
                id
                title { romaji english native }
                coverImage { extraLarge large color }
                averageScore
                format
                episodes
                chapters
                type
              }
            }
          }
        }
      }
    `;

    fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + state.token
      },
      body: JSON.stringify({ query, variables: { userId: state.user.id, type: state.mediaType } })
    })
    .then(r => r.json())
    .then(result => {
      const lists = result.data?.MediaListCollection?.lists || [];
      const entries = lists.flatMap(l => (l.entries || []).map(e => ({
        ...e,
        listStatus: e.status || l.status || 'COMPLETED'
      })));
      processRawEntries(entries);
      showToast(`Loaded ${state.rawCollection.length} items from AniList`);
    })
    .catch(err => {
      console.error(err);
      showToast('Failed to load list', true);
    });
  }

  function processRawEntries(entries) {
    const existingTierMap = new Map();
    state.media.forEach(m => {
      if (m.tier) existingTierMap.set(String(m.id), m.tier);
    });

    const parsed = entries.filter(e => e && e.media).map(e => ({
      id: e.media.id,
      title: e.media.title?.romaji || e.media.title?.english || e.media.title?.native || 'Unknown',
      cover: e.media.coverImage?.extraLarge || e.media.coverImage?.large || '',
      score: e.media.averageScore || e.score || 0,
      format: e.media.format || 'ANIME',
      status: e.status || e.listStatus || 'COMPLETED',
      progress: e.progress || 0,
      type: e.media.type || state.mediaType,
      tier: existingTierMap.get(String(e.media.id)) || null
    }));

    // Deduplicate entries
    const seen = new Set();
    state.rawCollection = parsed.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    applyFiltersAndRender();
  }

  function applyFiltersAndRender() {
    let filtered = state.rawCollection.filter(item => {
      if (item.type !== state.mediaType) return false;
      if (state.statusFilter !== 'ALL' && item.status !== state.statusFilter) return false;
      return true;
    });

    state.media = filtered;
    persistState();

    if (state.media.length > 0 || state.user) {
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('collectionBar').classList.remove('hidden');
    }

    renderAll();
    updateCollectionBarCount();
  }

  function setupCollectionControls() {
    // Type Toggle (Anime / Manga)
    const typeAnimeBtn = document.getElementById('typeAnimeBtn');
    const typeMangaBtn = document.getElementById('typeMangaBtn');

    const setMediaType = (type) => {
      if (state.mediaType === type) return;
      state.mediaType = type;
      typeAnimeBtn.classList.toggle('active', type === 'ANIME');
      typeMangaBtn.classList.toggle('active', type === 'MANGA');

      if (state.username || state.token) {
        showToast(`Loading ${type.toLowerCase()} list...`);
        if (state.user?.isUsernameImport || (!state.token && state.username)) {
          loadUserCollectionByUsername(state.username);
        } else {
          loadUserCollection();
        }
      } else {
        applyFiltersAndRender();
      }
    };

    if (typeAnimeBtn && typeMangaBtn) {
      typeAnimeBtn.addEventListener('click', () => setMediaType('ANIME'));
      typeMangaBtn.addEventListener('click', () => setMediaType('MANGA'));
    }

    // Status Filter Pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.statusFilter = pill.dataset.status;
        applyFiltersAndRender();
      });
    });

    // Delete Entire List Button
    const clearEntireListBtn = document.getElementById('clearEntireListBtn');
    if (clearEntireListBtn) {
      clearEntireListBtn.addEventListener('click', () => {
        if (!state.media.length) {
          showToast('List is already empty');
          return;
        }
        if (confirm('Delete all items and clear your entire tier list?')) {
          state.media = [];
          state.rawCollection = [];
          persistState();
          renderAll();
          updateCollectionBarCount();
          showToast('Entire list deleted and cleared');
        }
      });
    }

    // Unranked Sorting & Actions
    const sortSelect = document.getElementById('unrankedSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.sortUnranked = sortSelect.value;
        renderUnranked();
      });
    }

    const clearUnrankedBtn = document.getElementById('clearUnrankedBtn');
    if (clearUnrankedBtn) {
      clearUnrankedBtn.addEventListener('click', () => {
        const unranked = state.media.filter(m => !m.tier);
        if (!unranked.length) {
          showToast('No unranked items to clear');
          return;
        }
        if (confirm(`Remove all ${unranked.length} unranked items?`)) {
          state.media = state.media.filter(m => m.tier);
          persistState();
          renderAll();
          showToast('Cleared unranked items');
        }
      });
    }
  }

  function updateCollectionBarCount() {
    const userLabel = document.getElementById('collectionUser');
    const countLabel = document.getElementById('collectionCount');
    if (userLabel) {
      userLabel.textContent = state.username ? `${state.username}'s Collection:` : 'Collection:';
    }
    if (countLabel) {
      countLabel.textContent = `${state.media.length} items (${state.mediaType.toLowerCase()})`;
    }

    // Calculate status breakdown for pills
    const counts = {
      ALL: 0,
      COMPLETED: 0,
      CURRENT: 0,
      PLANNING: 0,
      PAUSED: 0,
      DROPPED: 0
    };

    state.rawCollection.forEach(item => {
      if (item.type === state.mediaType) {
        counts.ALL++;
        if (counts[item.status] !== undefined) {
          counts[item.status]++;
        }
      }
    });

    Object.keys(counts).forEach(st => {
      const badgeEl = document.getElementById(`count-${st}`);
      if (badgeEl) badgeEl.textContent = counts[st];
    });

    document.querySelectorAll('.filter-pill').forEach(pill => {
      const pStatus = pill.dataset.status;
      pill.classList.toggle('active', pStatus === state.statusFilter);
    });
  }

  function updateUserUI() {
    const userLoggedOut = document.getElementById('userLoggedOut');
    const userLoggedIn = document.getElementById('userLoggedIn');
    const usernameEl = document.getElementById('username');
    const avatarEl = document.getElementById('avatar');

    if (state.user || state.username) {
      userLoggedOut.classList.add('hidden');
      userLoggedIn.classList.remove('hidden');
      usernameEl.textContent = state.user?.name || state.username;

      if (state.user?.avatar && state.user.avatar.large) {
        avatarEl.style.backgroundImage = `url(${state.user.avatar.large})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = '#00c2ff';
      }
    } else {
      userLoggedOut.classList.remove('hidden');
      userLoggedIn.classList.add('hidden');
    }
  }

  /* ============ SEARCH ============ */
  function setupListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let debounceTimer = null;

    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim();
      if (!query) {
        searchResults.classList.remove('show');
        return;
      }
      debounceTimer = setTimeout(() => searchAnilist(query), 350);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) {
        searchResults.classList.remove('show');
      }
    });

    document.getElementById('addTierBtn').addEventListener('click', addTier);
    document.getElementById('addAnimeBtn').addEventListener('click', () => {
      searchInput.focus();
    });

    document.getElementById('themeToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-btn');
      if (!btn) return;
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      localStorage.setItem('anitier-theme', btn.dataset.theme);
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    document.getElementById('openSettingsModal').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('show');
    });
    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.remove('show');
    });
  }

  function searchAnilist(query) {
    const searchResults = document.getElementById('searchResults');
    const graphQuery = `
      query ($search: String) {
        Media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          averageScore
          format
          seasonYear
        }
        Media2: Media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { extraLarge large }
          averageScore
          format
          startDate { year }
        }
      }
    `;

    fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: graphQuery, variables: { search: query } })
    }).then(r => r.json()).then(result => {
      const results = [];
      const anime = result.data?.Media;
      const manga = result.data?.Media2;
      if (anime) {
        results.push({
          id: anime.id,
          title: anime.title?.romaji || anime.title?.english,
          cover: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
          score: anime.averageScore,
          format: anime.format,
          meta: `${anime.format || 'Anime'}${anime.seasonYear ? ' · ' + anime.seasonYear : ''}${anime.averageScore ? ' · ' + anime.averageScore + '%' : ''}`,
          type: 'ANIME'
        });
      }
      if (manga) {
        results.push({
          id: manga.id,
          title: manga.title?.romaji || manga.title?.english,
          cover: manga.coverImage?.extraLarge || manga.coverImage?.large || '',
          score: manga.averageScore,
          format: manga.format,
          meta: `${manga.format || 'Manga'}${manga.startDate?.year ? ' · ' + manga.startDate.year : ''}${manga.averageScore ? ' · ' + manga.averageScore + '%' : ''}`,
          type: 'MANGA'
        });
      }
      renderSearchResults(results);
    }).catch(err => {
      console.error('Search error:', err);
      searchResults.innerHTML = '<div class="search-empty">Search failed</div>';
      searchResults.classList.add('show');
    });
  }

  function renderSearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    if (!results.length) {
      searchResults.innerHTML = '<div class="search-empty">No results found</div>';
      searchResults.classList.add('show');
      return;
    }
    searchResults.innerHTML = results.map(r => `
      <div class="search-result-item" data-id="${r.id}">
        <img src="${r.cover}" alt="${esc(r.title)}" onerror="this.remove()">
        <div class="search-result-info">
          <div class="search-result-title">${esc(r.title)}</div>
          <div class="search-result-meta">${esc(r.meta)}</div>
        </div>
      </div>
    `).join('');
    searchResults.classList.add('show');

    searchResults.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        const item = results[i];
        addMediaToUnranked({
          id: item.id,
          title: item.title,
          cover: item.cover,
          score: item.score,
          format: item.format,
          type: item.type
        });
        searchResults.classList.remove('show');
        document.getElementById('searchInput').value = '';
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('collectionBar').classList.remove('hidden');
      });
    });
  }

  function getLabelLengthClass(label) {
    const len = (label || '').length;
    if (len <= 3) return 'length-short';
    if (len <= 8) return 'length-medium';
    if (len <= 16) return 'length-long';
    return 'length-xlong';
  }

  /* ============ TIER & UNRANKED RENDERING ============ */
  function renderTiers() {
    const container = document.getElementById('tierContainer');
    container.innerHTML = '';

    state.tiers.forEach(tier => {
      const media = state.media.filter(m => m.tier === tier.id);
      const row = document.createElement('div');
      row.className = 'tier-row';
      row.dataset.tierId = tier.id;

      const label = document.createElement('div');
      label.className = 'tier-label';
      label.style.background = tier.color || '#FF6B6B';
      label.dataset.label = '';

      const labelText = document.createElement('span');
      labelText.className = `tier-label-text ${getLabelLengthClass(tier.label)}`;
      labelText.textContent = tier.label;
      label.appendChild(labelText);

      // Label Tools (Color picker & Delete tier)
      const tools = document.createElement('div');
      tools.className = 'label-tools';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = tier.color || '#FF6B6B';
      colorInput.className = 'color-picker-input';

      const colorBtn = document.createElement('button');
      colorBtn.className = 'label-btn color-btn';
      colorBtn.title = 'Change Tier Color';
      colorBtn.innerHTML = '<svg class="icon"><use href="#icon-palette"/></svg>';
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorInput.click();
      });

      colorInput.addEventListener('input', (e) => {
        tier.color = e.target.value;
        label.style.background = tier.color;
        persistState();
      });

      const labelDelete = document.createElement('button');
      labelDelete.className = 'label-btn delete-btn';
      labelDelete.title = 'Delete tier';
      labelDelete.innerHTML = '<svg class="icon"><use href="#icon-x"/></svg>';
      labelDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTier(tier.id, row);
      });

      tools.appendChild(colorBtn);
      tools.appendChild(labelDelete);
      label.appendChild(tools);
      label.appendChild(colorInput);

      const items = document.createElement('div');
      items.className = 'tier-items';
      items.dataset.container = '';

      media.forEach(m => {
        items.appendChild(createItemElement(m));
      });

      row.appendChild(label);
      row.appendChild(items);
      container.appendChild(row);

      attachLabelEdit(label, tier);
    });

    attachDragEvents();
  }

  function removeTier(tierId, row) {
    const idx = state.tiers.findIndex(t => t.id === tierId);
    if (idx === -1) return;
    state.tiers.splice(idx, 1);
    state.media.forEach(m => { if (m.tier === tierId) m.tier = null; });
    row.classList.add('deleted');
    setTimeout(() => {
      row.remove();
      renderAll();
      persistState();
    }, 250);
  }

  function attachLabelEdit(label, tier) {
    label.addEventListener('click', (e) => {
      if (e.target.closest('.label-tools') || e.target.closest('.color-picker-input')) return;
      if (label.querySelector('input[type="text"]')) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.value = tier.label;
      input.maxLength = 60;

      const textEl = label.querySelector('.tier-label-text');
      if (textEl) textEl.remove();

      label.insertBefore(input, label.querySelector('.label-tools'));
      input.focus();
      input.select();

      const commit = () => {
        tier.label = input.value.trim() || tier.label;
        const text = document.createElement('span');
        text.className = `tier-label-text ${getLabelLengthClass(tier.label)}`;
        text.textContent = tier.label;
        input.replaceWith(text);
        persistState();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
          const text = document.createElement('span');
          text.className = `tier-label-text ${getLabelLengthClass(tier.label)}`;
          text.textContent = tier.label;
          input.replaceWith(text);
        }
      });
    });
  }

  function renderUnranked() {
    const grid = document.getElementById('unrankedGrid');
    const badge = document.getElementById('unrankedCountBadge');
    let unranked = state.media.filter(m => !m.tier);

    if (state.sortUnranked === 'score') {
      unranked = [...unranked].sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (state.sortUnranked === 'title') {
      unranked = [...unranked].sort((a, b) => a.title.localeCompare(b.title));
    }

    grid.innerHTML = '';
    unranked.forEach(m => {
      grid.appendChild(createItemElement(m));
    });

    if (badge) badge.textContent = unranked.length;
    attachDragEvents();
    return unranked.length;
  }

  function renderAll() {
    renderTiers();
    renderUnranked();
  }

  function createItemElement(media) {
    const img = document.createElement('img');
    img.src = media.cover;
    img.alt = media.title;
    img.loading = 'lazy';
    img.className = 'item-cover';
    img.onerror = function() { this.style.opacity = '0.3'; };

    const item = document.createElement('div');
    item.className = 'tier-item';
    item.draggable = true;
    item.dataset.mediaId = media.id;
    item.appendChild(img);

    let tooltip = null;
    item.addEventListener('mouseenter', () => {
      if (tooltip) tooltip.remove();
      tooltip = document.createElement('div');
      tooltip.className = 'item-tooltip';
      tooltip.innerHTML = `<img class="item-tooltip-cover" src="${media.cover}" alt=""><span class="item-tooltip-title">${esc(media.title)}</span>${media.score ? `<span class="item-tooltip-score">Score: ${media.score}</span>` : ''}`;
      document.body.appendChild(tooltip);
      tooltip.style.display = 'flex';
      positionTooltip(tooltip, item);
    });
    item.addEventListener('mousemove', () => {
      if (tooltip && tooltip.parentNode) positionTooltip(tooltip, item);
    });
    item.addEventListener('mouseleave', () => {
      if (tooltip) { tooltip.remove(); tooltip = null; }
    });
    item.addEventListener('dragstart', () => {
      if (tooltip) { tooltip.remove(); tooltip = null; }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'item-remove';
    removeBtn.innerHTML = '<svg class="icon"><use href="#icon-x"/></svg>';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMedia(media.id);
    });
    item.appendChild(removeBtn);

    return item;
  }

  function positionTooltip(tooltip, item) {
    const rect = item.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;
    if (left + 200 > window.innerWidth) {
      left = rect.left - 12 - 160;
    }
    if (top + tooltip.offsetHeight > window.innerHeight) {
      top = window.innerHeight - tooltip.offsetHeight - 8;
    }
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  /* ============ DRAG & DROP ============ */
  let draggedEl = null;

  function attachDragEvents() {
    document.querySelectorAll('.tier-item').forEach(item => {
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragend', handleDragEnd);
    });

    document.querySelectorAll('.tier-items, .unranked-grid').forEach(container => {
      container.addEventListener('dragover', handleDragOver);
      container.addEventListener('dragleave', handleDragLeave);
      container.addEventListener('drop', handleDrop);
    });
  }

  function handleDragStart(e) {
    const item = e.target.closest('.tier-item');
    if (!item) return;
    draggedEl = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.mediaId);
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedEl = null;
    document.querySelectorAll('.tier-row').forEach(r => r.classList.remove('dragover'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.closest('.tier-row')?.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.currentTarget.closest('.tier-row')?.classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.closest('.tier-row')?.classList.remove('dragover');
    const mediaId = e.dataTransfer.getData('text/plain');
    if (!mediaId) return;

    const container = e.currentTarget;
    let tierId = null;

    if (container.classList.contains('tier-items')) {
      const tierRow = container.closest('.tier-row');
      tierId = tierRow.dataset.tierId;
    }

    const media = state.media.find(m => String(m.id) === mediaId);
    if (!media) return;

    const srcItem = draggedEl;
    const isUnrankedTarget = container.classList.contains('unranked-grid');

    media.tier = tierId || null;

    if (isUnrankedTarget && srcItem) {
      const grid = document.getElementById('unrankedGrid');
      grid.insertBefore(srcItem, grid.firstChild);
    }
    if (srcItem && srcItem.parentElement === container) {
      container.appendChild(srcItem);
    }

    renderAll();
    persistState();
    showToast(tierId ? `Moved to tier ${getTierLabel(tierId)}` : 'Moved to unranked');
  }

  function getTierLabel(tierId) {
    const tier = state.tiers.find(t => t.id === tierId);
    return tier ? tier.label : '';
  }

  /* ============ MEDIA MANAGEMENT ============ */
  function addMediaToUnranked(media) {
    if (state.media.some(m => m.id === media.id)) {
      showToast('Already in your list', true);
      return;
    }
    state.media.push({ ...media, tier: null });
    persistState();
    renderUnranked();
    showToast('Added to unranked');
  }

  function removeMedia(id) {
    const idx = state.media.findIndex(m => m.id === id);
    if (idx > -1) {
      state.media.splice(idx, 1);
      persistState();
      renderAll();
      showToast('Removed');
    }
  }

  function addTier() {
    const usedLabels = state.tiers.map(t => t.label);
    const nextLabel = SCORE_LABELS.find(l => !usedLabels.includes(l)) || String.fromCharCode(67 + state.tiers.length);
    const color = TIER_COLORS[state.tiers.length % TIER_COLORS.length];

    state.tiers.push({
      id: 'tier-' + Date.now(),
      label: nextLabel,
      color: color,
      score: state.tiers.length + 1
    });
    persistState();
    renderTiers();
    showToast('Tier added');
  }

  function resetTiers() {
    if (!confirm('Reset the entire tier list? This will remove all placements.')) return;
    state.tiers = defaultTiers();
    state.media = [];
    state.rawCollection = [];
    state.user = null;
    state.username = null;
    state.token = null;
    persistState();
    renderAll();
    updateUserUI();
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('collectionBar').classList.add('hidden');
    showToast('Tier list reset');
  }

  /* ============ EXPORT IMAGE ============ */
  function exportTierListImage() {
    const container = document.getElementById('tierContainer');
    if (!container || !container.children.length) {
      showToast('No tiers to export', true);
      return;
    }

    showToast('Generating PNG image...');

    if (typeof html2canvas === 'function') {
      html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0f1115',
        scale: 2
      }).then(canvas => {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `anitier-${state.username || 'tierlist'}.png`;
        a.click();
        showToast('Tier list image downloaded!');
      }).catch(err => {
        console.error('html2canvas failed:', err);
        showToast('Image export failed', true);
      });
    } else {
      showToast('Image generator loading, try again in a moment', true);
    }
  }

  function exportJSON() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anitier-export.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as JSON');
  }

  /* ============ TOAST & UTILS ============ */
  let toastTimer = null;
  function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
