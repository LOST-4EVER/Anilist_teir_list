(() => {
  'use strict';

  const ANILIST_API = 'https://graphql.anilist.co';
  const CLIENT_ID = new URLSearchParams(window.location.search).get('client_id') || '4410';
  const BASE = window.location.pathname.replace(/[^/]*$/, '');
  const REDIRECT_URI = window.location.origin + BASE + 'callback.html';

  const TIER_COLORS = [
    '#FF4D4D', '#FF8C42', '#FFD700', '#7BC950',
    '#4DB8FF', '#9B7BFF', '#F75BB8', '#8B99A8',
    '#26C6DA', '#66BB6A', '#FF7043', '#AB47BC'
  ];

  const SCORE_LABELS = ['★', 'S', 'A', 'B', 'C', 'D', 'F'];

  const state = {
    user: null,
    media: [],
    tiers: [],
    token: null,
    savedList: this
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
    setupListeners();
    renderTiers();
    renderUnranked();
    checkURLForToken();
    updateUserUI();

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'anitier-auth') {
        if (e.data.token) {
          state.token = e.data.token;
          state.user = e.data.user;
          persistState();
          updateUserUI();
          loadUserList();
          showToast('Logged in as ' + state.user?.name);
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
        state.tiers = data.tiers && data.tiers.length ? data.tiers : defaultTiers();
        state.media = data.media || [];
        renderTiers();
        renderUnranked();
        if (!state.media.length) {
          document.getElementById('emptyState').classList.remove('hidden');
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
      tiers: state.tiers,
      media: state.media
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

  /* ============ AUTH ============ */
  function setupAuth() {
    document.getElementById('openLoginModal').addEventListener('click', () => {
      document.getElementById('loginModal').classList.add('show');
    });
    document.getElementById('closeLoginModal').addEventListener('click', () => {
      document.getElementById('loginModal').classList.remove('show');
    });
    document.getElementById('emptyLoginBtn').addEventListener('click', () => {
      document.getElementById('loginModal').classList.add('show');
    });

    document.getElementById('loginBtn').addEventListener('click', () => {
      const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
      const width = 600, height = 700;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const popup = window.open(authUrl, 'anilistAuth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`);
      if (!popup) {
        showToast('Popup blocked - allow popups to login', true);
        return;
      }
      popup.focus();
      pollPopupForToken(popup);
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        e.target.classList.remove('show');
      }
    });
    document.getElementById('loginModal').addEventListener('click', (e) => {
      if (e.target.id === 'loginModal') {
        e.target.classList.remove('show');
      }
    });

    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.remove('show');
    });
    document.getElementById('openSettingsModal').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('show');
    });

    document.getElementById('themeToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-btn');
      if (!btn) return;
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      localStorage.setItem('anitier-theme', btn.dataset.theme);
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      state.user = null;
      state.token = null;
      persistState();
      updateUserUI();
      showToast('Logged out');
    });

    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('resetBtn').addEventListener('click', resetTiers);

    document.getElementById('emptyState').addEventListener('click', (e) => {
      if (e.target.closest('#emptyLoginBtn')) {
        document.getElementById('loginModal').classList.add('show');
      }
    });
  }

  function pollPopupForToken(popup) {
    let attempts = 0;
    const maxAttempts = 200;
    const timer = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        showToast('Login timed out', true);
        return;
      }
      let hash = null;
      try {
        if (popup.location.href.includes('anilist.co')) return;
        hash = popup.location.hash;
      } catch (e) {
        return;
      }
      if (hash && hash.includes('access_token=')) {
        clearInterval(timer);
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          popup.close();
          finalizeLogin(token);
        } else {
          popup.close();
          showToast('Login failed', true);
        }
      }
    }, 100);
  }

  function finalizeLogin(token) {
    if (state.loggingIn) return;
    state.loggingIn = true;
    state.token = token;
    fetchViewer(token).then(user => {
      state.loggingIn = false;
      state.user = user;
      persistState();
      updateUserUI();
      loadUserList();
      document.getElementById('loginModal').classList.remove('show');
      showToast('Logged in as ' + (user?.name || 'user'));
    }).catch(err => {
      state.loggingIn = false;
      showToast('Login failed', true);
    });
  }

  function checkURLForToken() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        window.location.hash = '';
        finalizeLogin(token);
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
    }).then(r => r.json()).then(d => d.data.Viewer);
  }

  function updateUserUI() {
    if (state.user) {
      document.getElementById('userLoggedOut').classList.add('hidden');
      document.getElementById('userLoggedIn').classList.remove('hidden');
      document.getElementById('username').textContent = state.user.name;
      const avatar = document.getElementById('avatar');
      if (state.user.avatar && state.user.avatar.large) {
        avatar.style.backgroundImage = `url(${state.user.avatar.large})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
      }
    } else {
      document.getElementById('userLoggedOut').classList.remove('hidden');
      document.getElementById('userLoggedIn').classList.add('hidden');
    }
  }

  function loadUserList() {
    if (!state.token) return;
    document.getElementById('emptyState').classList.add('hidden');
    const query = `
      query ($userId: Int, $type: MediaType) {
        MediaListCollection(userId: $userId, type: $type) {
          lists {
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

    showToast('Loading your anime list...');
    const vars = { userId: state.user.id, type: 'ANIME' };

    fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + state.token
      },
      body: JSON.stringify({ query, variables: vars })
    }).then(r => r.json()).then(result => {
      const lists = result.data?.MediaListCollection?.lists || [];
      const entries = lists.flatMap(l => l.entries || []);
      const media = entries.filter(e => e.media).map(e => ({
        id: e.media.id,
        title: e.media.title?.romaji || e.media.title?.english || 'Unknown',
        cover: e.media.coverImage?.extraLarge || e.media.coverImage?.large || '',
        score: e.media.averageScore || e.score,
        format: e.media.format,
        status: e.status,
        progress: e.progress,
        type: 'ANIME'
      }));
      state.media = media;
      persistState();
      renderUnranked();
      document.getElementById('emptyState').classList.add('hidden');
      showToast(`Loaded ${media.length} anime from AniList`);
    }).catch(err => {
      console.error(err);
      showToast('Failed to load list', true);
    });
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
      debounceTimer = setTimeout(() => searchAnilist(query), 400);
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
          studios(isMain: true) { nodes { name } }
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
        <img src="${r.cover}" alt="${r.title}" onerror="this.remove()">
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
      });
    });
  }

  /* ============ TIER RENDER ============ */
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
      label.style.background = tier.color;
      label.textContent = tier.label;
      label.dataset.label = '';

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
      attachTierDelete(row, tier);
    });

    attachDragEvents();
  }

  function attachLabelEdit(label, tier) {
    label.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = tier.label;
      input.maxLength = 8;
      label.innerHTML = '';
      label.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        tier.label = input.value.trim() || tier.label;
        label.innerHTML = '';
        label.style.background = tier.color;
        label.textContent = tier.label;
        persistState();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { input.blur(); }
        if (e.key === 'Escape') { label.textContent = tier.label; input.remove(); }
      });
    });
  }

  function attachTierDelete(row, tier) {
    row.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.tier-delete');
      if (!delBtn) return;
      const idx = state.tiers.indexOf(tier);
      if (idx > -1) {
        state.tiers.splice(idx, 1);
        state.media.forEach(m => { if (m.tier === tier.id) m.tier = null; });
        row.classList.add('deleted');
        setTimeout(() => {
          row.remove();
          renderUnranked();
          persistState();
        }, 300);
      }
    });
  }

  function renderUnranked() {
    const grid = document.getElementById('unrankedGrid');
    const unranked = state.media.filter(m => !m.tier);
    grid.innerHTML = '';
    unranked.forEach(m => {
      grid.appendChild(createItemElement(m));
    });
    attachDragEvents();
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

    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.innerHTML = `<img class="item-tooltip-cover" src="${media.cover}" alt=""><span class="item-tooltip-title">${esc(media.title)}</span>${media.score ? `<span class="item-tooltip-score">Score: ${media.score}</span>` : ''}`;
    document.body.appendChild(tooltip);
    item.addEventListener('mouseenter', () => {
      tooltip.style.display = 'flex';
      positionTooltip(tooltip, item);
    });
    item.addEventListener('mousemove', () => positionTooltip(tooltip, item));
    item.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
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

  let dragPayload = null;

  function handleDragStart(e) {
    dragPayload = {
      src: e.target.closest('.tier-item').dataset.mediaId,
      from: null
    };
    const parent = e.target.closest('.tier-items');
    if (parent) {
      const tierRow = parent.closest('.tier-row');
      if (tierRow) dragPayload.from = tierRow.dataset.tierId;
    }
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragPayload.src);
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    dragPayload = null;
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

    const oldTier = media.tier;
    media.tier = tierId;

    if (container.classList.contains('unranked-grid')) {
      container.insertBefore(e.target.closest('.tier-item') || getItemForMedia(mediaId), container.firstChild);
      persistState();
      renderUnranked();
      return;
    }

    persistState();
    renderTiers();
    renderUnranked();
    showToast(tierId ? `Moved to tier ${getTierLabel(tierId)}` : 'Moved to unranked');
  }

  function getItemForMedia(mediaId) {
    const media = state.media.find(m => String(m.id) === mediaId);
    if (!media) return null;
    return createItemElement(media);
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
    attachDragEvents();
    showToast('Added to unranked');
  }

  function removeMedia(id) {
    const idx = state.media.findIndex(m => m.id === id);
    if (idx > -1) {
      state.media.splice(idx, 1);
      persistState();
      renderTiers();
      renderUnranked();
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
    persistState();
    renderTiers();
    renderUnranked();
    document.getElementById('emptyState').classList.remove('hidden');
    showToast('Tier list reset');
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

  /* ============ TOAST ============ */
  let toastTimer = null;
  function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
