const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const axios = require('axios');
const { getDb } = require('./db');

let server;
let currentPort;
let expressApp;

function startServer(port, app) {
  currentPort = port;
  expressApp = app;  // Store the app object
  server = expressApp.listen(currentPort, () => console.log(`Server running on port ${currentPort}`));
}

function askForPort(app, startServerCallback, askForOllamaPortCallback, startCLICallback, db) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the port number for the API server: ', (port) => {
    fs.writeFile('port.conf', port, (err) => {
      if (err) {
        console.error('Error saving port number:', err.message);
      } else {
        console.log(`Port number saved to port.conf: ${port}`);
        currentPort = parseInt(port);
        askForOllamaPortCallback(app, startServerCallback, startCLICallback, currentPort, db);
      }
    });
    rl.close();
  });
}

function askForOllamaPort(app, startServerCallback, startCLICallback, port, db) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the port number for the Ollama server (Port that your Ollama server is running on. By default it is 11434 so if you didnt change anything it should be that.): ', (ollamaPort) => {
    fs.writeFile('ollamaPort.conf', ollamaPort, (err) => {
      if (err) {
        console.error('Error saving Ollama port number:', err.message);
      } else {
        console.log(`Ollama port number saved to ollamaPort.conf: ${ollamaPort}`);
        startServerCallback(port, app);
        startCLICallback(db);
      }
    });
    rl.close();
  });
}

function startCLI(db) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', (input) => {
    const [command, argument, ...rest] = input.trim().split(' ');
    const description = rest.join(' ');

    switch (command) {
      case 'generatekey':
        generateKey(db);
        break;
      case 'generatekeys':
        generateKeys(db, argument);
        break;
      case 'listkey':
        listKeys(db);
        break;
      case 'removekey':
        removeKey(db, argument);
        break;
      case 'addkey':
        addKey(db, argument);
        break;
      case 'changeport':
        changePort(argument);
        break;
      case 'changeollamaport':
        changeOllamaPort(argument);
        break;
      case 'ratelimit':
        setRateLimit(db, argument, rest[0]);
        break;
      case 'addwebhook':
        addWebhook(db, argument);
        break;
      case 'deletewebhook':
        deleteWebhook(db, argument);
        break;
      case 'listwebhooks':
        listWebhooks(db);
        break;
      case 'activatekey':
        activateKey(db, argument);
        break;
      case 'deactivatekey':
        deactivateKey(db, argument);
        break;
      case 'addkeydescription':
        addKeyDescription(db, argument, description);
        break;
      case 'listkeydescription':
        listKeyDescription(db, argument);
        break;
      case 'regeneratekey':
        regenerateKey(db, argument);
        break;
      case 'activateallkeys':
        activateAllKeys(db);
        break;
      case 'deactivateallkeys':
        deactivateAllKeys(db);
        break;
      case 'getkeyinfo':
        getKeyInfo(db, argument);
        break;
      case 'listinactivekeys':
        listInactiveKeys(db);
        break;
      case 'listactivekeys':
        listActiveKeys(db);
        break;
      case 'exit':
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Unknown command');
    }
  });
}

function generateKey(db) {
  const apiKey = crypto.randomBytes(20).toString('hex');
  db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [apiKey], (err) => {
    if (err) {
      console.error('Error generating API key:', err.message);
    } else {
      console.log(`API key generated: ${apiKey}`);
    }
  });
}

function generateKeys(db, count) {
  if (!count || isNaN(count)) {
    console.log('Invalid number of keys');
    return;
  }
  const numberOfKeys = parseInt(count);
  for (let i = 0; i < numberOfKeys; i++) {
    generateKey(db);
  }
}

function listKeys(db) {
  db.all('SELECT key, active, description FROM apiKeys', [], (err, rows) => {
    if (err) {
      console.error('Error listing API keys:', err.message);
    } else {
      console.log('API keys:', rows);
    }
  });
}

function removeKey(db, key) {
  db.run('DELETE FROM apiKeys WHERE key = ?', [key], (err) => {
    if (err) {
      console.error('Error removing API key:', err.message);
    } else {
      console.log('API key removed');
    }
  });
}

function addKey(db, key) {
  console.log('Warning: Adding your own keys may be unsafe. It is recommended to generate keys using the generatekey command.');
  db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [key], (err) => {
    if (err) {
      console.error('Error adding API key:', err.message);
    } else {
      console.log(`API key added: ${key}`);
    }
  });
}

function changePort(newPort) {
  if (!newPort || isNaN(newPort)) {
    console.log('Invalid port number');
    return;
  }
  const port = parseInt(newPort);
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error closing the server:', err.message);
      } else {
        console.log(`Server closed on port ${currentPort}`);
        updatePortAndRestart(port);
      }
    });
  } else {
    updatePortAndRestart(port);
  }
}

function updatePortAndRestart(port) {
  fs.writeFile('port.conf', port.toString(), (err) => {
    if (err) {
      console.error('Error saving port number:', err.message);
    } else {
      console.log(`Port number saved to port.conf: ${port}`);
      if (expressApp) {
        startServer(port, expressApp);
      } else {
        console.error('Express app not available. Unable to restart server.');
      }
    }
  });
}

function changeOllamaPort(newPort) {
  if (!newPort || isNaN(newPort)) {
    console.log('Invalid Ollama port number');
    return;
  }
  const port = parseInt(newPort);
  fs.writeFile('ollamaPort.conf', port.toString(), (err) => {
    if (err) {
      console.error('Error saving Ollama port number:', err.message);
    } else {
      console.log(`Ollama port number saved to ollamaPort.conf: ${port}`);
    }
  });
}

function setRateLimit(db, key, limit) {
  if (!key || !limit || isNaN(limit)) {
    console.log('Invalid API key or rate limit number');
    return;
  }
  const rateLimit = parseInt(limit);
  db.run('UPDATE apiKeys SET rate_limit = ? WHERE key = ?', [rateLimit, key], (err) => {
    if (err) {
      console.error('Error setting rate limit:', err.message);
    } else {
      console.log(`Rate limit set to ${rateLimit} requests per minute for API key: ${key}`);
    }
  });
}

function addWebhook(db, url) {
  if (!url) {
    console.log('Webhook URL is required');
    return;
  }
  db.run('INSERT INTO webhooks (url) VALUES (?)', [url], (err) => {
    if (err) {
      console.error('Error adding webhook:', err.message);
    } else {
      console.log(`Webhook added: ${url}`);
    }
  });
}

function deleteWebhook(db, id) {
  if (!id) {
    console.log('Webhook ID is required');
    return;
  }
  db.run('DELETE FROM webhooks WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting webhook:', err.message);
    } else {
      console.log('Webhook deleted');
    }
  });
}

function listWebhooks(db) {
  db.all('SELECT id, url FROM webhooks', [], (err, rows) => {
    if (err) {
      console.error('Error listing webhooks:', err.message);
    } else {
      console.log('Webhooks:', rows);
    }
  });
}

function activateKey(db, key) {
  db.run('UPDATE apiKeys SET active = 1 WHERE key = ?', [key], (err) => {
    if (err) {
      console.error('Error activating API key:', err.message);
    } else {
      console.log(`API key ${key} activated`);
    }
  });
}

function deactivateKey(db, key) {
  db.run('UPDATE apiKeys SET active = 0 WHERE key = ?', [key], (err) => {
    if (err) {
      console.error('Error deactivating API key:', err.message);
    } else {
      console.log(`API key ${key} deactivated`);
    }
  });
}

function addKeyDescription(db, key, description) {
  if (!key || !description) {
    console.log('Invalid API key or description');
    return;
  }
  db.run('UPDATE apiKeys SET description = ? WHERE key = ?', [description, key], (err) => {
    if (err) {
      console.error('Error adding description:', err.message);
    } else {
      console.log(`Description added to API key ${key}`);
    }
  });
}

function listKeyDescription(db, key) {
  if (!key) {
    console.log('Invalid API key');
    return;
  }
  db.get('SELECT description FROM apiKeys WHERE key = ?', [key], (err, row) => {
    if (err) {
      console.error('Error retrieving description:', err.message);
    } else {
      if (row) {
        console.log(`Description for API key ${key}: ${row.description}`);
      } else {
        console.log(`No description found for API key ${key}`);
      }
    }
  });
}

function regenerateKey(db, oldKey) {
  if (!oldKey) {
    console.log('Invalid API key');
    return;
  }
  const newApiKey = crypto.randomBytes(20).toString('hex');
  db.run('UPDATE apiKeys SET key = ? WHERE key = ?', [newApiKey, oldKey], (err) => {
    if (err) {
      console.error('Error regenerating API key:', err.message);
    } else {
      console.log(`API key regenerated. New API key: ${newApiKey}`);
    }
  });
}

function activateAllKeys(db) {
  db.run('UPDATE apiKeys SET active = 1', (err) => {
    if (err) {
      console.error('Error activating all API keys:', err.message);
    } else {
      console.log('All API keys activated');
    }
  });
}

function deactivateAllKeys(db) {
  db.run('UPDATE apiKeys SET active = 0', (err) => {
    if (err) {
      console.error('Error deactivating all API keys:', err.message);
    } else {
      console.log('All API keys deactivated');
    }
  });
}

function getKeyInfo(db, key) {
  db.get('SELECT * FROM apiKeys WHERE key = ?', [key], (err, row) => {
    if (err) {
      console.error('Error retrieving API key info:', err.message);
    } else if (row) {
      console.log('API key info:', row);
    } else {
      console.log('No API key found with the given key.');
    }
  });
}

function listInactiveKeys(db) {
  db.all('SELECT key FROM apiKeys WHERE active = 0', [], (err, rows) => {
    if (err) {
      console.error('Error listing inactive API keys:', err.message);
    } else {
      console.log('Inactive API keys:', rows);
    }
  });
}

function listActiveKeys(db) {
  db.all('SELECT key FROM apiKeys WHERE active = 1', [], (err, rows) => {
    if (err) {
      console.error('Error listing active API keys:', err.message);
    } else {
      console.log('Active API keys:', rows);
    }
  });
}

function getOllamaPort() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync('ollamaPort.conf')) {
      fs.readFile('ollamaPort.conf', 'utf8', (err, data) => {
        if (err) {
          reject('Error reading Ollama port from file:', err.message);
        } else {
          const port = parseInt(data.trim());
          if (isNaN(port)) {
            reject('Invalid Ollama port number in ollamaPort.conf');
          } else {
            resolve(port);
          }
        }
      });
    } else {
      reject('Ollama port configuration file not found');
    }
  });
}

function sendWebhookNotification(db, payload) {
  db.all('SELECT url FROM webhooks', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving webhooks:', err.message);
    } else {
      rows.forEach(row => {
        const webhookPayload = {
          content: JSON.stringify(payload, null, 2)
        };

        axios.post(row.url, webhookPayload)
          .then(response => {
            console.log('Webhook notification sent successfully:', response.data);
          })
          .catch(error => {
            console.error('Error sending webhook notification:', error.message);
          });
      });
    }
  });
}

module.exports = {
  startServer,
  askForPort,
  askForOllamaPort,
  startCLI,
  getOllamaPort,
  sendWebhookNotification,
  updatePortAndRestart
};