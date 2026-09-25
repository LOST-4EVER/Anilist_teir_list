/**
 * Tier List Image & Data Export Module
 */
window.AniExport = (function () {
  'use strict';

  function init() {
    const exportImageBtn = document.getElementById('exportImageBtn');
    if (exportImageBtn) exportImageBtn.addEventListener('click', exportImage);

    const headerExportBtn = document.getElementById('headerExportImageBtn');
    if (headerExportBtn) headerExportBtn.addEventListener('click', exportImage);

    const exportJsonBtn = document.getElementById('exportBtn');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);

    const importJsonInput = document.getElementById('importJsonInput');
    if (importJsonInput) {
      importJsonInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) importJSON(file);
      });
    }
  }

  async function exportImage() {
    const container = document.getElementById('tierContainer');
    if (!container || !container.children.length) {
      window.AniUI.showToast('No tiers available to export', true);
      return;
    }

    const state = window.AniApp.getState();
    window.AniUI.showToast('Rendering high-resolution tier list image...');

    if (typeof html2canvas !== 'function') {
      window.AniUI.showToast('Image generator loading, please retry in a moment', true);
      return;
    }

    try {
      // Temporarily create a clean wrapper for export with watermark & title
      const exportWrapper = document.createElement('div');
      exportWrapper.className = 'export-render-box';
      exportWrapper.style.padding = '24px';
      exportWrapper.style.backgroundColor = document.documentElement.getAttribute('data-theme') === 'light' ? '#f7f9fd' : '#0f1419';
      exportWrapper.style.width = `${Math.max(900, container.offsetWidth + 48)}px`;
      exportWrapper.style.boxSizing = 'border-box';
      exportWrapper.style.borderRadius = '16px';
      exportWrapper.style.position = 'fixed';
      exportWrapper.style.left = '-9999px';
      exportWrapper.style.top = '0';

      // Header watermark
      const headerBox = document.createElement('div');
      headerBox.style.display = 'flex';
      headerBox.style.justifyContent = 'space-between';
      headerBox.style.alignItems = 'center';
      headerBox.style.marginBottom = '20px';
      headerBox.style.paddingBottom = '14px';
      headerBox.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '24px';
      titleEl.style.fontWeight = '800';
      titleEl.style.color = '#78d1ff';
      titleEl.textContent = state.username ? `${state.username}'s AniList Tier List` : 'AniList Tier List';

      const logoEl = document.createElement('div');
      logoEl.style.fontSize = '14px';
      logoEl.style.color = '#8b99a6';
      logoEl.style.fontWeight = '600';
      logoEl.textContent = 'Created with AniTier';

      headerBox.appendChild(titleEl);
      headerBox.appendChild(logoEl);
      exportWrapper.appendChild(headerBox);

      // Clone tier container
      const clone = container.cloneNode(true);
      // Remove any interactive tools or inputs from clone
      clone.querySelectorAll('.label-tools, .item-remove, .item-quick-move, .color-picker-input, .quick-move-popover').forEach(el => el.remove());

      // Convert cover images to data URLs to ensure html2canvas never suffers from CORS taint on static hosts (GitHub Pages) or local servers
      const imgElements = Array.from(clone.querySelectorAll('img'));
      await Promise.all(imgElements.map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        const originalSrc = img.src;
        try {
          // Direct fetch (AniList CDN supports CORS)
          const res = await fetch(originalSrc, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            img.src = dataUrl;
            return;
          }
        } catch (fetchErr) {
          // If direct fetch fails (e.g. strict CORS), try local server proxy if available
          try {
            const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(originalSrc)}`);
            if (proxyRes.ok) {
              const blob = await proxyRes.blob();
              const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              img.src = dataUrl;
              return;
            }
          } catch (proxyErr) {
            console.warn('Proxy image convert failed:', proxyErr);
          }
        }
        img.crossOrigin = 'anonymous';
      }));

      exportWrapper.appendChild(clone);
      document.body.appendChild(exportWrapper);

      const canvas = await html2canvas(exportWrapper, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#f7f9fd' : '#0f1419',
        logging: false
      });

      document.body.removeChild(exportWrapper);

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const filename = `anitier-${(state.username || 'tierlist').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.AniUI.showToast('Tier list PNG saved successfully!');
    } catch (err) {
      console.error('Export image error:', err);
      window.AniUI.showToast('Export failed. Check browser permissions.', true);
    }
  }

  function exportJSON() {
    const state = window.AniApp.getState();
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: state.user,
      username: state.username,
      mediaType: state.mediaType,
      tiers: state.tiers,
      media: state.media
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anitier-${(state.username || 'tierlist').toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.AniUI.showToast('Exported tier list as JSON');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.tiers && Array.isArray(data.tiers)) {
          const state = window.AniApp.getState();
          state.tiers = data.tiers;
          if (Array.isArray(data.media)) state.media = data.media;
          if (data.username) state.username = data.username;
          if (data.user) state.user = data.user;
          if (data.mediaType) state.mediaType = data.mediaType;

          window.AniApp.persist();
          window.AniTierList.renderAll();
          window.AniUI.updateUserHeader();
          window.AniUI.showToast('Imported tier list successfully!');
        } else {
          window.AniUI.showToast('Invalid tier list JSON format', true);
        }
      } catch (err) {
        console.error('Import parse error:', err);
        window.AniUI.showToast('Failed to parse JSON file', true);
      }
    };
    reader.readAsText(file);
  }

  return {
    init,
    exportImage,
    exportJSON,
    importJSON
  };
})();
