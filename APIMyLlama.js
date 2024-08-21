const express = require('express');
const { initializeDatabase, closeDatabase} = require('./db');
const { startServer, startCLI, getPort, getOllamaURL } = require('./utils');
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

//Verif conf
getPort()
getOllamaURL()

// Start the server
startServer(app);
startCLI(db);

module.exports = app;
