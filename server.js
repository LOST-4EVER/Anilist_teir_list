const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID || process.env.ANILIST_CLIENT_ID || '4410';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// OAuth URL Endpoint for popup flow
app.get('/api/auth/url', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = `${protocol}://${host}/callback.html`;
  const customClientId = req.query.client_id || CLIENT_ID;
  
  const tokenAuthUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(customClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token`;
  const codeAuthUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(customClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  
  res.json({
    clientId: customClientId,
    redirectUri,
    pinUrl: `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(customClientId)}&response_type=code`,
    url: tokenAuthUrl,
    codeUrl: codeAuthUrl
  });
});

// OAuth Token Exchange Proxy Endpoint
app.post('/api/auth/token', (req, res) => {
  const { code, redirectUri, clientId, clientSecret } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing required authorization code parameter' });
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const defaultRedirectUri = `${protocol}://${host}/callback.html`;

  const payload = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: clientId || CLIENT_ID,
    client_secret: clientSecret || process.env.CLIENT_SECRET || process.env.ANILIST_CLIENT_SECRET || '',
    redirect_uri: redirectUri || defaultRedirectUri,
    code: String(code).trim()
  });

  const options = {
    hostname: 'anilist.co',
    path: '/api/v2/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let body = '';
    tokenRes.on('data', (chunk) => body += chunk);
    tokenRes.on('end', () => {
      try {
        const json = JSON.parse(body);
        res.status(tokenRes.statusCode || 200).json(json);
      } catch (err) {
        res.status(502).json({ error: 'invalid_response', message: 'Invalid response from AniList token server' });
      }
    });
  });

  tokenReq.on('error', (err) => {
    console.error('AniList token request error:', err.message);
    res.status(502).json({ error: 'network_error', message: err.message || 'Failed to communicate with AniList token server' });
  });

  tokenReq.write(payload);
  tokenReq.end();
});

// OAuth Callback handlers
app.get('/auth/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

app.get('/callback.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

// Image Proxy with CORS headers for html2canvas export
app.get('/api/proxy-image', (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Missing url query parameter');
  }

  try {
    const parsed = new URL(imageUrl);
    const allowedHosts = [
      's4.anilist.co',
      'media.kitsu.io',
      'cdn.myanimelist.net',
      'images.unsplash.com',
      'img.youtube.com'
    ];

    const isAllowed = allowedHosts.some(h => parsed.hostname.endsWith(h) || parsed.hostname === h);
    if (!isAllowed && !parsed.hostname.includes('anilist.co')) {
      return res.status(403).send('Forbidden host');
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const proxyReq = client.get(imageUrl, { headers: { 'User-Agent': 'AniTier-Client/1.0' } }, (proxyRes) => {
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400',
        'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Image proxy error:', err.message);
      res.status(502).send('Failed to fetch image');
    });
  } catch (err) {
    res.status(400).send('Invalid URL format');
  }
});

// Fallback to index.html (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AniTier running at http://0.0.0.0:${PORT}`);
});
