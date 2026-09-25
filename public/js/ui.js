/**
 * AniTier UI Controller & Layout Manager (Material 3)
 */
window.AniUI = (function () {
  'use strict';

  let toastTimer = null;

  function init() {
    applyTheme();
    setupThemeButtons();
    setupModalEvents();
    setupSearchAutocomplete();
  }

  /* ============ THEMES ============ */
  function applyTheme() {
    const theme = localStorage.getItem('anitier-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.m3-theme-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anitier-theme', theme);
    document.querySelectorAll('.m3-theme-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  function setupThemeButtons() {
    document.querySelectorAll('.m3-theme-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
      });
    });

    const headerThemeBtn = document.getElementById('headerThemeToggleBtn');
    if (headerThemeBtn) {
      headerThemeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : (current === 'light' ? 'oled' : 'dark');
        setTheme(next);
      });
    }
  }

  /* ============ MODALS ============ */
  function setupModalEvents() {
    // Triggers
    const openLoginBtn = document.getElementById('openLoginModal');
    if (openLoginBtn) openLoginBtn.addEventListener('click', () => openModal('loginModal'));

    const userProfileChip = document.getElementById('userProfileChip');
    if (userProfileChip) userProfileChip.addEventListener('click', () => openModal('loginModal'));

    const openSettingsBtn = document.getElementById('openSettingsModal');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => openModal('settingsModal'));

    // Modal Close buttons & overlay click
    document.querySelectorAll('.m3-dialog-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.m3-dialog-close-btn')) {
          modal.classList.remove('show');
          document.body.style.overflow = '';
        }
      });
    });

    // Login modal tabs
    document.querySelectorAll('.m3-dialog-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.m3-dialog-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.m3-tab-content').forEach(c => {
          c.classList.toggle('active', c.id === `tab${target.charAt(0).toUpperCase() + target.slice(1)}`);
        });
      });
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  /* ============ HEADER USER STATUS ============ */
  function updateUserHeader() {
    const state = window.AniApp.getState();
    const userLoggedOut = document.getElementById('userLoggedOut');
    const userLoggedIn = document.getElementById('userLoggedIn');
    const usernameEl = document.getElementById('username');
    const avatarEl = document.getElementById('avatar');
    const quickLoaderCard = document.getElementById('quickLoaderCard');

    if (state.user || state.username) {
      if (userLoggedOut) userLoggedOut.classList.add('hidden');
      if (userLoggedIn) userLoggedIn.classList.remove('hidden');
      if (usernameEl) usernameEl.textContent = state.user?.name || state.username;

      if (avatarEl) {
        if (state.user?.avatar?.large || state.user?.avatar?.medium) {
          avatarEl.style.backgroundImage = `url(${state.user.avatar.large || state.user.avatar.medium})`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
        } else {
          avatarEl.style.backgroundImage = 'none';
          avatarEl.style.backgroundColor = 'var(--md-sys-color-primary)';
          avatarEl.textContent = (state.username || 'U').charAt(0).toUpperCase();
        }
      }

      if (quickLoaderCard && state.media.length > 0) {
        quickLoaderCard.classList.add('hidden');
      }
    } else {
      if (userLoggedOut) userLoggedOut.classList.remove('hidden');
      if (userLoggedIn) userLoggedIn.classList.add('hidden');
      if (quickLoaderCard && state.media.length === 0) {
        quickLoaderCard.classList.remove('hidden');
      }
    }
  }

  /* ============ SEARCH AUTOCOMPLETE ============ */
  function setupSearchAutocomplete() {
    const searchInput = document.getElementById('headerSearchInput');
    const searchResults = document.getElementById('headerSearchResults');
    if (!searchInput || !searchResults) return;

    let debounceTimer = null;

    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = searchInput.value.trim();
      if (!query) {
        searchResults.classList.remove('show');
        return;
      }
      debounceTimer = setTimeout(() => executeSearch(query), 300);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.m3-search-bar-wrap')) {
        searchResults.classList.remove('show');
      }
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length > 1 && searchResults.children.length > 0) {
        searchResults.classList.add('show');
      }
    });
  }

  async function executeSearch(query) {
    const searchResults = document.getElementById('headerSearchResults');
    if (!searchResults) return;

    searchResults.innerHTML = `
      <div class="search-loading" style="padding: 16px; text-align: center; font-size: 13px; color: var(--md-sys-color-on-surface-variant);">
        <span>Searching AniList...</span>
      </div>
    `;
    searchResults.classList.add('show');

    try {
      const state = window.AniApp.getState();
      const type = state.mediaType || 'ANIME';
      const results = await window.AniApi.searchMedia(query, type, 1, 8);

      if (!results || !results.length) {
        searchResults.innerHTML = '<div style="padding: 16px; text-align: center; font-size: 13px; color: var(--md-sys-color-on-surface-variant);">No results found</div>';
        return;
      }

      const icons = window.AniIcons;
      searchResults.innerHTML = results.map(item => {
        const title = item.title?.english || item.title?.romaji || 'Unknown';
        const cover = item.coverImage?.large || item.coverImage?.medium || '';
        const year = item.seasonYear || '';
        const format = item.format || 'Anime';
        const score = item.averageScore ? `${item.averageScore}%` : '';

        return `
          <div class="search-item" data-id="${item.id}">
            <img src="${cover}" alt="${esc(title)}" class="search-item-cover">
            <div class="search-item-info">
              <div class="search-item-title">${esc(title)}</div>
              <div class="search-item-meta">${format} ${year ? '· ' + year : ''} ${score ? '· ' + score : ''}</div>
            </div>
            <button class="search-item-quick-add" title="Add to Unranked" data-id="${item.id}">
              ${icons.get('plus')}
            </button>
          </div>
        `;
      }).join('');

      searchResults.querySelectorAll('.search-item').forEach(el => {
        const id = el.dataset.id;
        const item = results.find(r => String(r.id) === String(id));

        el.addEventListener('click', (e) => {
          if (e.target.closest('.search-item-quick-add')) {
            e.stopPropagation();
            if (item) {
              window.AniTierList.addMediaToUnranked({
                id: item.id,
                title: item.title?.english || item.title?.romaji || 'Item',
                cover: item.coverImage?.extraLarge || item.coverImage?.large || '',
                score: item.averageScore || 0,
                format: item.format || 'ANIME',
                type: item.type || 'ANIME'
              });
            }
            return;
          }

          if (item) {
            searchResults.classList.remove('show');
            window.AniMediaModal.open(item.id, item);
          }
        });
      });
    } catch (err) {
      console.error('Search error:', err);
      searchResults.innerHTML = '<div style="padding: 16px; text-align: center; font-size: 13px; color: var(--md-sys-color-on-surface-variant);">Search query failed</div>';
    }
  }

  /* ============ TOAST (M3 SNACKBAR) ============ */
  function showToast(msg, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'm3-snackbar';
      document.body.appendChild(toast);
    }

    const icons = window.AniIcons;
    toast.innerHTML = (isError ? icons.get('close') : icons.get('check')) + `<span>${esc(msg)}</span>`;
    toast.className = `m3-snackbar show ${isError ? 'error' : ''}`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    showToast,
    openModal,
    closeModal,
    updateUserHeader,
    setTheme,
    esc
  };
})();
