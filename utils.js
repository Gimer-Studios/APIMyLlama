const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const axios = require('axios');
const db = require('./db');

let server;
let currentPort;
let expressApp;

const VALID_URL_PATTERN = /^https?:\/\/[^\s$.?#].[^\s]*$/i;

function startServer(port, app) {
  currentPort = port;
  expressApp = app;
  server = expressApp.listen(currentPort, () => console.log(`Server running on port ${currentPort}`));
}

async function resolveConfig(name, envVar, confFile, defaultValue) {
  if (process.env[envVar]) {
    console.log(`${name} set from environment variable ${envVar}`);
    return process.env[envVar];
  }

  try {
    const data = await fs.promises.readFile(confFile, 'utf8');
    const value = data.trim();
    if (value) {
      console.log(`${name} loaded from ${confFile}: ${value}`);
      return value;
    }
  } catch {}

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Enter the ${name} (default: ${defaultValue}): `, (answer) => {
      rl.close();
      const value = answer.trim() || defaultValue;
      fs.promises.writeFile(confFile, value, 'utf8')
        .then(() => console.log(`${name} saved to ${confFile}: ${value}`))
        .catch(err => console.error(`Error saving ${confFile}:`, err.message));
      resolve(value);
    });
  });
}

async function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', async (input) => {
    const [command, argument, ...rest] = input.trim().split(' ');
    const description = rest.join(' ');

    try {
      switch (command) {
        case 'generatekey':
          await generateKey();
          break;
        case 'generatekeys':
          await generateKeys(argument);
          break;
        case 'listkey':
          await listKeys();
          break;
        case 'removekey':
          await removeKey(argument);
          break;
        case 'addkey':
          await addKey(argument);
          break;
        case 'changeport':
          await changePort(argument);
          break;
        case 'changeollamaurl':
          await changeOllamaURL(argument);
          break;
        case 'ratelimit':
          await setRateLimit(argument, rest[0]);
          break;
        case 'addwebhook':
          await addWebhook(argument);
          break;
        case 'deletewebhook':
          await deleteWebhook(argument);
          break;
        case 'listwebhooks':
          await listWebhooks();
          break;
        case 'activatekey':
          await activateKey(argument);
          break;
        case 'deactivatekey':
          await deactivateKey(argument);
          break;
        case 'addkeydescription':
          await addKeyDescription(argument, description);
          break;
        case 'listkeydescription':
          await listKeyDescription(argument);
          break;
        case 'regeneratekey':
          await regenerateKey(argument);
          break;
        case 'activateallkeys':
          await activateAllKeys();
          break;
        case 'deactivateallkeys':
          await deactivateAllKeys();
          break;
        case 'getkeyinfo':
          await getKeyInfo(argument);
          break;
        case 'listinactivekeys':
          await listInactiveKeys();
          break;
        case 'listactivekeys':
          await listActiveKeys();
          break;
        case 'exit':
          console.log('Shutting down...');
          await db.close();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log('Unknown command');
      }
    } catch (err) {
      console.error('Command error:', err.message);
    }
  });
}

async function generateKey() {
  const apiKey = crypto.randomBytes(20).toString('hex');
  await db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [apiKey]);
  console.log(`API key generated: ${apiKey}`);
}

async function generateKeys(count) {
  if (!count || isNaN(count)) {
    console.log('Invalid number of keys');
    return;
  }
  const numberOfKeys = parseInt(count);
  for (let i = 0; i < numberOfKeys; i++) {
    await generateKey();
  }
}

async function listKeys() {
  const rows = await db.all('SELECT key, active, description FROM apiKeys');
  console.log('API keys:', rows);
}

async function removeKey(key) {
  if (!key) {
    console.log('API key is required');
    return;
  }
  await db.run('DELETE FROM apiKeys WHERE key = ?', [key]);
  console.log('API key removed');
}

async function addKey(key) {
  if (!key) {
    console.log('API key is required');
    return;
  }
  console.log('Warning: Adding your own keys may be unsafe. It is recommended to generate keys using the generatekey command.');
  await db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [key]);
  console.log(`API key added: ${key}`);
}

async function changePort(newPort) {
  if (!newPort || isNaN(newPort)) {
    console.log('Invalid port number');
    return;
  }
  const port = parseInt(newPort);
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error('Error closing the server:', err.message);
          reject(err);
        } else {
          console.log(`Server closed on port ${currentPort}`);
          resolve();
        }
      });
    });
  }
  await fs.promises.writeFile('port.conf', port.toString(), 'utf8');
  console.log(`Port number saved to port.conf: ${port}`);
  if (expressApp) {
    startServer(port, expressApp);
  } else {
    console.error('Express app not available. Unable to restart server.');
  }
}

async function changeOllamaURL(newURL) {
  if (!newURL || !VALID_URL_PATTERN.test(newURL)) {
    console.log('Invalid Ollama URL. Must be a valid http/https URL.');
    return;
  }
  await fs.promises.writeFile('ollamaURL.conf', newURL, 'utf8');
  console.log(`Ollama URL saved to ollamaURL.conf: ${newURL}`);
}

async function setRateLimit(key, limit) {
  if (!key || !limit || isNaN(limit)) {
    console.log('Invalid API key or rate limit number');
    return;
  }
  const rateLimit = parseInt(limit);
  await db.run('UPDATE apiKeys SET rate_limit = ? WHERE key = ?', [rateLimit, key]);
  console.log(`Rate limit set to ${rateLimit} requests per minute for API key: ${key}`);
}

async function addWebhook(url) {
  if (!url) {
    console.log('Webhook URL is required');
    return;
  }
  if (!VALID_URL_PATTERN.test(url)) {
    console.log('Invalid webhook URL. Must be a valid http/https URL.');
    return;
  }
  await db.run('INSERT INTO webhooks (url) VALUES (?)', [url]);
  console.log(`Webhook added: ${url}`);
}

async function deleteWebhook(id) {
  if (!id) {
    console.log('Webhook ID is required');
    return;
  }
  await db.run('DELETE FROM webhooks WHERE id = ?', [id]);
  console.log('Webhook deleted');
}

async function listWebhooks() {
  const rows = await db.all('SELECT id, url FROM webhooks');
  console.log('Webhooks:', rows);
}

async function activateKey(key) {
  if (!key) {
    console.log('API key is required');
    return;
  }
  await db.run('UPDATE apiKeys SET active = 1 WHERE key = ?', [key]);
  console.log(`API key ${key} activated`);
}

async function deactivateKey(key) {
  if (!key) {
    console.log('API key is required');
    return;
  }
  await db.run('UPDATE apiKeys SET active = 0 WHERE key = ?', [key]);
  console.log(`API key ${key} deactivated`);
}

async function addKeyDescription(key, description) {
  if (!key || !description) {
    console.log('Invalid API key or description');
    return;
  }
  await db.run('UPDATE apiKeys SET description = ? WHERE key = ?', [description, key]);
  console.log(`Description added to API key ${key}`);
}

async function listKeyDescription(key) {
  if (!key) {
    console.log('Invalid API key');
    return;
  }
  const row = await db.get('SELECT description FROM apiKeys WHERE key = ?', [key]);
  if (row) {
    console.log(`Description for API key ${key}: ${row.description}`);
  } else {
    console.log(`No description found for API key ${key}`);
  }
}

async function regenerateKey(oldKey) {
  if (!oldKey) {
    console.log('Invalid API key');
    return;
  }
  const newApiKey = crypto.randomBytes(20).toString('hex');
  await db.run('UPDATE apiKeys SET key = ? WHERE key = ?', [newApiKey, oldKey]);
  console.log(`API key regenerated. New API key: ${newApiKey}`);
}

async function activateAllKeys() {
  await db.run('UPDATE apiKeys SET active = 1');
  console.log('All API keys activated');
}

async function deactivateAllKeys() {
  await db.run('UPDATE apiKeys SET active = 0');
  console.log('All API keys deactivated');
}

async function getKeyInfo(key) {
  if (!key) {
    console.log('API key is required');
    return;
  }
  const row = await db.get('SELECT * FROM apiKeys WHERE key = ?', [key]);
  if (row) {
    console.log('API key info:', row);
  } else {
    console.log('No API key found with the given key.');
  }
}

async function listInactiveKeys() {
  const rows = await db.all('SELECT key FROM apiKeys WHERE active = 0');
  console.log('Inactive API keys:', rows);
}

async function listActiveKeys() {
  const rows = await db.all('SELECT key FROM apiKeys WHERE active = 1');
  console.log('Active API keys:', rows);
}

function getOllamaURL() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync('ollamaURL.conf')) {
      fs.readFile('ollamaURL.conf', 'utf8', (err, data) => {
        if (err) {
          reject(new Error('Error reading Ollama url from file: ' + err.message));
        } else {
          const ollamaURL = data.trim();
          if (typeof ollamaURL !== 'string' || ollamaURL === '') {
            reject(new Error('Invalid Ollama url in ollamaURL.conf'));
          } else {
            resolve(ollamaURL);
          }
        }
      });
    } else {
      reject(new Error('Ollama url configuration file not found'));
    }
  });
}

function sendWebhookNotification(payload) {
  db.all('SELECT url FROM webhooks').then(rows => {
    for (const row of rows) {
      axios.post(row.url, { content: JSON.stringify(payload, null, 2) })
        .catch(err => console.error('Error sending webhook notification:', err.message));
    }
  }).catch(err => {
    console.error('Error retrieving webhooks:', err.message);
  });
}

module.exports = {
  startServer,
  resolveConfig,
  startCLI,
  getOllamaURL,
  sendWebhookNotification
};
