/**
 * AniList Discovery & Explorer Module
 */
window.AniExplorer = (function () {
  'use strict';

  let currentCategory = 'TRENDING';
  let currentGenre = 'ALL';
  let currentPage = 1;
  let isLoading = false;
  let itemsCache = [];

  const GENRES = [
    'ALL', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery',
    'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
  ];

  function init() {
    setupExplorerUI();
  }

  function setupExplorerUI() {
    const genreContainer = document.getElementById('explorerGenrePills');
    if (genreContainer) {
      genreContainer.innerHTML = GENRES.map(g => `
        <button class="genre-filter-pill ${g === currentGenre ? 'active' : ''}" data-genre="${g}">
          ${g === 'ALL' ? 'All Genres' : g}
        </button>
      `).join('');

      genreContainer.querySelectorAll('.genre-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          genreContainer.querySelectorAll('.genre-filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          currentGenre = pill.dataset.genre;
          currentPage = 1;
          loadBrowseItems();
        });
      });
    }

    // Category Buttons
    document.querySelectorAll('.browse-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.browse-category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        currentPage = 1;
        loadBrowseItems();
      });
    });

    // Refresh button
    const refreshBtn = document.getElementById('explorerRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        currentPage = 1;
        loadBrowseItems();
      });
    }
  }

  async function loadBrowseItems() {
    const grid = document.getElementById('explorerGrid');
    if (!grid) return;

    if (isLoading) return;
    isLoading = true;

    grid.innerHTML = `
      <div class="explorer-loading-state">
        <div class="spinner"></div>
        <p>Fetching top titles from AniList...</p>
      </div>
    `;

    try {
      const state = window.AniApp.getState();
      const type = state.mediaType || 'ANIME';

      const items = await window.AniApi.fetchBrowseList({
        category: currentCategory,
        type,
        page: currentPage,
        perPage: 28,
        genre: currentGenre
      });

      itemsCache = items;
      renderGrid(items);
    } catch (err) {
      console.error('Failed to load explorer items:', err);
      grid.innerHTML = `
        <div class="explorer-error-state">
          <p>Failed to load AniList titles. Check connection.</p>
          <button class="btn-secondary btn-sm" onclick="window.AniExplorer.loadBrowseItems()">Retry</button>
        </div>
      `;
    } finally {
      isLoading = false;
    }
  }

  function renderGrid(items) {
    const grid = document.getElementById('explorerGrid');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `
        <div class="explorer-empty-state">
          <p>No titles found matching this criteria.</p>
        </div>
      `;
      return;
    }

    const icons = window.AniIcons;
    const state = window.AniApp.getState();

    grid.innerHTML = items.map(item => {
      const title = item.title?.english || item.title?.romaji || 'Unknown';
      const cover = item.coverImage?.extraLarge || item.coverImage?.large || '';
      const score = item.averageScore || 0;
      const format = item.format || (item.type === 'MANGA' ? 'Manga' : 'Anime');
      const year = item.seasonYear || '';
      const eps = item.episodes ? `${item.episodes} eps` : (item.chapters ? `${item.chapters} chs` : '');
      const isInTierList = state.media.some(m => String(m.id) === String(item.id));

      return `
        <div class="explorer-card" data-id="${item.id}">
          <div class="explorer-card-cover-wrap">
            <img src="${cover}" alt="${window.AniUI.esc(title)}" class="explorer-card-cover" loading="lazy">
            <div class="explorer-card-badges">
              ${score ? `<span class="score-badge">${icons.get('star')} ${score}%</span>` : ''}
              <span class="format-badge">${format}</span>
            </div>
            <div class="explorer-card-overlay">
              <button class="card-action-btn inspect-btn" title="View Details" data-action="inspect" data-id="${item.id}">
                ${icons.get('info')} Details
              </button>
              <button class="card-action-btn add-btn ${isInTierList ? 'added' : ''}" title="${isInTierList ? 'In Tier List' : 'Add to Tier List'}" data-action="add" data-id="${item.id}">
                ${isInTierList ? icons.get('check') + ' Added' : icons.get('plus') + ' Add to Tier'}
              </button>
            </div>
          </div>
          <div class="explorer-card-meta">
            <div class="explorer-card-title" title="${window.AniUI.esc(title)}">${window.AniUI.esc(title)}</div>
            <div class="explorer-card-sub">${year} ${eps ? '· ' + eps : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events
    grid.querySelectorAll('.explorer-card').forEach(card => {
      const mediaId = card.dataset.id;
      const mediaItem = items.find(m => String(m.id) === mediaId);

      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.card-action-btn');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          if (action === 'inspect') {
            window.AniMediaModal.open(mediaId, mediaItem);
          } else if (action === 'add') {
            if (mediaItem) {
              window.AniTierList.addMediaToUnranked({
                id: mediaItem.id,
                title: mediaItem.title?.english || mediaItem.title?.romaji || 'Item',
                cover: mediaItem.coverImage?.extraLarge || mediaItem.coverImage?.large || '',
                score: mediaItem.averageScore || 0,
                format: mediaItem.format || 'ANIME',
                type: mediaItem.type || 'ANIME'
              });
              actionBtn.classList.add('added');
              actionBtn.innerHTML = icons.get('check') + ' Added';
            }
          }
          return;
        }

        // Default card click opens modal inspector
        window.AniMediaModal.open(mediaId, mediaItem);
      });
    });
  }

  return {
    init,
    loadBrowseItems
  };
})();
