require('dotenv').config();
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const xssClean = require('xss-clean');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { startWebSocketServer } = require('./webSocket/websocketServer');
const { authenticateUser } = require('./services/authService');


const app = express();


// CORS Configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*", // Allow specific origins or all origins by default
    methods: "*",
}));

app.use(express.json()); // Parse JSON body
app.use(xssClean());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(req.method, req.url, res.statusCode, Date.now()-start, 'ms (FINISH)'));
  res.on('close',  () => console.log(req.method, req.url, 'client closed early (CLOSE)'));
  next();
});
// Secure HTTPS server with SSL certificates
const httpsServer = https.createServer({
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
}, app);

httpsServer.on('clientError', (err, socket) => {
  console.error('Client Error:', err.message);
  socket.destroy(); // Always destroy the socket here
});
// HTTP endpoint to verify the server is running
app.get('/', (req, res) => {
    res.status(200).send('HTTPS Server is running');
});

// Login route to authenticate users and issue JWT
app.post('/login',[
    // Validate and sanitize username
    body('username')
      .trim()
      .escape() // Escape HTML entities to prevent XSS
      .isAlphanumeric() // Ensure username is alphanumeric
      .withMessage('Username must contain only letters and numbers')
      .isLength({ min: 3, max: 30 }) // Ensure length is within range
      .withMessage('Username must be between 3 and 30 characters'),
    // Validate and sanitize password
    body('password')
      .trim()
      .escape() // Escape HTML entities to prevent XSS
      .isLength({ min: 8 }) // Ensure password is at least 8 characters
      .withMessage('Password must be at least 8 characters long'),
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;

    try {
        const { token, user } = await authenticateUser(username, password);
        res.status(200).json({ token, user });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Start the WebSocket server
startWebSocketServer(httpsServer);

// Start the HTTPS server
const PORT = process.env.PORT || 8443;
console.log("Request was sent");
httpsServer.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
