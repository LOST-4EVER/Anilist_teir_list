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
  
  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token`;
  
  res.json({
    clientId: CLIENT_ID,
    redirectUri,
    pinUrl: 'https://anilist.co/api/v2/oauth/pin',
    url: authUrl
  });
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
