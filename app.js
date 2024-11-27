const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const users = {};

// Load users from file
function loadUsers() {
    const filePath = path.join(__dirname, 'users.json');
    console.log('Loading users from:', filePath);

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const usersArray = JSON.parse(data);
        console.log('Users loaded:', usersArray);

        usersArray.forEach(user => {
            const { username, password } = user;
            users[username] = { username, password };
        });
    } else {
        console.warn('User file does not exist:', filePath);
    }
}

// Load coffee types from file
function loadCoffeeTypes() {
    if (fs.existsSync('coffee_types.json')) {
        const coffeeTypes = JSON.parse(fs.readFileSync('coffee_types.json', 'utf8'));
        console.log('Coffee types loaded:', coffeeTypes);
        return coffeeTypes;
    }
    console.warn('Coffee types file does not exist.');
    return [];
}

// Load orders from file
function loadOrders() {
    if (fs.existsSync('orders.json')) {
        const orders = JSON.parse(fs.readFileSync('orders.json', 'utf8'));
        console.log('Orders loaded:', orders);
        return orders;
    }
    console.warn('Orders file does not exist.');
    return [];
}

// Serve registration page
app.get('/register-page', (req, res) => {
    console.log('Serving registration page');
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Check if username exists
app.get('/check-username', (req, res) => {
    const { username } = req.query;
    const exists = Object.keys(users).includes(username);
    console.log(`Checking if username exists: ${username} -> ${exists}`);
    res.json({ exists });
});

// Serve login page
app.get('/login', (req, res) => {
    console.log('Serving login page');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve password entry page
app.get('/password', (req, res) => {
    console.log('Serving password entry page');
    res.sendFile(path.join(__dirname, 'public', 'password.html'));
});

// Handle user registration
app.post('/register', (req, res) => {
    const { username } = req.body;
    const hash = bcrypt.hashSync(username, 10);
    console.log(`Registering user: ${username}`);

    const filePath = path.join(__dirname, 'users.json');
    let existingUsers = [];

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        existingUsers = JSON.parse(data);
    }

    const userExists = existingUsers.some(user => user.username === username);
    if (userExists) {
        console.warn(`Username already exists: ${username}`);
        return res.status(400).send('Username already exists. Please choose a different username.');
    }

    users[hash] = { username, expiresAt: Date.now() + 600000 };
    console.log('User registered, generating QR code');

    QRCode.toDataURL(`http://141.144.241.160/kafe/password?user=${hash}`, (err, url) => {
        if (err) throw err;
        res.send(`
            <h1>Registration Successful</h1>
            <p>Scan this QR code to proceed to set your password:</p>
            <img src="${url}" alt="QR Code">
        `);
    });
});

// Handle password submission
app.post('/submit-password', (req, res) => {
    const { password, userHash } = req.body;
    console.log(`Submitting password for user: ${userHash}`);

    if (users[userHash] && Date.now() < users[userHash].expiresAt) {
        const username = users[userHash].username;
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        const filePath = path.join(__dirname, 'users.json');
        let existingUsers = [];

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            existingUsers = JSON.parse(data);
        }

        const userExists = existingUsers.some(user => user.username === username);

        if (userExists) {
            console.warn(`Username already exists during password submission: ${username}`);
            return res.status(400).send('Username already exists. Please choose a different username.');
        } else {
            existingUsers.push({ username, password: hashedPassword });
            fs.writeFileSync(filePath, JSON.stringify(existingUsers, null, 2));
            console.log(`Password set for user: ${username}`);
            res.cookie('username', username);
            res.redirect('coffee_order');
        }
    } else {
        console.warn('QR code expired or invalid for user:', userHash);
        res.status(400).send('QR code expired or invalid');
    }
});

// Serve coffee order page
app.get('/coffee_order', (req, res) => {
    console.log('Serving coffee order page');
    res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

// Handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`User attempting to log in: ${username}`);

    const userData = users[username];

    if (userData && bcrypt.compareSync(password, userData.password)) {
        console.log(`Login successful for user: ${username}`);
        res.cookie('username', username);
        res.redirect('coffee_order');
    } else {
        console.warn('Invalid login attempt for user:', username);
        res.status(400).send('Invalid login');
    }
});

// Coffee types management
app.get('/coffee-types', (req, res) => {
    const coffeeTypes = loadCoffeeTypes();
    res.json(coffeeTypes);
});

// Add a new coffee type
// app.post('/coffee-types', (req, res) => {
//     const { name, description, count } = req.body;
//     console.log(`Adding new coffee type: ${name}, Description: ${description}, Count: ${count}`);

//     const coffeeTypes = loadCoffeeTypes();
//     const newCoffee = { id: coffeeTypes.length + 1, name, description, count };

//     coffeeTypes.push(newCoffee);
//     fs.writeFileSync('coffee_types.json', JSON.stringify(coffeeTypes, null, 2));
//     console.log('New coffee type added:', newCoffee);
//     res.status(201).json(newCoffee);
// });

// Orders management
app.get('/orders', (req, res) => {
    const orders = loadOrders();
    res.json(orders);
});

// Provide list of users
app.get('/getPeopleList', (req, res) => {
    const peopleList = Object.values(users).map(user => ({ ID: user.username, name: user.username }));
    console.log('Providing list of users:', peopleList);
    res.json(peopleList);
});

// Edit multiple drinks by
// Handle orders
app.post('/orders', (req, res) => {
    console.log('Received order request:', req.body);
    
    const { username, drinkQuantities } = req.body;

    if (!username || !drinkQuantities) {
        console.warn('Missing username or drinkQuantities:', req.body);
        return res.status(400).json({ error: 'Username and drink quantities are required.' });
    }

    const orders = loadOrders();
    const newOrder = {
        id: orders.length + 1,
        username,
        drinkQuantities,
        date: new Date().toISOString()
    };
    console.log('Creating new order:', newOrder);
    
    orders.push(newOrder);

    try {
        fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
    } catch (writeError) {
        console.error('Error writing orders to file:', writeError);
        return res.status(500).json({ error: 'Error saving order.' });
    }

    res.status(201).json(newOrder);
});

// Load drinks from JSON file
app.get('/getTypesList', (req, res) => {
    const filePath = path.join(__dirname, 'drinks.json');
    console.log('Loading drinks from:', filePath);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading drink types:', err);
            return res.status(500).json({ error: 'Error reading drink types' });
        }
        const drinks = JSON.parse(data);
        console.log('Providing list of drink types:', drinks);
        res.json(drinks);
    });
});

// Load users on startup
loadUsers();

// Server listening
app.listen(8080, () => {
    console.log('Server listening on http://localhost:8080');
});
