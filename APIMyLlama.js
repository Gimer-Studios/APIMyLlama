const express = require('express');
const { initializeDatabase, closeDatabase, getDb } = require('./db');
const { startServer, askForPort, askForOllamaPort, startCLI } = require('./utils');
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
        askForPort(app, startServer, askForOllamaPort, startCLI, db);
      } else {
        const port = parseInt(data.trim());
        if (isNaN(port)) {
          console.error('Invalid port number in port.conf');
          askForPort(app, startServer, askForOllamaPort, startCLI, db);
        } else {
          if (fs.existsSync('ollamaPort.conf')) {
            fs.readFile('ollamaPort.conf', 'utf8', (err, data) => {
              if (err) {
                console.error('Error reading Ollama port number from file:', err.message);
                askForOllamaPort(app, startServer, startCLI, port, db);
              } else {
                const ollamaPort = parseInt(data.trim());
                if (isNaN(ollamaPort)) {
                  console.error('Invalid Ollama port number in ollamaPort.conf');
                  askForOllamaPort(app, startServer, startCLI, port, db);
                } else {
                  startServer(port, app);
                  startCLI(db);
                }
              }
            });
          } else {
            askForOllamaPort(app, startServer, startCLI, port, db);
          }
        }
      }
    });
  } else {
    askForPort(app, startServer, askForOllamaPort, startCLI, db);
  }
}, 1000);

module.exports = app;