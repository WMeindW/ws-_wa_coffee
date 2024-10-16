// Odeslání hesla
function submitPassword() {
    const password = document.getElementById('password').value;
    const userHash = new URLSearchParams(window.location.search).get('user');

    fetch('/submit-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, userHash }),
    })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            } else {
                alert('QR code expired or invalid');
            }
        });
}

// Uvaření kávy
function makeCoffee() {
    const username = document.getElementById('coffeeUsername').value;

    fetch('/make-coffee', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                alert('Unauthorized or error occurred');
            }
        })
        .then(data => {
            if (data) {
                document.getElementById('coffeeCount').innerText = `Počet uvařených káv: ${data.coffee_count}`;
            }
        });
}