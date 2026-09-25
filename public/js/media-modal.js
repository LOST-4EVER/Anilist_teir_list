/**
 * Media Details Modal & AniList List Manager
 */
window.AniMediaModal = (function () {
  'use strict';

  let currentMedia = null;
  let modalEl = null;

  function init() {
    modalEl = document.getElementById('mediaDetailsModal');
    if (!modalEl) return;

    // Close on backdrop or close button
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl || e.target.closest('.modal-close') || e.target.closest('.m3-dialog-close-btn')) {
        close();
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.classList.contains('show')) {
        close();
      }
    });
  }

  async function open(mediaId, optionalInitialData = null) {
    if (!modalEl) init();
    if (!modalEl) return;

    const icons = window.AniIcons;
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Render loading state
    const modalBody = modalEl.querySelector('.modal-media-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="media-modal-loading">
          <div class="spinner"></div>
          <p>Loading media details from AniList...</p>
        </div>
      `;
    }

    try {
      const token = window.AniApp.getState().token;
      const media = await window.AniApi.fetchMediaDetails(mediaId, token);
      currentMedia = media;
      renderMediaDetails(media);
    } catch (err) {
      console.error('Failed to fetch media details:', err);
      if (optionalInitialData) {
        currentMedia = optionalInitialData;
        renderMediaDetails(optionalInitialData);
      } else {
        modalBody.innerHTML = `
          <div class="media-modal-error">
            <p>Could not load media details.</p>
            <button class="btn-secondary" onclick="window.AniMediaModal.close()">Close</button>
          </div>
        `;
      }
    }
  }

  function close() {
    if (modalEl) {
      modalEl.classList.remove('show');
      document.body.style.overflow = '';
      currentMedia = null;
    }
  }

  function renderMediaDetails(media) {
    const modalBody = modalEl.querySelector('.modal-media-body');
    if (!modalBody) return;

    const icons = window.AniIcons;
    const state = window.AniApp.getState();
    const isTokenAuth = !!state.token;

    const titlePrimary = media.title?.english || media.title?.romaji || media.title?.native || 'Unknown Title';
    const titleSecondary = media.title?.romaji !== titlePrimary ? media.title?.romaji : (media.title?.native || '');
    const coverUrl = media.coverImage?.extraLarge || media.coverImage?.large || media.cover || '';
    const bannerUrl = media.bannerImage || '';
    const avgScore = media.averageScore || media.meanScore || media.score || 0;
    const format = media.format || 'ANIME';
    const episodes = media.episodes ? `${media.episodes} eps` : (media.chapters ? `${media.chapters} chs` : 'Unknown length');
    const studio = media.studios?.nodes?.[0]?.name || '';
    const seasonYear = media.seasonYear ? `${media.season || ''} ${media.seasonYear}` : (media.startDate?.year || '');
    const description = media.description ? media.description.replace(/<[^>]+>/g, '') : 'No description available.';
    const genres = media.genres || [];
    const isFavourite = !!media.isFavourite;

    // Check existing list entry
    const existingEntry = media.mediaListEntry || state.rawCollection.find(e => String(e.id) === String(media.id)) || null;
    const currentStatus = existingEntry?.status || 'PLANNING';
    const currentScore = existingEntry?.score || 0;
    const currentProgress = existingEntry?.progress || 0;
    const currentNotes = existingEntry?.notes || '';
    const maxProgress = media.episodes || media.chapters || 9999;

    // Check if media is currently in tier list
    const inTierItem = state.media.find(m => String(m.id) === String(media.id));
    const currentTierId = inTierItem?.tier || '';

    let trailerHtml = '';
    if (media.trailer && media.trailer.site === 'youtube') {
      trailerHtml = `
        <a href="https://www.youtube.com/watch?v=${media.trailer.id}" target="_blank" rel="noopener" class="btn-secondary btn-sm trailer-btn">
          ${icons.get('play')} Watch Trailer
        </a>
      `;
    }

    modalBody.innerHTML = `
      <div class="media-modal-header" style="${bannerUrl ? `background-image: linear-gradient(to bottom, rgba(15,17,21,0.4), var(--modal-bg)), url('${bannerUrl}');` : ''}">
        <div class="media-modal-cover-wrap">
          <img src="${coverUrl}" alt="${titlePrimary}" class="media-modal-cover">
          ${avgScore ? `<div class="media-modal-score-badge">${icons.get('star')} ${avgScore}%</div>` : ''}
        </div>
        <div class="media-modal-titles">
          <h2 class="media-modal-title">${titlePrimary}</h2>
          ${titleSecondary ? `<div class="media-modal-subtitle">${titleSecondary}</div>` : ''}
          <div class="media-modal-meta-tags">
            <span class="meta-tag format">${format}</span>
            <span class="meta-tag eps">${episodes}</span>
            ${seasonYear ? `<span class="meta-tag year">${seasonYear}</span>` : ''}
            ${studio ? `<span class="meta-tag studio">${studio}</span>` : ''}
            ${media.status ? `<span class="meta-tag status">${media.status}</span>` : ''}
          </div>
          <div class="media-modal-header-actions">
            ${trailerHtml}
            <a href="https://anilist.co/${media.type ? media.type.toLowerCase() : 'anime'}/${media.id}" target="_blank" rel="noopener" class="btn-secondary btn-sm">
              ${icons.get('anilist')} AniList ${icons.get('externalLink')}
            </a>
            ${isTokenAuth ? `
              <button class="btn-secondary btn-sm fav-toggle-btn ${isFavourite ? 'active' : ''}" id="modalFavBtn">
                ${isFavourite ? icons.get('heartFilled') : icons.get('heart')}
                <span id="favBtnLabel">${isFavourite ? 'Favourited' : 'Favourite'}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="media-modal-content">
        <div class="media-modal-left">
          <div class="media-section">
            <h4 class="media-section-title">${icons.get('info')} Synopsis</h4>
            <p class="media-modal-desc">${description}</p>
          </div>

          ${genres.length ? `
            <div class="media-section">
              <h4 class="media-section-title">${icons.get('spark')} Genres</h4>
              <div class="media-modal-genres">
                ${genres.map(g => `<span class="genre-pill">${g}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="media-modal-right">
          <!-- Tier List Quick Placement -->
          <div class="modal-card tier-card-box">
            <h4 class="card-title">${icons.get('trophy')} Tier List Placement</h4>
            <div class="tier-select-row">
              <select id="modalTierSelect" class="form-select">
                <option value="">Unranked Pool</option>
                ${state.tiers.map(t => `<option value="${t.id}" ${t.id === currentTierId ? 'selected' : ''}>Tier ${t.label}</option>`).join('')}
              </select>
              <button class="btn-primary btn-sm" id="modalSaveTierBtn">
                ${icons.get('check')} Update Tier
              </button>
            </div>
          </div>

          <!-- AniList List Tracker Form -->
          <div class="modal-card anilist-card-box">
            <div class="card-header-flex">
              <h4 class="card-title">${icons.get('anilist')} AniList Collection Status</h4>
              ${!isTokenAuth ? `<span class="guest-badge">Web / Local Mode</span>` : `<span class="sync-badge">${icons.get('check')} Live Sync</span>`}
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <select id="modalListStatus" class="form-select">
                <option value="CURRENT" ${currentStatus === 'CURRENT' ? 'selected' : ''}>Watching / Reading</option>
                <option value="COMPLETED" ${currentStatus === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                <option value="PLANNING" ${currentStatus === 'PLANNING' ? 'selected' : ''}>Planning</option>
                <option value="PAUSED" ${currentStatus === 'PAUSED' ? 'selected' : ''}>Paused</option>
                <option value="DROPPED" ${currentStatus === 'DROPPED' ? 'selected' : ''}>Dropped</option>
                <option value="REPEATING" ${currentStatus === 'REPEATING' ? 'selected' : ''}>Repeating / Rewatching</option>
              </select>
            </div>

            <div class="form-row-two">
              <div class="form-group">
                <label class="form-label">Score (0 - 100)</label>
                <input type="number" id="modalScoreInput" class="form-input" min="0" max="100" step="1" value="${currentScore || ''}" placeholder="0-100">
              </div>

              <div class="form-group">
                <label class="form-label">Progress (${media.type === 'MANGA' ? 'Chapters' : 'Episodes'})</label>
                <div class="progress-stepper">
                  <button type="button" class="btn-stepper" id="progMinusBtn">${icons.get('minus')}</button>
                  <input type="number" id="modalProgressInput" class="form-input text-center" min="0" max="${maxProgress}" value="${currentProgress}">
                  <button type="button" class="btn-stepper" id="progPlusBtn">${icons.get('plus')}</button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Personal Notes</label>
              <textarea id="modalNotesInput" class="form-textarea" rows="2" placeholder="Thoughts, rating notes, favorite moments...">${currentNotes}</textarea>
            </div>

            <button class="btn-anilist-save" id="modalSaveAniListBtn">
              ${icons.get('spark')} ${isTokenAuth ? 'Save & Sync to AniList' : 'Update in Local Collection'}
            </button>
          </div>
        </div>
      </div>
    `;

    attachModalEventListeners(media, currentTierId);
  }

  function attachModalEventListeners(media, currentTierId) {
    const state = window.AniApp.getState();
    const token = state.token;

    // Progress stepper buttons
    const progInput = document.getElementById('modalProgressInput');
    const plusBtn = document.getElementById('progPlusBtn');
    const minusBtn = document.getElementById('progMinusBtn');

    if (plusBtn && progInput) {
      plusBtn.addEventListener('click', () => {
        progInput.value = (parseInt(progInput.value, 10) || 0) + 1;
      });
    }
    if (minusBtn && progInput) {
      minusBtn.addEventListener('click', () => {
        const val = (parseInt(progInput.value, 10) || 0) - 1;
        progInput.value = Math.max(0, val);
      });
    }

    // Favourite toggle button
    const favBtn = document.getElementById('modalFavBtn');
    if (favBtn && token) {
      favBtn.addEventListener('click', async () => {
        try {
          favBtn.disabled = true;
          const isAnime = (media.type || 'ANIME') === 'ANIME';
          await window.AniApi.toggleFavourite(isAnime ? { animeId: media.id } : { mangaId: media.id }, token);
          media.isFavourite = !media.isFavourite;
          favBtn.classList.toggle('active', media.isFavourite);
          const label = document.getElementById('favBtnLabel');
          if (label) label.textContent = media.isFavourite ? 'Favourited' : 'Favourite';
          favBtn.innerHTML = (media.isFavourite ? window.AniIcons.get('heartFilled') : window.AniIcons.get('heart')) + `<span id="favBtnLabel">${media.isFavourite ? 'Favourited' : 'Favourite'}</span>`;
          window.AniUI.showToast(media.isFavourite ? 'Added to AniList favourites' : 'Removed from favourites');
        } catch (err) {
          console.error(err);
          window.AniUI.showToast(err.message || 'Failed to toggle favourite', true);
        } finally {
          favBtn.disabled = false;
        }
      });
    }

    // Save Tier Placement
    const saveTierBtn = document.getElementById('modalSaveTierBtn');
    const tierSelect = document.getElementById('modalTierSelect');
    if (saveTierBtn && tierSelect) {
      saveTierBtn.addEventListener('click', () => {
        const selectedTier = tierSelect.value || null;
        window.AniTierList.setMediaTier(media, selectedTier);
        window.AniUI.showToast(selectedTier ? `Placed in Tier ${window.AniTierList.getTierLabel(selectedTier)}` : 'Moved to unranked pool');
      });
    }

    // Save to AniList / Local Collection
    const saveAniListBtn = document.getElementById('modalSaveAniListBtn');
    if (saveAniListBtn) {
      saveAniListBtn.addEventListener('click', async () => {
        const status = document.getElementById('modalListStatus')?.value || 'CURRENT';
        const score = parseFloat(document.getElementById('modalScoreInput')?.value) || 0;
        const progress = parseInt(document.getElementById('modalProgressInput')?.value, 10) || 0;
        const notes = document.getElementById('modalNotesInput')?.value || '';

        saveAniListBtn.disabled = true;
        saveAniListBtn.textContent = 'Saving...';

        try {
          if (token) {
            await window.AniApi.saveMediaListEntry({
              mediaId: media.id,
              status,
              score,
              progress,
              notes
            }, token);
            window.AniUI.showToast(`Updated "${media.title?.english || media.title?.romaji || 'Item'}" on AniList!`);
          } else {
            window.AniUI.showToast(`Saved to local collection!`);
          }

          // Update local state collection
          window.AniApp.updateMediaItemLocal({
            id: media.id,
            title: media.title?.english || media.title?.romaji || 'Item',
            cover: media.coverImage?.extraLarge || media.coverImage?.large || '',
            score: score || media.averageScore || 0,
            status,
            progress,
            format: media.format || 'ANIME',
            type: media.type || 'ANIME'
          });

          saveAniListBtn.disabled = false;
          saveAniListBtn.textContent = 'Saved Successfully!';
          setTimeout(() => {
            if (saveAniListBtn) saveAniListBtn.textContent = token ? 'Save & Sync to AniList' : 'Update in Local Collection';
          }, 2000);
        } catch (err) {
          console.error(err);
          window.AniUI.showToast(err.message || 'Failed to save entry', true);
          saveAniListBtn.disabled = false;
          saveAniListBtn.textContent = 'Try Again';
        }
      });
    }
  }

  return {
    init,
    open,
    close
  };
})();
