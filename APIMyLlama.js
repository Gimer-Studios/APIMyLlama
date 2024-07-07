const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const readline = require('readline');
const app = express();
app.use(express.json());

const rateLimits = new Map(); //In-memory store for rate limits
console.log('APIMyLlama V2 is being started. Thanks for choosing Gimer Studios.'); //Startup message. Thank you guys.

//Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Received a ${req.method} request at ${req.url}`);
  next();
});

//Open a database handle
let db = new sqlite3.Database('./apiKeys.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
  } else {
    console.log('Connected to the apiKeys.db database.');

    //Create the apiKeys table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS apiKeys (
      key TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tokens INTEGER DEFAULT 10,
      rate_limit INTEGER DEFAULT 10,
      active INTEGER DEFAULT 1,
      description TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating apiKeys table:', err.message);
      }
    });

    //Create the apiUsage table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS apiUsage (
      key TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating apiUsage table:', err.message);
      }
    });

    //Create the webhooks table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL
    )`, (err) => {
      if (err) {
        console.error('Error creating webhooks table:', err.message);
      }
    });

    //Ensure the 'active' and 'description' columns exist in the 'apiKeys' table
    db.all("PRAGMA table_info(apiKeys)", (err, rows) => {
      if (err) {
        console.error('Error checking table info:', err.message);
      } else {
        const columns = rows.map(row => row.name);
        if (!columns.includes('active')) {
          db.run("ALTER TABLE apiKeys ADD COLUMN active INTEGER DEFAULT 1", (err) => {
            if (err) {
              console.error('Error adding active column:', err.message);
            } else {
              console.log("Added 'active' column to 'apiKeys' table.");
            }
          });
        }
        if (!columns.includes('description')) {
          db.run("ALTER TABLE apiKeys ADD COLUMN description TEXT", (err) => {
            if (err) {
              console.error('Error adding description column:', err.message);
            } else {
              console.log("Added 'description' column to 'apiKeys' table.");
            }
          });
        }
      }
    });
  }
});

//Function to get Ollama server port from config file
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

//Function to send a notification to all webhooks
function sendWebhookNotification(payload) {
  db.all('SELECT url FROM webhooks', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving webhooks:', err.message);
    } else {
      rows.forEach(row => {
        const webhookPayload = {
          content: JSON.stringify(payload, null, 2) //Convert the payload to a pretty JSON string
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

//Middleware for rate limiting and checking key activation
app.use((req, res, next) => {
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
        //Initialize rate limit info for this key
        rateLimits.set(apikey, { tokens: row.tokens, lastUsed: new Date(row.last_used).getTime() });
      }

      const rateLimitInfo = rateLimits.get(apikey);
      const timeElapsed = currentTime - rateLimitInfo.lastUsed;

      //Refill tokens if a minute has passed since the last request
      if (timeElapsed >= minute) {
        rateLimitInfo.tokens = rateLimit;
      }

      if (rateLimitInfo.tokens > 0) {
        rateLimitInfo.tokens -= 1;
        rateLimitInfo.lastUsed = currentTime;
        rateLimits.set(apikey, rateLimitInfo);

        //Update the database
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
});

//Health check endpoint
app.get('/health', (req, res) => {
  const apikey = req.query.apikey;

  if (!apikey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  //Check if the API key exists in the database
  db.get('SELECT key FROM apiKeys WHERE key = ?', [apikey], (err, row) => {
    if (err) {
      console.error('Error checking API key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      console.log('Invalid API key:', apikey);
      return res.status(403).json({ error: 'Invalid API Key' });
    }

    //API key is valid, return health status
    res.json({ status: 'API is healthy', timestamp: new Date() });
  });
});

//Route for making a request to the Ollama API
app.post('/generate', async (req, res) => {
  const { apikey, prompt, model, stream, images, raw } = req.body;

  //Log the received request body for debugging
  console.log('Request body:', req.body);

  if (!apikey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  //Check if the API key exists in the database
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
      const ollamaPort = await getOllamaPort();
      const OLLAMA_API_URL = `http://localhost:${ollamaPort}/api/generate`;

      //Make request to Ollama if key is valid.
      axios.post(OLLAMA_API_URL, { model, prompt, stream, images, raw })
        .then(response => {
          //Log usage in apiUsage table
          db.run('INSERT INTO apiUsage (key) VALUES (?)', [apikey], (err) => {
            if (err) console.error('Error logging API usage:', err.message);
          });

          //Send webhook notifications
          sendWebhookNotification({ apikey, prompt, model, stream, images, raw, timestamp: new Date() });

          res.json(response.data);
        })
        .catch(error => {
          console.error('Error making request to Ollama API:', error.message);
          res.status(500).json({ error: 'Error making request to Ollama API' });
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error retrieving Ollama server port' });
    }
  });
});

let server;
let currentPort;

function startServer(port) {
  currentPort = port;
  server = app.listen(currentPort, () => console.log(`Server running on port ${currentPort}`));
}

//Close the database connection when the application is closed
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing the database connection:', err.message);
    } else {
      console.log('Closed the database connection.');
    }
    process.exit(0);
  });
});

//Create CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askForPort() {
  rl.question('Enter the port number for the API server: ', (port) => {
    fs.writeFile('port.conf', port, (err) => {
      if (err) {
        console.error('Error saving port number:', err.message);
      } else {
        console.log(`Port number saved to port.conf: ${port}`);
        currentPort = parseInt(port);
        askForOllamaPort();
      }
    });
  });
}

function askForOllamaPort() {
  rl.question('Enter the port number for the Ollama server (Port that your Ollama server is running on. By default it is 11434 so if you didnt change anything it should be that.): ', (port) => {
    fs.writeFile('ollamaPort.conf', port, (err) => {
      if (err) {
        console.error('Error saving Ollama port number:', err.message);
      } else {
        console.log(`Ollama port number saved to ollamaPort.conf: ${port}`);
        startServer(currentPort);
        startCLI();
      }
    });
  });
}

function startCLI() {
  rl.on('line', (input) => {
    const [command, argument, ...rest] = input.trim().split(' ');
    const description = rest.join(' ');

    switch (command) {
      case 'generatekey':
        const apiKey = crypto.randomBytes(20).toString('hex');
        db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [apiKey], (err) => {
          if (err) {
            console.error('Error generating API key:', err.message);
          } else {
            console.log(`API key generated: ${apiKey}`);
            rateLimits.set(apiKey, { tokens: 10, lastUsed: Date.now() });
          }
        });
        break;
      case 'generatekeys':
        if (!argument || isNaN(argument)) {
          console.log('Invalid number of keys');
        } else {
          const numberOfKeys = parseInt(argument);
          for (let i = 0; i < numberOfKeys; i++) {
            const newApiKey = crypto.randomBytes(20).toString('hex');
            db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [newApiKey], (err) => {
              if (err) {
                console.error('Error generating API key:', err.message);
              } else {
                console.log(`API key generated: ${newApiKey}`);
                rateLimits.set(newApiKey, { tokens: 10, lastUsed: Date.now() });
              }
            });
          }
        }
        break;
      case 'listkey':
        db.all('SELECT key, active, description FROM apiKeys', [], (err, rows) => {
          if (err) {
            console.error('Error listing API keys:', err.message);
          } else {
            console.log('API keys:', rows);
          }
        });
        break;
      case 'removekey':
        db.run('DELETE FROM apiKeys WHERE key = ?', [argument], (err) => {
          if (err) {
            console.error('Error removing API key:', err.message);
          } else {
            console.log('API key removed');
            rateLimits.delete(argument);
          }
        });
        break;
      case 'addkey':
        console.log('Warning: Adding your own keys may be unsafe. It is recommended to generate keys using the generatekey command.');
        db.run('INSERT INTO apiKeys(key, rate_limit) VALUES(?, 10)', [argument], (err) => {
          if (err) {
            console.error('Error adding API key:', err.message);
          } else {
            console.log(`API key added: ${argument}`);
            rateLimits.set(argument, { tokens: 10, lastUsed: Date.now() });
          }
        });
        break;
      case 'changeport':
        if (!argument || isNaN(argument)) {
          console.log('Invalid port number');
        } else {
          const newPort = parseInt(argument);
          server.close((err) => {
            if (err) {
              console.error('Error closing the server:', err.message);
            } else {
              console.log(`Server closed on port ${currentPort}`);
              fs.writeFile('port.conf', newPort.toString(), (err) => {
                if (err) {
                  console.error('Error saving port number:', err.message);
                } else {
                  console.log(`Port number saved to port.conf: ${newPort}`);
                  startServer(newPort);
                }
              });
            }
          });
        }
        break;
      case 'changeollamaport':
        if (!argument || isNaN(argument)) {
          console.log('Invalid Ollama port number');
        } else {
          const newPort = parseInt(argument);
          fs.writeFile('ollamaPort.conf', newPort.toString(), (err) => {
            if (err) {
              console.error('Error saving Ollama port number:', err.message);
            } else {
              console.log(`Ollama port number saved to ollamaPort.conf: ${newPort}`);
            }
          });
        }
        break;
      case 'ratelimit':
        if (!argument || !rest[0] || isNaN(rest[0])) {
          console.log('Invalid API key or rate limit number');
        } else {
          const limit = parseInt(rest[0]);
          db.run('UPDATE apiKeys SET rate_limit = ? WHERE key = ?', [limit, argument], (err) => {
            if (err) {
              console.error('Error setting rate limit:', err.message);
            } else {
              console.log(`Rate limit set to ${limit} requests per minute for API key: ${argument}`);
            }
          });
        }
        break;
      case 'addwebhook':
        if (!argument) {
          console.log('Webhook URL is required');
        } else {
          db.run('INSERT INTO webhooks (url) VALUES (?)', [argument], (err) => {
            if (err) {
              console.error('Error adding webhook:', err.message);
            } else {
              console.log(`Webhook added: ${argument}`);
            }
          });
        }
        break;
      case 'deletewebhook':
        if (!argument) {
          console.log('Webhook ID is required');
        } else {
          db.run('DELETE FROM webhooks WHERE id = ?', [argument], (err) => {
            if (err) {
              console.error('Error deleting webhook:', err.message);
            } else {
              console.log('Webhook deleted');
            }
          });
        }
        break;
      case 'listwebhooks':
        db.all('SELECT id, url FROM webhooks', [], (err, rows) => {
          if (err) {
            console.error('Error listing webhooks:', err.message);
          } else {
            console.log('Webhooks:', rows);
          }
        });
        break;
      case 'activatekey':
        db.run('UPDATE apiKeys SET active = 1 WHERE key = ?', [argument], (err) => {
          if (err) {
            console.error('Error activating API key:', err.message);
          } else {
            console.log(`API key ${argument} activated`);
          }
        });
        break;
      case 'deactivatekey':
        db.run('UPDATE apiKeys SET active = 0 WHERE key = ?', [argument], (err) => {
          if (err) {
            console.error('Error deactivating API key:', err.message);
          } else {
            console.log(`API key ${argument} deactivated`);
          }
        });
        break;
      case 'addkeydescription':
        if (!argument || !description) {
          console.log('Invalid API key or description');
        } else {
          db.run('UPDATE apiKeys SET description = ? WHERE key = ?', [description, argument], (err) => {
            if (err) {
              console.error('Error adding description:', err.message);
            } else {
              console.log(`Description added to API key ${argument}`);
            }
          });
        }
        break;
      case 'listkeydescription':
        if (!argument) {
          console.log('Invalid API key');
        } else {
          db.get('SELECT description FROM apiKeys WHERE key = ?', [argument], (err, row) => {
            if (err) {
              console.error('Error retrieving description:', err.message);
            } else {
              if (row) {
                console.log(`Description for API key ${argument}: ${row.description}`);
              } else {
                console.log(`No description found for API key ${argument}`);
              }
            }
          });
        }
        break;
      case 'regeneratekey':
        if (!argument) {
          console.log('Invalid API key');
        } else {
          const newApiKey = crypto.randomBytes(20).toString('hex');
          db.run('UPDATE apiKeys SET key = ? WHERE key = ?', [newApiKey, argument], (err) => {
            if (err) {
              console.error('Error regenerating API key:', err.message);
            } else {
              console.log(`API key regenerated. New API key: ${newApiKey}`);
            }
          });
        }
        break;
      case 'activateallkeys':
        db.run('UPDATE apiKeys SET active = 1', (err) => {
          if (err) {
            console.error('Error activating all API keys:', err.message);
          } else {
            console.log('All API keys activated');
          }
        });
        break;
      case 'deactivateallkeys':
        db.run('UPDATE apiKeys SET active = 0', (err) => {
          if (err) {
            console.error('Error deactivating all API keys:', err.message);
          } else {
            console.log('All API keys deactivated');
          }
        });
        break;
      case 'getkeyinfo':
        db.get('SELECT * FROM apiKeys WHERE key = ?', [argument], (err, row) => {
          if (err) {
            console.error('Error retrieving API key info:', err.message);
          } else if (row) {
            console.log('API key info:', row);
          } else {
            console.log('No API key found with the given key.');
          }
        });
        break;
      case 'listinactivekeys':
        db.all('SELECT key FROM apiKeys WHERE active = 0', [], (err, rows) => {
          if (err) {
            console.error('Error listing inactive API keys:', err.message);
          } else {
            console.log('Inactive API keys:', rows);
          }
        });
        break;
      case 'listactivekeys':
        db.all('SELECT key FROM apiKeys WHERE active = 1', [], (err, rows) => {
          if (err) {
            console.error('Error listing active API keys:', err.message);
          } else {
            console.log('Active API keys:', rows);
          }
        });
        break;
      case 'exit':
        rl.close();
        break;
      default:
        console.log('Unknown command');
    }
  });
}

setTimeout(() => {
  if (fs.existsSync('port.conf')) {
    fs.readFile('port.conf', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading port number from file:', err.message);
        askForPort();
      } else {
        const port = parseInt(data.trim());
        if (isNaN(port)) {
          console.error('Invalid port number in port.conf');
          askForPort();
        } else {
          currentPort = port;
          if (fs.existsSync('ollamaPort.conf')) {
            fs.readFile('ollamaPort.conf', 'utf8', (err, data) => {
              if (err) {
                console.error('Error reading Ollama port number from file:', err.message);
                askForOllamaPort();
              } else {
                const ollamaPort = parseInt(data.trim());
                if (isNaN(ollamaPort)) {
                  console.error('Invalid Ollama port number in ollamaPort.conf');
                  askForOllamaPort();
                } else {
                  startServer(currentPort);
                  startCLI();
                }
              }
            });
          } else {
            askForOllamaPort();
          }
        }
      }
    });
  } else {
    askForPort();
  }
}, 1000);