const express = require('express');
const db = require('./db');
const { startServer, resolveConfig, startCLI } = require('./utils');
const { setupRoutes } = require('./api');

const app = express();

async function main() {
  console.log('APIMyLlama V2 is being started. Thanks for choosing Gimer Studios.');

  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    console.log(`Received a ${req.method} request at ${req.url}`);
    next();
  });

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  await db.initialize();

  setupRoutes(app);

  const port = await resolveConfig('port number', 'PORT', 'port.conf', '3000');
  await resolveConfig('Ollama server URL', 'OLLAMA_URL', 'ollamaURL.conf', 'http://localhost:11434');

  startServer(parseInt(port), app);
  startCLI();
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  try {
    await db.close();
  } catch {}
  process.exit(0);
});

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = app;
