/**
 * AniTier Authentication Manager
 */
window.AniAuth = (function () {
  'use strict';

  const DEFAULT_CLIENT_ID = '4410';
  const ANILIST_AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize';
  const PIN_REDIRECT = 'https://anilist.co/api/v2/oauth/pin';

  let authListeners = [];

  function getClientId() {
    return localStorage.getItem('anitier-clientid') || DEFAULT_CLIENT_ID;
  }

  function setClientId(id) {
    if (id && id.trim()) {
      localStorage.setItem('anitier-clientid', id.trim());
    } else {
      localStorage.removeItem('anitier-clientid');
    }
  }

  function getRedirectUri() {
    // Current origin callback
    return `${window.location.origin}/callback.html`;
  }

  function getAuthUrl(responseType = 'token') {
    const clientId = getClientId();
    const redirectUri = encodeURIComponent(getRedirectUri());
    return `${ANILIST_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&response_type=${responseType}`;
  }

  function getPinAuthUrl() {
    const clientId = getClientId();
    const pinRedirect = encodeURIComponent(PIN_REDIRECT);
    return `${ANILIST_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${pinRedirect}&response_type=code`;
  }

  // Exchange authorization code or PIN for access token via backend proxy
  async function exchangeCodeForToken(code, redirectUri = null) {
    if (!code) throw new Error('Authorization code is required');
    const clientId = getClientId();
    const cleanRedirectUri = redirectUri || getRedirectUri();

    let response;
    try {
      response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: String(code).trim(),
          redirectUri: cleanRedirectUri,
          clientId: clientId
        })
      });
    } catch (netErr) {
      throw new Error('Token proxy unavailable on static host. Use Web Access mode to load your profile directly.');
    }

    if (response.status === 404) {
      throw new Error('Server token proxy endpoint not found on static deployment. Use Web Access to load any AniList username.');
    }

    const data = await response.json();
    if (!response.ok || data.error) {
      const msg = data.message || data.error_description || data.error || 'Authorization code exchange failed';
      throw new Error(msg);
    }

    if (!data.access_token) {
      throw new Error('No access_token returned by token exchange server');
    }

    return data.access_token;
  }

  // Open Popup for OAuth
  function openAuthPopup() {
    const authUrl = getAuthUrl();
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    let popup = null;
    try {
      popup = window.open(
        authUrl,
        'anilist_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );
    } catch (e) {
      console.warn('Popup blocked:', e);
    }

    return { popup, authUrl, pinUrl: getPinAuthUrl() };
  }

  // Extract access token from URL, string, JSON, or PIN page
  function parseToken(input) {
    if (!input) return null;
    let str = String(input).trim();

    // Check if URL with hash access_token
    if (str.includes('access_token=')) {
      const match = str.match(/access_token=([^&"'\s]+)/);
      if (match && match[1]) return match[1];
    }

    // Check if JSON
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.access_token) return parsed.access_token;
      } catch (e) {}
    }

    // If string has Bearer prefix
    if (str.toLowerCase().startsWith('bearer ')) {
      return str.substring(7).trim();
    }

    // Direct token string
    if (str.length > 20) {
      return str;
    }

    return null;
  }

  // Clean username from user input (handles direct username or full URL like https://anilist.co/user/oRintaroTsumugi)
  function parseUsername(input) {
    if (!input) return '';
    let str = String(input).trim();

    // Check for full or partial AniList user URL (e.g. https://anilist.co/user/oRintaroTsumugi, anilist.co/user/oRintaroTsumugi/animelist)
    if (/anilist\.co\/user\//i.test(str)) {
      const match = str.match(/anilist\.co\/user\/([^\/\?#]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    }

    // Check if URL contains /user/username
    if (/\/user\/([^\/\?#]+)/i.test(str)) {
      const match = str.match(/\/user\/([^\/\?#]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    }

    // Strip leading https:// or http:// or www. or @ if any remaining
    str = str.replace(/^https?:\/\/(www\.)?anilist\.co\/user\//i, '');
    str = str.replace(/^@/, '');

    // Clean trailing slashes, subpaths like /animelist or /mangalist or query params
    str = str.split('/')[0].split('?')[0].split('#')[0];

    return str.trim();
  }

  function onAuthChange(callback) {
    authListeners.push(callback);
    return () => {
      authListeners = authListeners.filter(cb => cb !== callback);
    };
  }

  function notifyAuthChange(authData) {
    authListeners.forEach(cb => {
      try { cb(authData); } catch (e) { console.error('Auth listener error:', e); }
    });
  }

  // Initialize postMessage and URL hash listeners
  function init() {
    window.addEventListener('message', async (e) => {
      if (e.data && e.data.type === 'anitier-auth') {
        if (e.data.token) {
          try {
            let user = e.data.user;
            if (!user) {
              user = await window.AniApi.fetchViewer(e.data.token);
            }
            notifyAuthChange({
              token: e.data.token,
              user,
              username: user?.name,
              isTokenAuth: true
            });
          } catch (err) {
            console.error('Failed to verify token message:', err);
            notifyAuthChange({ error: 'Failed to verify token' });
          }
        } else if (e.data.error) {
          notifyAuthChange({ error: e.data.error });
        }
      }
    });

    // Check URL on load for #access_token=... (in case redirected directly)
    const hash = window.location.hash || '';
    if (hash.includes('access_token=')) {
      const match = hash.match(/access_token=([^&]+)/);
      if (match && match[1]) {
        const token = match[1];
        window.history.replaceState(null, '', window.location.pathname);
        window.AniApi.fetchViewer(token).then(user => {
          notifyAuthChange({
            token,
            user,
            username: user?.name,
            isTokenAuth: true
          });
        }).catch(err => {
          console.error('URL hash auth error:', err);
        });
      }
    }
  }

  init();

  return {
    getClientId,
    setClientId,
    getAuthUrl,
    getPinAuthUrl,
    openAuthPopup,
    exchangeCodeForToken,
    parseToken,
    parseUsername,
    onAuthChange,
    notifyAuthChange
  };
})();
