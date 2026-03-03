import { auth, database } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, get, set, child } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// ==================== LOGIN ====================
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

const showLoginError = (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove('d-none');
    loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
    loginBtn.disabled = false;
};

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        try {
            loginBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Logging in...';
            loginBtn.disabled = true;
            loginError.classList.add('d-none');

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, `users/${user.uid}`));

            if (snapshot.exists()) {
                const userData = snapshot.val();

                if (userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (userData.role === 'user') {
                    if (userData.approved === true) {
                        window.location.href = 'user.html';
                    } else {
                        showLoginError("Your account is waiting for Admin approval.");
                        auth.signOut();
                    }
                } else {
                    showLoginError("Invalid account role.");
                    auth.signOut();
                }
            } else {
                showLoginError("User record not found in database.");
                auth.signOut();
            }
        } catch (error) {
            console.error(error);
            showLoginError("Invalid email or password. Please try again.");
        }
    });
}

// ==================== REGISTRATION ====================
const registerForm = document.getElementById('register-form');
const regName = document.getElementById('reg-name');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const registerError = document.getElementById('register-error');
const registerSuccess = document.getElementById('register-success');
const registerBtn = document.getElementById('register-btn');

const showRegError = (msg) => {
    registerError.textContent = msg;
    registerError.classList.remove('d-none');
    registerSuccess.classList.add('d-none');
    registerBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create Account';
    registerBtn.disabled = false;
};

const showRegSuccess = (msg) => {
    registerSuccess.textContent = msg;
    registerSuccess.classList.remove('d-none');
    registerError.classList.add('d-none');
    registerBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create Account';
    registerBtn.disabled = false;
};

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = regName.value.trim();
        const email = regEmail.value.trim();
        const password = regPassword.value;

        if (password.length < 6) {
            showRegError("Password must be at least 6 characters.");
            return;
        }

        try {
            registerBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Creating...';
            registerBtn.disabled = true;
            registerError.classList.add('d-none');
            registerSuccess.classList.add('d-none');

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Write user profile to Realtime Database
            await set(ref(database, `users/${user.uid}`), {
                name: name,
                email: email,
                role: 'user',
                approved: false,
                createdAt: new Date().toISOString()
            });

            // Sign out - they need admin approval
            await auth.signOut();

            showRegSuccess("Account created! Please wait for Admin approval before logging in.");
            registerForm.reset();

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                showRegError("This email is already registered.");
            } else if (error.code === 'auth/weak-password') {
                showRegError("Password is too weak. Use at least 6 characters.");
            } else {
                showRegError("Registration failed. Please try again.");
            }
        }
    });
}

// ==================== PASSWORD RESET ====================
const forgotLink = document.getElementById('forgot-password-link');
const resetSection = document.getElementById('reset-section');
const resetEmail = document.getElementById('reset-email');
const resetBtn = document.getElementById('reset-btn');
const resetError = document.getElementById('reset-error');
const resetSuccess = document.getElementById('reset-success');

if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetSection.classList.toggle('d-none');
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        const email = resetEmail.value.trim();
        if (!email) {
            resetError.textContent = "Please enter your email address.";
            resetError.classList.remove('d-none');
            return;
        }
        try {
            resetBtn.disabled = true;
            resetError.classList.add('d-none');
            resetSuccess.classList.add('d-none');

            await sendPasswordResetEmail(auth, email);
            resetSuccess.textContent = "Password reset email sent! Check your inbox.";
            resetSuccess.classList.remove('d-none');
            resetBtn.disabled = false;
        } catch (error) {
            console.error(error);
            resetError.textContent = "Could not send reset email. Check the address and try again.";
            resetError.classList.remove('d-none');
            resetBtn.disabled = false;
        }
    });
}

// ==================== AUTH STATE OBSERVER ====================
export const checkAuthState = (requiredRole) => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            const dbRef = ref(database);
            const snapshot = await get(child(dbRef, `users/${user.uid}`));

            if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.role !== requiredRole || (requiredRole === 'user' && !userData.approved)) {
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
