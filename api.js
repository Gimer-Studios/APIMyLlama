const { getOllamaURL, sendWebhookNotification } = require('./utils');
const axios = require('axios');

const rateLimits = new Map();

function setupRoutes(app, db) {
  app.use((req, res, next) => rateLimitMiddleware(req, res, next, db));
  app.get('/health', (req, res) => healthCheck(req, res, db));
  app.post('/generate', (req, res) => generateResponse(req, res, db));
}

function rateLimitMiddleware(req, res, next, db) {
  const { apikey } = req.body;
  if (!apikey) return next();

  db.get('SELECT tokens, last_used, rate_limit, active FROM apiKeys WHERE key = ?', [apikey], (err, row) => {
    if (err) {
      console.error('Error checking API key for rate limit:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (row) {
      if (row.active === 0) {
        return res.status(403).json({ error: 'API key is deactivated' });
      }

      const currentTime = Date.now();
      const minute = 60000;
      const rateLimit = row.rate_limit;

      if (!rateLimits.has(apikey)) {
        rateLimits.set(apikey, { tokens: row.tokens, lastUsed: new Date(row.last_used).getTime() });
      }

      const rateLimitInfo = rateLimits.get(apikey);
      const timeElapsed = currentTime - rateLimitInfo.lastUsed;

      if (timeElapsed >= minute) {
        rateLimitInfo.tokens = rateLimit;
      }

      if (rateLimitInfo.tokens > 0) {
        rateLimitInfo.tokens -= 1;
        rateLimitInfo.lastUsed = currentTime;
        rateLimits.set(apikey, rateLimitInfo);

        db.run('UPDATE apiKeys SET tokens = ?, last_used = ? WHERE key = ?', [rateLimitInfo.tokens, new Date(rateLimitInfo.lastUsed).toISOString(), apikey], (err) => {
          if (err) {
            console.error('Error updating tokens and last_used:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
          }
          next();
        });
      } else {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      }
    } else {
      return res.status(403).json({ error: 'Invalid API key' });
    }
  });
}

function healthCheck(req, res, db) {
  const apikey = req.query.apikey;

  if (!apikey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  db.get('SELECT key FROM apiKeys WHERE key = ?', [apikey], (err, row) => {
    if (err) {
      console.error('Error checking API key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      console.log('Invalid API key:', apikey);
      return res.status(403).json({ error: 'Invalid API Key' });
    }

    res.json({ status: 'API is healthy', timestamp: new Date() });
  });
}

async function generateResponse(req, res, db) {
  const { apikey, prompt, model, stream = true, images, raw } = req.body;

  console.log('Request body:', req.body);

  if (!apikey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  // Check if the API key exists in the database
  db.get('SELECT key FROM apiKeys WHERE key = ?', [apikey], async (err, row) => {
    if (err) {
      console.error('Error checking API key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      console.log('Invalid API key:', apikey);
      return res.status(403).json({ error: 'Invalid API Key' });
    }

    try {
      const ollamaURL = await getOllamaURL();
      if (!ollamaURL) {
        throw new Error('Unable to get Ollama URL');
      }
      const OLLAMA_API_URL = `${ollamaURL}/api/generate`;

      // Set proper headers for streaming
      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson');
      }

      // Make request to Ollama with streaming
      const ollamaResponse = await axios.post(OLLAMA_API_URL, 
        { model, prompt, stream, images, raw },
        { responseType: stream ? 'stream' : 'json' }
      );

      // Log usage before sending response
      db.run('INSERT INTO apiUsage (key) VALUES (?)', [apikey], (err) => {
        if (err) console.error('Error logging API usage:', err.message);
      });

      // Send webhook notification
      sendWebhookNotification(db, { 
        apikey, prompt, model, stream, images, raw, 
        timestamp: new Date() 
      });

      // Handle streaming response
      if (stream) {
        ollamaResponse.data.pipe(res);
        // Handle errors in the stream
        ollamaResponse.data.on('error', (error) => {
          console.error('Stream error:', error);
          res.status(500).json({ error: 'Stream error occurred' });
        });
      } else {
        res.json(ollamaResponse.data);
      }

    } catch (error) {
      console.error('Error:', error.message);
      if (error.message.includes('Unable to get Ollama URL')) {
        res.status(500).json({ error: 'Error retrieving Ollama server URL' });
      } else if (error.response) {
        res.status(error.response.status).json({ error: `Ollama API error: ${error.response.data}` });
      } else if (error.request) {
        res.status(500).json({ error: 'No response received from Ollama API' });
      } else {
        res.status(500).json({ error: 'Error making request to Ollama API' });
      }
    }
  });
}

module.exports = {
  setupRoutes
};
