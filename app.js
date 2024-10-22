const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Import CORS

const app = express();
app.use(cors()); // Enable CORS
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cookieParser());
app.use(express.static('public')); // Serve static files from the public folder

const users = {}; // In-memory user storage

// Load users from file
function loadUsers() {
    const filePath = path.join(__dirname, 'users.json');

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const usersArray = JSON.parse(data);

        usersArray.forEach(user => {
            const { username, password } = user;
            users[username] = { username, password }; // Store in users object
        });
    }
}

// Load coffee types from file
function loadCoffeeTypes() {
    if (fs.existsSync('coffee_types.json')) {
        return JSON.parse(fs.readFileSync('coffee_types.json', 'utf8'));
    }
    return [];
}

// Load orders from file
function loadOrders() {
    if (fs.existsSync('orders.json')) {
        return JSON.parse(fs.readFileSync('orders.json', 'utf8'));
    }
    return [];
}

// Serve registration page
app.get('/register-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Check if username exists
app.get('/check-username', (req, res) => {
    const { username } = req.query;
    const exists = Object.keys(users).includes(username);
    res.json({ exists });
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve password entry page
app.get('/password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'password.html'));
});

// Handle user registration
// Handle user registration
app.post('/register', (req, res) => {
    const { username } = req.body;
    const hash = bcrypt.hashSync(username, 10);

    // Check if username already exists
    const filePath = path.join(__dirname, 'users.json');
    let existingUsers = [];

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        existingUsers = JSON.parse(data);
    }

    // Prevent duplicate usernames
    const userExists = existingUsers.some(user => user.username === username);
    if (userExists) {
        return res.status(400).send('Username already exists. Please choose a different username.');
    }

    // Store the user with a temporary expiration time
    users[hash] = { username, expiresAt: Date.now() + 600000 }; // QR code valid for 10 minutes

    // Generate QR Code and send it to the user
    QRCode.toDataURL(`http://localhost:8080/password?user=${hash}`, (err, url) => {
        if (err) throw err;
        res.send(`
            <h1>Registration Successful</h1>
            <p>Scan this QR code to proceed to set your password:</p>
            <img src="${url}" alt="QR Code">
        `);
    });
});

// Handle password submission
// Handle password submission
app.post('/submit-password', (req, res) => {
    const { password, userHash } = req.body;

    // Check if the user exists and if the QR code is valid
    if (users[userHash] && Date.now() < users[userHash].expiresAt) {
        const username = users[userHash].username;
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        // Load existing users from users.json
        const filePath = path.join(__dirname, 'users.json');
        let existingUsers = [];

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            existingUsers = JSON.parse(data);
        }

        // Check if the user already exists
        const userExists = existingUsers.some(user => user.username === username);

        if (userExists) {
            return res.status(400).send('Username already exists. Please choose a different username.'); // Prevent duplicate usernames
        } else {
            // Add the new user to the array
            existingUsers.push({ username, password: hashedPassword });

            // Write back to users.json
            fs.writeFileSync(filePath, JSON.stringify(existingUsers, null, 2));
            
            // Set cookie and redirect
            res.cookie('username', username);
            res.redirect('/coffee_order'); // Redirect to the coffee order page
        }
    } else {
        res.status(400).send('QR code expired or invalid');
    }
});


// Serve coffee order page
app.get('/coffee_order', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

// Handle user login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const userData = users[username];

    if (userData && bcrypt.compareSync(password, userData.password)) {
        res.cookie('username', username);
        res.redirect('/coffee_order'); // Redirect to the coffee order page
    } else {
        res.status(400).send('Invalid login');
    }
});

// Coffee types management
app.get('/coffee-types', (req, res) => {
    const coffeeTypes = loadCoffeeTypes();
    res.json(coffeeTypes);
});

// Add a new coffee type
app.post('/coffee-types', (req, res) => {
    const { name, description } = req.body;
    const coffeeTypes = loadCoffeeTypes();
    const newCoffee = { id: coffeeTypes.length + 1, name, description };

    coffeeTypes.push(newCoffee);
    fs.writeFileSync('coffee_types.json', JSON.stringify(coffeeTypes, null, 2));
    res.status(201).json(newCoffee);
});

// Orders management
app.get('/orders', (req, res) => {
    const orders = loadOrders();
    res.json(orders);
});


// Provide list of users
app.get('/getPeopleList', (req, res) => {
    const peopleList = Object.values(users).map(user => ({ ID: user.username, name: user.username }));
    res.json(peopleList);
});

// Provide list of coffee types
// Handle orders
app.post('/orders', (req, res) => {
    // Log the entire request body for debugging
    console.log('Received request body:', req.body);
    
    // Destructure username and drinkQuantities from the request body
    const { username, drinkQuantities } = req.body;

    // Validate that both username and drinkQuantities exist
    if (!username || !drinkQuantities) {
        console.error('Missing username or drinkQuantities');
        return res.status(400).json({ error: 'Username and drink quantities are required.' });
    }

    // Log the values to ensure they are what you expect
    console.log('Username:', username);
    console.log('Drink Quantities:', drinkQuantities);

    // Load existing orders
    const orders = loadOrders();

    // Create a new order with a timestamp
    const newOrder = {
        id: orders.length + 1, // Create a new ID based on current orders length
        username,
        drinkQuantities,
        date: new Date().toISOString() // Store the date in ISO format
    };
    console.log('New Order:', JSON.stringify(newOrder, null, 2));
    // Add the new order to the orders list
    orders.push(newOrder);

    // Save to file with pretty formatting
    try {
        fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
    } catch (writeError) {
        console.error('Error writing orders to file:', writeError);
        return res.status(500).json({ error: 'Error saving order.' });
    }

    // Respond with the complete order details
    res.status(201).json(newOrder);
});





// Load drinks from JSON file
app.get('/getTypesList', (req, res) => {
    fs.readFile('drinks.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading drink types' });
        }
        res.json(JSON.parse(data));
    });
});



// Load users on startup
loadUsers();

// Server listening
app.listen(8080, () => {
    console.log('Server listening on http://localhost:8080');
});
