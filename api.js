const axios = require('axios');
const db = require('./db');
const { getOllamaURL, sendWebhookNotification } = require('./utils');

const rateLimits = new Map();

function extractApiKey(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.body?.apikey || req.query?.apikey || null;
}

async function verifyApiKey(apikey) {
  if (!apikey) return null;
  try {
    return await db.get('SELECT * FROM apiKeys WHERE key = ?', [apikey]);
  } catch {
    return null;
  }
}

function setupRoutes(app) {
  const healthHandler = async (req, res) => {
    const apikey = extractApiKey(req);
    if (!apikey) {
      return res.status(401).json({ error: 'API key is required (use Authorization: Bearer header or ?apikey= param)' });
    }

    const keyInfo = await verifyApiKey(apikey);
    if (!keyInfo) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    let ollamaHealthy = false;
    try {
      const url = await getOllamaURL();
      await axios.get(`${url}/api/tags`, { timeout: 5000 });
      ollamaHealthy = true;
    } catch {
      ollamaHealthy = false;
    }

    res.json({
      status: ollamaHealthy ? 'healthy' : 'degraded',
      ollama: ollamaHealthy ? 'reachable' : 'unreachable',
      timestamp: new Date().toISOString()
    });
  };

  const generateHandler = async (req, res) => {
    const apikey = extractApiKey(req);
    if (!apikey) {
      return res.status(401).json({ error: 'API key is required (use Authorization: Bearer header)' });
    }

    const keyInfo = await verifyApiKey(apikey);
    if (!keyInfo) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
    if (keyInfo.active === 0) {
      return res.status(403).json({ error: 'API key is deactivated' });
    }

    const rateLimitError = checkRateLimit(apikey, keyInfo);
    if (rateLimitError) {
      return res.status(429).json({ error: rateLimitError });
    }

    await handleGenerate(req, res, apikey);
  };

  app.get('/v1/health', healthHandler);
  app.post('/v1/generate', generateHandler);
  app.get('/health', healthHandler);
  app.post('/generate', generateHandler);
}

function checkRateLimit(apikey, keyInfo) {
  const currentTime = Date.now();
  const minute = 60000;
  const rateLimit = keyInfo.rate_limit;

  if (!rateLimits.has(apikey)) {
    const lastUsed = new Date(keyInfo.last_used).getTime();
    const timeElapsed = currentTime - lastUsed;
    const tokens = timeElapsed >= minute ? rateLimit : Math.min(keyInfo.tokens, rateLimit);
    rateLimits.set(apikey, { tokens, lastUsed });
  }

  const rateLimitInfo = rateLimits.get(apikey);
  const timeElapsed = currentTime - rateLimitInfo.lastUsed;

  if (timeElapsed >= minute) {
    rateLimitInfo.tokens = rateLimit;
    rateLimitInfo.lastUsed = currentTime;
  }

  if (rateLimitInfo.tokens <= 0) {
    return 'Rate limit exceeded. Try again later.';
  }

  rateLimitInfo.tokens -= 1;
  rateLimitInfo.lastUsed = currentTime;

  db.run('UPDATE apiKeys SET tokens = ?, last_used = ? WHERE key = ?', [
    rateLimitInfo.tokens,
    new Date(rateLimitInfo.lastUsed).toISOString(),
    apikey
  ]).catch(err => console.error('Error updating tokens:', err.message));

  return null;
}

async function handleGenerate(req, res, apikey) {
  const { prompt, model, stream, images, raw } = req.body;

  if (!prompt || !model) {
    return res.status(400).json({ error: 'Both prompt and model are required' });
  }

  try {
    const ollamaURL = await getOllamaURL();
    const OLLAMA_API_URL = `${ollamaURL}/api/generate`;

    if (stream) {
      const ollamaResponse = await axios({
        method: 'post',
        url: OLLAMA_API_URL,
        data: { model, prompt, stream: true, images, raw },
        responseType: 'stream',
        timeout: 300000
      });

      res.setHeader('Content-Type', 'application/x-ndjson');
      ollamaResponse.data.pipe(res);

      ollamaResponse.data.on('end', () => {
        logUsage(apikey);
        sendWebhook(apikey, prompt, model, stream, images, raw);
      });
    } else {
      const ollamaResponse = await axios.post(OLLAMA_API_URL, { model, prompt, stream: false, images, raw }, {
        timeout: 300000
      });

      logUsage(apikey);
      sendWebhook(apikey, prompt, model, stream, images, raw);

      res.json(ollamaResponse.data);
    }
  } catch (error) {
    if (error.response) {
      console.error('Ollama API error:', error.response.status, error.response.data);
      res.status(error.response.status).json({ error: 'Ollama API error', detail: error.response.data });
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Ollama server is not reachable:', error.message);
      res.status(503).json({ error: 'Ollama server is not reachable' });
    } else {
      console.error('Error making request to Ollama API:', error.message);
      res.status(500).json({ error: 'Error making request to Ollama API' });
    }
  }
}

function logUsage(apikey) {
  db.run('INSERT INTO apiUsage (key) VALUES (?)', [apikey])
    .catch(err => console.error('Error logging API usage:', err.message));
}

function sendWebhook(apikey, prompt, model, stream, images, raw) {
  sendWebhookNotification({
    apikey, prompt, model, stream, images, raw,
    timestamp: new Date().toISOString()
  });
}

module.exports = { setupRoutes };
