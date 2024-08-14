const express = require('express');
const { initializeDatabase, closeDatabase, getDb } = require('./db');
const { startServer, askForPort, askForOllamaURL, startCLI } = require('./utils');
const { setupRoutes } = require('./api');
const fs = require('fs');

const app = express();
app.use(express.json());

console.log('APIMyLlama V2 is being started. Thanks for choosing Gimer Studios.');

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Received a ${req.method} request at ${req.url}`);
  next();
});

// Initialize the database
const db = initializeDatabase();

// Setup API routes
setupRoutes(app, db);

// Close the database connection when the application is closed
process.on('SIGINT', () => {
  closeDatabase();
});

// Start the server
setTimeout(() => {
  if (fs.existsSync('port.conf')) {
    fs.readFile('port.conf', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading port number from file:', err.message);
        askForPort(app, startServer, askForOllamaURL, startCLI, db);
      } else {
        const port = parseInt(data.trim());
        if (isNaN(port)) {
          console.error('Invalid port number in port.conf');
          askForPort(app, startServer, askForOllamaURL, startCLI, db);
        } else {
          if (fs.existsSync('ollamaURL.conf')) {
            fs.readFile('ollamaURL.conf', 'utf8', (err, data) => {
              if (err) {
                console.error('Error reading Ollama url from file:', err.message);
                askForOllamaURL(app, startServer, startCLI, port, db);
              } else {
                const ollamaURL = data.trim();
                if (typeof ollamaURL !== 'string' || ollamaURL === '') {
                  console.error('Invalid Ollama url in ollamaURL.conf');
                  askForOllamaURL(app, startServer, startCLI, port, db);
                } else {
                  startServer(port, app);
                  startCLI(db);
                }
              }
            });
          } else {
            askForOllamaURL(app, startServer, startCLI, port, db);
          }
        }
      }
    });
  } else {
    askForPort(app, startServer, askForOllamaURL, startCLI, db);
  }
}, 1000);

module.exports = app;
