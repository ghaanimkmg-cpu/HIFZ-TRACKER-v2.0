const API_BASE = window.location.protocol + '//' + window.location.hostname + ':8081';

// Function to check if user is already logged in (used by "Continue to tracker")
async function checkSessionAndRedirect() {
    try {
        const response = await fetch(`${API_BASE}/students`, {
            method: 'GET',
            credentials: 'include'
        });
        if (response.ok) {
            window.location.href = 'index.html?v=4';
        } else {
            showError("No active session found. Please log in.");
        }
    } catch (err) {
        showError("Could not connect to server.");
    }
}

// Function to handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('login-btn');
    const form = event.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    
    if (!username || !password) {
        showError("Username and password are required.");
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    hideError();
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = 'index.html?v=4';
        } else {
            showError(data.detail || "Login failed");
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    } catch (err) {
        showError("Could not connect to server.");
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

// Function to handle signup form submission
async function handleSignup(event) {
    event.preventDefault();
    const btn = document.getElementById('signup-btn');
    const form = event.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    
    if (!username || !password) {
        showError("Username and password are required.");
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    hideError();
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // After successful signup, redirect to login with a success message
            window.location.href = 'login.html?registered=true';
        } else {
            showError(data.detail || "Signup failed");
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    } catch (err) {
        showError("Could not connect to server.");
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        let text = msg;
        if (Array.isArray(msg) && msg.length > 0 && msg[0].msg) {
            text = msg[0].msg.replace('Value error, ', '');
        } else if (typeof msg === 'object') {
            text = JSON.stringify(msg);
        }
        errorDiv.textContent = text;
        errorDiv.style.display = 'block';
    }
}

function hideError() {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Attach event listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    
    const continueBtn = document.getElementById('continue-tracker-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
            e.preventDefault();
            checkSessionAndRedirect();
        });
    }
    
    // Show success message if redirected from signup
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = "Account created successfully. Please log in.";
            errorDiv.style.display = 'block';
            errorDiv.style.background = '#ecfdf5';
            errorDiv.style.color = '#059669';
            errorDiv.style.borderColor = '#a7f3d0';
        }
    }
});
