const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const readline = require('readline');
const app = express();
app.use(express.json());

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Received a ${req.method} request at ${req.url}`);
  next();
});

// Open a database handle
let db = new sqlite3.Database('./apiKeys.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
  } else {
    console.log('Connected to the apiKeys.db database.');
    db.run(`CREATE TABLE IF NOT EXISTS apiKeys (
      key TEXT PRIMARY KEY
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  }
});

// Route for making a request to the Ollama API
app.post('/generate', (req, res) => {
  const { apikey, prompt, model, stream, images, raw } = req.body;

  // Log the received request body for debugging
  console.log('Request body:', req.body);

  if (!apikey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  // Check if the API key exists in the database
  db.get('SELECT key FROM apiKeys WHERE key = ?', [apikey], (err, row) => {
    if (err) {
      console.error('Error checking API key:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!row) {
      console.log('Invalid API key:', apikey);
      return res.status(403).json({ error: 'Invalid API Key' });
    }

    // Make request to Ollama if key is valid.
    axios.post('http://localhost:11434/api/generate', { model, prompt, stream, images, raw })
      .then(response => res.json(response.data))
      .catch(error => {
        console.error('Error making request to Ollama API:', error.message);
        res.status(500).json({ error: 'Error making request to Ollama API' });
      });
  });
});

let server;
let currentPort;

function startServer(port) {
  currentPort = port;
  server = app.listen(port, () => console.log(`Server running on port ${port}`));
}

// Close the database connection when the application is closed
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

// Create CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askForPort() {
  rl.question('Enter the port number: ', (port) => {
    fs.writeFile('port.conf', port, (err) => {
      if (err) {
        console.error('Error saving port number:', err.message);
      } else {
        console.log(`Port number saved to port.conf: ${port}`);
        startServer(port);
        startCLI();
      }
    });
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
          startServer(port);
          startCLI();
        }
      }
    });
  } else {
    askForPort();
  }
}, 1000);

function startCLI() {
  rl.on('line', (input) => {
    const [command, argument] = input.trim().split(' ');
    switch (command) {
      case 'generatekey':
        const apiKey = crypto.randomBytes(20).toString('hex');
        db.run('INSERT INTO apiKeys(key) VALUES(?)', [apiKey], (err) => {
          if (err) {
            console.error('Error generating API key:', err.message);
          } else {
            console.log(`API key generated: ${apiKey}`);
          }
        });
        break;
      case 'listkey':
        db.all('SELECT key FROM apiKeys', [], (err, rows) => {
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
          }
        });
        break;
      case 'addkey':
        console.log('Warning: Adding your own keys may be unsafe. It is recommended to generate keys using the generatekey command.');
        db.run('INSERT INTO apiKeys(key) VALUES(?)', [argument], (err) => {
          if (err) {
            console.error('Error adding API key:', err.message);
          } else {
            console.log(`API key added: ${argument}`);
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
      default:
        console.log('Unknown command');
    }
  });
}
