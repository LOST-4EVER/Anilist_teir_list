/**
 * AniTier - Tier List Core Engine & Drag-Drop Manager
 */
window.AniTierList = (function () {
  'use strict';

  const TIER_COLORS = [
    '#FF4D4D', '#FF8C42', '#FFD700', '#7BC950',
    '#4DB8FF', '#9B7BFF', '#F75BB8', '#8B99A8',
    '#26C6DA', '#66BB6A', '#FF7043', '#AB47BC'
  ];

  let draggedMediaId = null;
  let draggedEl = null;

  function defaultTiers() {
    return [
      { id: 'tier-s', label: 'S', color: '#FF6B6B' },
      { id: 'tier-a', label: 'A', color: '#FFA94D' },
      { id: 'tier-b', label: 'B', color: '#FFD43B' },
      { id: 'tier-c', label: 'C', color: '#82C91E' },
      { id: 'tier-d', label: 'D', color: '#4DABF7' },
      { id: 'tier-f', label: 'F', color: '#868E96' }
    ];
  }

  function init() {
    setupTierControls();
  }

  function setupTierControls() {
    const addTierBtn = document.getElementById('addTierBtn');
    if (addTierBtn) addTierBtn.addEventListener('click', addTier);

    const autoRankBtn = document.getElementById('autoRankBtn');
    if (autoRankBtn) autoRankBtn.addEventListener('click', autoRankByScore);

    const clearPlacementsBtn = document.getElementById('clearPlacementsBtn');
    if (clearPlacementsBtn) clearPlacementsBtn.addEventListener('click', clearPlacements);

    const clearUnrankedBtn = document.getElementById('clearUnrankedBtn');
    if (clearUnrankedBtn) clearUnrankedBtn.addEventListener('click', clearUnranked);

    const clearEntireListBtn = document.getElementById('clearEntireListBtn');
    if (clearEntireListBtn) clearEntireListBtn.addEventListener('click', deleteEntireList);

    const unrankedSortSelect = document.getElementById('unrankedSortSelect');
    if (unrankedSortSelect) {
      unrankedSortSelect.addEventListener('change', () => {
        window.AniApp.getState().sortUnranked = unrankedSortSelect.value;
        renderUnranked();
      });
    }
  }

  function renderTiers() {
    const container = document.getElementById('tierContainer');
    if (!container) return;

    const state = window.AniApp.getState();
    const icons = window.AniIcons;
    container.innerHTML = '';

    state.tiers.forEach((tier, index) => {
      const mediaInTier = state.media.filter(m => m.tier === tier.id);

      const row = document.createElement('div');
      row.className = 'tier-row';
      row.dataset.tierId = tier.id;

      // Tier Label Container
      const labelContainer = document.createElement('div');
      labelContainer.className = 'tier-label';
      labelContainer.style.backgroundColor = tier.color || '#FF6B6B';

      const labelText = document.createElement('span');
      labelText.className = `tier-label-text ${getLabelLengthClass(tier.label)}`;
      labelText.textContent = tier.label;
      labelContainer.appendChild(labelText);

      // Label Tools (Color picker, Up, Down, Delete)
      const tools = document.createElement('div');
      tools.className = 'label-tools';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = tier.color || '#FF6B6B';
      colorInput.className = 'color-picker-input';

      const colorBtn = document.createElement('button');
      colorBtn.className = 'label-btn color-btn';
      colorBtn.title = 'Change Color';
      colorBtn.innerHTML = icons.get('palette');
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorInput.click();
      });

      colorInput.addEventListener('input', (e) => {
        tier.color = e.target.value;
        labelContainer.style.backgroundColor = tier.color;
        window.AniApp.persist();
      });

      const moveUpBtn = document.createElement('button');
      moveUpBtn.className = 'label-btn move-btn';
      moveUpBtn.title = 'Move Tier Up';
      moveUpBtn.innerHTML = icons.get('chevronUp');
      moveUpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTier(tier.id, -1);
      });

      const moveDownBtn = document.createElement('button');
      moveDownBtn.className = 'label-btn move-btn';
      moveDownBtn.title = 'Move Tier Down';
      moveDownBtn.innerHTML = icons.get('chevronDown');
      moveDownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveTier(tier.id, 1);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'label-btn delete-btn';
      deleteBtn.title = 'Delete Tier Row';
      deleteBtn.innerHTML = icons.get('trash');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTier(tier.id, row);
      });

      if (index > 0) tools.appendChild(moveUpBtn);
      if (index < state.tiers.length - 1) tools.appendChild(moveDownBtn);
      tools.appendChild(colorBtn);
      tools.appendChild(deleteBtn);
      labelContainer.appendChild(tools);
      labelContainer.appendChild(colorInput);

      // Tier Items Dropzone
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tier-items';
      itemsContainer.dataset.tierId = tier.id;

      mediaInTier.forEach(m => {
        itemsContainer.appendChild(createItemElement(m));
      });

      row.appendChild(labelContainer);
      row.appendChild(itemsContainer);
      container.appendChild(row);

      attachLabelEdit(labelContainer, tier);
    });

    attachDragEvents();
  }

  function renderUnranked() {
    const grid = document.getElementById('unrankedGrid');
    const badge = document.getElementById('unrankedCountBadge');
    if (!grid) return;

    const state = window.AniApp.getState();
    let unranked = state.media.filter(m => !m.tier);

    const sortMode = state.sortUnranked || 'default';
    if (sortMode === 'score') {
      unranked = [...unranked].sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortMode === 'title') {
      unranked = [...unranked].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    grid.innerHTML = '';
    unranked.forEach(m => {
      grid.appendChild(createItemElement(m));
    });

    if (badge) badge.textContent = unranked.length;
    attachDragEvents();
  }

  function renderAll() {
    renderTiers();
    renderUnranked();
    updateCollectionCounts();
  }

  function createItemElement(media) {
    const icons = window.AniIcons;
    const item = document.createElement('div');
    item.className = 'tier-item';
    item.draggable = true;
    item.dataset.mediaId = media.id;

    const img = document.createElement('img');
    img.src = media.cover;
    img.alt = media.title || '';
    img.loading = 'lazy';
    img.className = 'item-cover';
    img.onerror = function () {
      this.style.opacity = '0.4';
    };

    item.appendChild(img);

    // Score badge if present
    if (media.score) {
      const scoreBadge = document.createElement('div');
      scoreBadge.className = 'item-score-tag';
      scoreBadge.textContent = `${media.score}%`;
      item.appendChild(scoreBadge);
    }

    // Quick remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'item-remove';
    removeBtn.title = 'Remove item';
    removeBtn.innerHTML = icons.get('close');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeMedia(media.id);
    });
    item.appendChild(removeBtn);

    // Quick Move Button (for tap/click without dragging)
    const quickMoveBtn = document.createElement('button');
    quickMoveBtn.className = 'item-quick-move';
    quickMoveBtn.title = 'Quick rank to tier';
    quickMoveBtn.innerHTML = icons.get('spark');
    quickMoveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickMoveMenu(item, media);
    });
    item.appendChild(quickMoveBtn);

    // Click on item cover opens rich modal inspector
    item.addEventListener('click', (e) => {
      if (e.target.closest('.item-remove') || e.target.closest('.item-quick-move') || e.target.closest('.quick-move-popover')) return;
      window.AniMediaModal.open(media.id, media);
    });

    // Tooltip
    attachTooltip(item, media);

    // Touch event handling for mobile devices
    attachTouchEvents(item);

    return item;
  }

  function showQuickMoveMenu(item, media) {
    // Remove any existing popover
    document.querySelectorAll('.quick-move-popover').forEach(p => p.remove());

    const state = window.AniApp.getState();
    const popover = document.createElement('div');
    popover.className = 'quick-move-popover';

    const titleEl = document.createElement('div');
    titleEl.className = 'quick-move-title';
    titleEl.textContent = 'Move to:';
    popover.appendChild(titleEl);

    // Tier buttons
    state.tiers.forEach(t => {
      const btn = document.createElement('button');
      btn.className = `quick-move-chip ${media.tier === t.id ? 'active' : ''}`;
      btn.style.borderColor = t.color;
      btn.textContent = t.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        media.tier = t.id;
        window.AniApp.persist();
        renderAll();
        window.AniUI.showToast(`Moved to Tier ${t.label}`);
        popover.remove();
      });
      popover.appendChild(btn);
    });

    // Unrank option if currently in a tier
    if (media.tier) {
      const unrankBtn = document.createElement('button');
      unrankBtn.className = 'quick-move-chip unrank';
      unrankBtn.textContent = 'Unrank';
      unrankBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        media.tier = null;
        window.AniApp.persist();
        renderAll();
        window.AniUI.showToast('Moved to unranked pool');
        popover.remove();
      });
      popover.appendChild(unrankBtn);
    }

    document.body.appendChild(popover);

    // Position popover
    const rect = item.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popover.offsetWidth / 2;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (left + popover.offsetWidth > window.innerWidth - 8) {
      left = window.innerWidth - popover.offsetWidth - 8;
    }
    if (top + popover.offsetHeight > window.innerHeight - 8) {
      top = rect.top - popover.offsetHeight - 6;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    const closeHandler = (e) => {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function attachTooltip(item, media) {
    let tooltip = null;

    item.addEventListener('mouseenter', () => {
      tooltip = document.createElement('div');
      tooltip.className = 'item-tooltip';
      tooltip.innerHTML = `
        <div class="tooltip-title">${window.AniUI.esc(media.title)}</div>
        <div class="tooltip-meta">
          <span>${media.format || 'Anime'}</span>
          ${media.score ? `<span>Score: ${media.score}%</span>` : ''}
          ${media.status ? `<span>${media.status}</span>` : ''}
        </div>
      `;
      document.body.appendChild(tooltip);
      positionTooltip(tooltip, item);
    });

    item.addEventListener('mousemove', () => {
      if (tooltip) positionTooltip(tooltip, item);
    });

    const removeTip = () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    };

    item.addEventListener('mouseleave', removeTip);
    item.addEventListener('dragstart', removeTip);
  }

  function positionTooltip(tooltip, item) {
    const rect = item.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
    let top = rect.top - tooltip.offsetHeight - 8;

    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + tooltip.offsetWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltip.offsetWidth - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function attachLabelEdit(labelEl, tier) {
    labelEl.addEventListener('click', (e) => {
      if (e.target.closest('.label-tools') || e.target.closest('.color-picker-input')) return;
      if (labelEl.querySelector('input[type="text"]')) return;

      const currentText = tier.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentText;
      input.maxLength = 40;
      input.className = 'tier-label-input';

      const textSpan = labelEl.querySelector('.tier-label-text');
      if (textSpan) textSpan.remove();

      labelEl.insertBefore(input, labelEl.querySelector('.label-tools'));
      input.focus();
      input.select();

      const commit = () => {
        tier.label = input.value.trim() || currentText;
        const newText = document.createElement('span');
        newText.className = `tier-label-text ${getLabelLengthClass(tier.label)}`;
        newText.textContent = tier.label;
        input.replaceWith(newText);
        window.AniApp.persist();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') {
          input.value = currentText;
          input.blur();
        }
      });
    });
  }

  /* ============ DRAG & DROP ============ */
  function attachDragEvents() {
    document.querySelectorAll('.tier-item').forEach(item => {
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragend', handleDragEnd);
    });

    document.querySelectorAll('.tier-items, .unranked-grid, .m3-unranked-grid, #unrankedGrid').forEach(dropzone => {
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('dragleave', handleDragLeave);
      dropzone.addEventListener('drop', handleDrop);
    });
  }

  function handleDragStart(e) {
    const item = e.target.closest('.tier-item');
    if (!item) return;
    draggedMediaId = item.dataset.mediaId;
    draggedEl = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedMediaId);
  }

  function handleDragEnd(e) {
    if (draggedEl) draggedEl.classList.remove('dragging');
    draggedEl = null;
    draggedMediaId = null;
    document.querySelectorAll('.tier-row').forEach(r => r.classList.remove('dragover'));
    document.querySelectorAll('.m3-unranked-surface, .unranked-section, .unranked-tray-wrapper').forEach(r => r.classList.remove('dragover'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.currentTarget.closest('.tier-row');
    if (row) row.classList.add('dragover');
    else {
      const surface = e.currentTarget.closest('.m3-unranked-surface, .unranked-tray-wrapper, .unranked-section');
      if (surface) surface.classList.add('dragover');
    }
  }

  function handleDragLeave(e) {
    const row = e.currentTarget.closest('.tier-row');
    if (row) row.classList.remove('dragover');
    else {
      const surface = e.currentTarget.closest('.m3-unranked-surface, .unranked-tray-wrapper, .unranked-section');
      if (surface) surface.classList.remove('dragover');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.tier-row').forEach(r => r.classList.remove('dragover'));
    document.querySelectorAll('.m3-unranked-surface, .unranked-tray-wrapper, .unranked-section').forEach(r => r.classList.remove('dragover'));

    const mediaId = e.dataTransfer.getData('text/plain') || draggedMediaId;
    if (!mediaId) return;

    const dropzone = e.currentTarget;
    const isUnranked = dropzone.classList.contains('unranked-grid') || dropzone.classList.contains('m3-unranked-grid') || dropzone.id === 'unrankedGrid';
    const targetTierId = isUnranked ? null : dropzone.dataset.tierId;

    const state = window.AniApp.getState();
    const media = state.media.find(m => String(m.id) === String(mediaId));
    if (!media) return;

    media.tier = targetTierId;
    window.AniApp.persist();
    renderAll();
    window.AniUI.showToast(targetTierId ? `Moved to tier ${getTierLabel(targetTierId)}` : 'Moved to unranked pool');
  }

  /* ============ MOBILE TOUCH DRAG SUPPORT ============ */
  function attachTouchEvents(item) {
    let touchGhost = null;
    let startX = 0, startY = 0;
    let isTouchDragging = false;

    item.addEventListener('touchstart', (e) => {
      if (e.target.closest('.item-remove') || e.target.closest('.item-quick-move')) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      draggedMediaId = item.dataset.mediaId;
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const moveX = touch.clientX - startX;
      const moveY = touch.clientY - startY;

      if (!isTouchDragging && (Math.abs(moveX) > 10 || Math.abs(moveY) > 10)) {
        isTouchDragging = true;
        item.classList.add('dragging');

        // Create ghost element
        touchGhost = item.cloneNode(true);
        touchGhost.classList.add('touch-drag-ghost');
        touchGhost.style.position = 'fixed';
        touchGhost.style.pointerEvents = 'none';
        touchGhost.style.zIndex = '9999';
        touchGhost.style.opacity = '0.85';
        touchGhost.style.transform = 'scale(1.1)';
        document.body.appendChild(touchGhost);
      }

      if (isTouchDragging && touchGhost) {
        touchGhost.style.left = `${touch.clientX - 35}px`;
        touchGhost.style.top = `${touch.clientY - 45}px`;

        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const row = elemBelow?.closest('.tier-row');
        document.querySelectorAll('.tier-row').forEach(r => r.classList.remove('dragover'));
        if (row) row.classList.add('dragover');
      }
    }, { passive: true });

    item.addEventListener('touchend', (e) => {
      if (touchGhost) {
        touchGhost.remove();
        touchGhost = null;
      }
      item.classList.remove('dragging');

      if (isTouchDragging) {
        isTouchDragging = false;
        const touch = e.changedTouches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropzone = elemBelow?.closest('.tier-items, .m3-unranked-grid, #unrankedGrid');

        document.querySelectorAll('.tier-row').forEach(r => r.classList.remove('dragover'));

        if (dropzone) {
          const isUnranked = dropzone.classList.contains('m3-unranked-grid') || dropzone.id === 'unrankedGrid';
          const targetTierId = isUnranked ? null : dropzone.dataset.tierId;

          const state = window.AniApp.getState();
          const media = state.media.find(m => String(m.id) === String(draggedMediaId));
          if (media) {
            media.tier = targetTierId;
            window.AniApp.persist();
            renderAll();
            window.AniUI.showToast(targetTierId ? `Moved to tier ${getTierLabel(targetTierId)}` : 'Moved to unranked pool');
          }
        }
      }
      draggedMediaId = null;
    });
  }

  /* ============ ACTIONS ============ */
  function addTier() {
    const state = window.AniApp.getState();
    const labels = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'SS', 'SSS', 'GOAT', 'Mid', 'Trash'];
    const used = state.tiers.map(t => t.label);
    const nextLabel = labels.find(l => !used.includes(l)) || `Tier ${state.tiers.length + 1}`;
    const nextColor = TIER_COLORS[state.tiers.length % TIER_COLORS.length];

    state.tiers.push({
      id: 'tier-' + Date.now(),
      label: nextLabel,
      color: nextColor
    });

    window.AniApp.persist();
    renderTiers();
    window.AniUI.showToast(`Added tier ${nextLabel}`);
  }

  function removeTier(tierId, rowEl) {
    const state = window.AniApp.getState();
    const idx = state.tiers.findIndex(t => t.id === tierId);
    if (idx === -1) return;

    state.tiers.splice(idx, 1);
    // Unrank any items in this tier
    state.media.forEach(m => {
      if (m.tier === tierId) m.tier = null;
    });

    window.AniApp.persist();
    renderAll();
    window.AniUI.showToast('Tier removed (items returned to unranked)');
  }

  function moveTier(tierId, direction) {
    const state = window.AniApp.getState();
    const idx = state.tiers.findIndex(t => t.id === tierId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.tiers.length) return;

    const temp = state.tiers[idx];
    state.tiers[idx] = state.tiers[targetIdx];
    state.tiers[targetIdx] = temp;

    window.AniApp.persist();
    renderTiers();
  }

  function setMediaTier(media, tierId) {
    const state = window.AniApp.getState();
    let item = state.media.find(m => String(m.id) === String(media.id));
    if (!item) {
      item = {
        id: media.id,
        title: media.title?.english || media.title?.romaji || media.title || 'Item',
        cover: media.coverImage?.extraLarge || media.coverImage?.large || media.cover || '',
        score: media.averageScore || media.score || 0,
        format: media.format || 'ANIME',
        type: media.type || 'ANIME',
        status: media.status || 'COMPLETED',
        tier: tierId
      };
      state.media.push(item);
    } else {
      item.tier = tierId;
    }

    window.AniApp.persist();
    renderAll();
  }

  function addMediaToUnranked(media) {
    const state = window.AniApp.getState();
    if (state.media.some(m => String(m.id) === String(media.id))) {
      window.AniUI.showToast('Already in your list');
      return;
    }

    state.media.push({
      id: media.id,
      title: media.title?.english || media.title?.romaji || media.title || 'Item',
      cover: media.coverImage?.extraLarge || media.coverImage?.large || media.cover || '',
      score: media.averageScore || media.score || 0,
      format: media.format || 'ANIME',
      type: media.type || 'ANIME',
      status: media.status || 'COMPLETED',
      tier: null
    });

    window.AniApp.persist();
    renderUnranked();
    updateCollectionCounts();
    window.AniUI.showToast('Added to unranked list');
  }

  function removeMedia(mediaId) {
    const state = window.AniApp.getState();
    const idx = state.media.findIndex(m => String(m.id) === String(mediaId));
    if (idx > -1) {
      state.media.splice(idx, 1);
      window.AniApp.persist();
      renderAll();
      window.AniUI.showToast('Removed from list');
    }
  }

  function autoRankByScore() {
    const state = window.AniApp.getState();
    if (!state.media.length) {
      window.AniUI.showToast('No items in collection to rank', true);
      return;
    }

    const tiers = state.tiers;
    if (!tiers.length) return;

    let rankedCount = 0;
    state.media.forEach(m => {
      let score = m.score || 0;
      // Normalize score: if score is on a 10-point scale (e.g. 8.5/10), scale to 85%
      if (score > 0 && score <= 10) {
        score = score * 10;
      } else if (score === 0 && m.averageScore) {
        score = m.averageScore;
      }

      let targetTier = tiers[tiers.length - 1]; // default lowest

      if (tiers.length >= 5) {
        if (score >= 88) targetTier = tiers[0];
        else if (score >= 78) targetTier = tiers[1];
        else if (score >= 68) targetTier = tiers[2];
        else if (score >= 58) targetTier = tiers[3];
        else targetTier = tiers[4];
      } else {
        const step = 100 / tiers.length;
        const index = Math.min(tiers.length - 1, Math.floor((100 - Math.max(1, score)) / step));
        targetTier = tiers[index];
      }

      if (targetTier) {
        m.tier = targetTier.id;
        rankedCount++;
      }
    });

    window.AniApp.persist();
    renderAll();
    window.AniUI.showToast(`Auto-ranked ${rankedCount} items by AniList scores!`);
  }

  function clearPlacements() {
    const state = window.AniApp.getState();
    const placed = state.media.filter(m => m.tier);
    if (!placed.length) {
      window.AniUI.showToast('No placed items to clear');
      return;
    }

    if (confirm(`Move all ${placed.length} ranked items back to the unranked pool?`)) {
      state.media.forEach(m => { m.tier = null; });
      window.AniApp.persist();
      renderAll();
      window.AniUI.showToast('All items returned to unranked pool');
    }
  }

  function clearUnranked() {
    const state = window.AniApp.getState();
    const unranked = state.media.filter(m => !m.tier);
    if (!unranked.length) {
      window.AniUI.showToast('Unranked pool is already empty');
      return;
    }

    if (confirm(`Remove ${unranked.length} unranked items from list?`)) {
      state.media = state.media.filter(m => m.tier);
      window.AniApp.persist();
      renderAll();
      window.AniUI.showToast('Cleared unranked items');
    }
  }

  function deleteEntireList() {
    const state = window.AniApp.getState();
    if (!state.media.length) {
      window.AniUI.showToast('List is already empty');
      return;
    }

    if (confirm('Are you sure you want to completely clear and delete your entire list?')) {
      state.media = [];
      state.rawCollection = [];
      window.AniApp.persist();
      renderAll();
      window.AniUI.showToast('Entire list cleared');
    }
  }

  function updateCollectionCounts() {
    const state = window.AniApp.getState();
    const badgeEl = document.getElementById('unrankedCountBadge');

    // Status filter breakdown
    const counts = { ALL: 0, COMPLETED: 0, CURRENT: 0, PLANNING: 0, PAUSED: 0, DROPPED: 0 };
    state.rawCollection.forEach(item => {
      if (item.type === state.mediaType) {
        counts.ALL++;
        if (counts[item.status] !== undefined) counts[item.status]++;
      }
    });

    Object.keys(counts).forEach(st => {
      const el = document.getElementById(`count-${st}`);
      if (el) el.textContent = counts[st];
    });

    const unranked = state.media.filter(m => !m.tier);
    if (badgeEl) badgeEl.textContent = unranked.length;
  }

  function getTierLabel(tierId) {
    const state = window.AniApp.getState();
    const tier = state.tiers.find(t => t.id === tierId);
    return tier ? tier.label : '';
  }

  function getLabelLengthClass(label) {
    const len = (label || '').length;
    if (len <= 3) return 'length-short';
    if (len <= 8) return 'length-medium';
    if (len <= 16) return 'length-long';
    return 'length-xlong';
  }

  return {
    init,
    defaultTiers,
    renderTiers,
    renderUnranked,
    renderAll,
    addTier,
    removeTier,
    setMediaTier,
    addMediaToUnranked,
    removeMedia,
    autoRankByScore,
    clearPlacements,
    clearUnranked,
    deleteEntireList,
    getTierLabel
  };
})();
