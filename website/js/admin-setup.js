import { auth, database } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const form = document.getElementById('admin-setup-form');
const errorEl = document.getElementById('setup-error');
const successEl = document.getElementById('setup-success');
const btn = document.getElementById('setup-btn');

// Check if an admin already exists
(async () => {
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
            const users = snapshot.val();
            const hasAdmin = Object.values(users).some(u => u.role === 'admin');
            if (hasAdmin) {
                form.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>An admin account already exists. <a href="index.html">Go to Login</a></div>';
                return;
            }
        }
    } catch (e) {
        // DB might not be accessible yet, that's ok
    }
})();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    try {
        btn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Creating...';
        btn.disabled = true;
        errorEl.classList.add('d-none');
        successEl.classList.add('d-none');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await set(ref(database, `users/${user.uid}`), {
            name: name,
            email: email,
            role: 'admin',
            approved: true,
            createdAt: new Date().toISOString()
        });

        successEl.innerHTML = '<i class="bi bi-check-circle me-2"></i>Admin account created! <a href="index.html" class="alert-link">Go to Login</a>';
        successEl.classList.remove('d-none');
        btn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Done!';

    } catch (error) {
        console.error(error);
        btn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Create Admin Account';
        btn.disabled = false;
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = "This email is already registered.";
        } else {
            errorEl.textContent = "Failed to create admin. " + error.message;
        }
        errorEl.classList.remove('d-none');
    }
});
