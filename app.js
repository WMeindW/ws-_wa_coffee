const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());

const users = {}; // In-memory user storage

// Serve the main page
app.get('/', (req, res) => {
    if (req.cookies.username) {
        res.sendFile(__dirname + '/public/index.html');
    } else {
        res.sendFile(__dirname + '/public/login.html');
    }
});

// Serve registration page
app.get('/register-page', (req, res) => {
    res.sendFile(__dirname + '/public/register.html');
});

// Serve password setting page
app.get('/password', (req, res) => {
    res.sendFile(__dirname + '/public/password.html');
});

// Handle user registration
app.post('/register', (req, res) => {
    const { username } = req.body;
    const hash = bcrypt.hashSync(username, 10);
    users[hash] = { username, expiresAt: Date.now() + 600000 };
    QRCode.toDataURL(`http://localhost:8080/password?user=${hash}`, (err, url) => {
        if (err) throw err;
        res.send(`<img src="${url}" alt="QR Code for password entry">`);
    });
});

// Handle password submission
app.post('/submit-password', (req, res) => {
    const { password, userHash } = req.body;

    if (users[userHash] && Date.now() < users[userHash].expiresAt) {
        const username = users[userHash].username;
        const hashedPassword = bcrypt.hashSync(password, 10);
        users[username] = { username, password: hashedPassword };
        fs.appendFileSync('users.txt', `${username}:${hashedPassword}\n`);
        res.cookie('username', username);
        res.redirect('/');
    } else {
        res.status(400).send('QR code expired or invalid');
    }
});

// Handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const userData = users[username];

    if (userData && bcrypt.compareSync(password, userData.password)) {
        res.cookie('username', username);
        res.redirect('/');
    } else {
        res.status(400).send('Invalid login');
    }
});

// Handle making coffee
app.post('/make-coffee', (req, res) => {
    const { username } = req.body;

    if (req.cookies.username) {
        // Increase coffee count (store in users object for demo)
        users[username].coffee_count = (users[username].coffee_count || 0) + 1;
        res.send({ message: 'Káva byla uvařena!', coffee_count: users[username].coffee_count });
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Server listening
app.listen(8080, () => {
    console.log('Server listening on http://localhost:8080');
});
