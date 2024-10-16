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

const users = {};

app.get('/', (req, res) => {
    if (req.cookies.username && req.cookies.password) {
        res.sendFile(__dirname + '/index.html');
    } else {
        res.sendFile(__dirname + '/login.html');
    }
});

app.get('/register-page', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});

app.get('/password', (req, res) => {
    res.sendFile(__dirname + '/password.html');
});

app.post('/register', (req, res) => {
    const { username } = req.body;
    const hash = bcrypt.hashSync(username, 10);
    users[hash] = { username, expiresAt: Date.now() + 300000 };
    QRCode.toDataURL(`http://localhost:8080/password?user=${hash}`, (err, url) => {
        console.log(`http://localhost:8080/password?user=${hash}`);
        if (err) throw err;
        res.send(`<img src="${url}">`);
    });
});

app.post('/submit-password', (req, res) => {
    const { password, userHash } = req.body;
    console.log(users[userHash]);
    console.log(userHash);

    if (users[userHash] && Date.now() < users[userHash].expiresAt) {
        const username = users[userHash].username;
        const hashedPassword = bcrypt.hashSync(password, 10);
        users[username] = { username, password: hashedPassword };
        fs.appendFileSync('users.txt', `${username}:${hashedPassword}\n`);
        res.cookie('username', username);
        res.cookie('password', hashedPassword);
        res.redirect('/');
    } else {
        res.status(400).send('QR code expired or invalid');
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const userData = users[username];
    if (userData && bcrypt.compareSync(password, userData.password)) {
        res.cookie('username', username);
        res.cookie('password', userData.password);
        res.redirect('/index.html');
    } else {
        res.status(400).send('Invalid login');
    }
});

app.listen(8080, () => {
    console.log('listening on port 8080');
});