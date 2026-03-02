import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

// Handle UI Updates
const showError = (msg) => {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('d-none');
    loginBtn.innerHTML = 'Sign In';
    loginBtn.disabled = false;
};

// Listen for Login Submit
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            loginBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Logging in...';
            loginBtn.disabled = true;
            errorMsg.classList.add('d-none');

            // Authenticate with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Fetch User Details from Realtime DB
            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, `users/${user.uid}`));

            if (snapshot.exists()) {
                const userData = snapshot.val();

                // Role-based Routing
                if (userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (userData.role === 'user') {
                    if (userData.approved === true) {
                        window.location.href = 'user.html';
                    } else {
                        showError("Your account is waiting for Admin approval.");
                        // Sign out the unapproved user immediately
                        auth.signOut();
                    }
                } else {
                    showError("Invalid account role.");
                    auth.signOut();
                }
            } else {
                showError("User record not found in database.");
                auth.signOut();
            }
        } catch (error) {
            console.error(error);
            showError("Invalid email or password. Please try again.");
        }
    });
}

// Global Auth State Observer (can be used on admin.html / user.html)
export const checkAuthState = (requiredRole) => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Not logged in
            window.location.href = 'index.html';
        } else {
            // Logged in, verify role
            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, `users/${user.uid}`));

            if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.role !== requiredRole || (requiredRole === 'user' && !userData.approved)) {
                    // Unauthorized role
                    auth.signOut();
                    window.location.href = 'index.html';
                }
            } else {
                auth.signOut();
                window.location.href = 'index.html';
            }
        }
    });
};
