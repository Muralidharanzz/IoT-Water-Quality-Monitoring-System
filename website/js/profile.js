import { database, auth } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Auth Guard
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Populate profile
    const snapshot = await get(ref(database, `users/${user.uid}`));
    if (snapshot.exists()) {
        const userData = snapshot.val();
        document.getElementById('profile-name').textContent = userData.name || 'User';
        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-role').textContent = userData.role === 'admin' ? 'Admin' : 'User';
        document.getElementById('profile-status').textContent = userData.approved ? 'Approved' : 'Pending Approval';
        document.getElementById('edit-name').value = userData.name || '';

        // Member since
        const joined = user.metadata?.creationTime;
        if (joined) {
            document.getElementById('profile-joined').textContent = new Date(joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        // Back button goes to correct dashboard
        document.getElementById('back-btn').href = userData.role === 'admin' ? 'admin.html' : 'user.html';
    }
});

// Save Name
document.getElementById('save-name-btn').addEventListener('click', async () => {
    const newName = document.getElementById('edit-name').value.trim();
    const msg = document.getElementById('name-msg');

    if (!newName) {
        msg.innerHTML = '<span class="text-danger">Please enter a name.</span>';
        return;
    }

    try {
        const user = auth.currentUser;
        await update(ref(database, `users/${user.uid}`), { name: newName });
        document.getElementById('profile-name').textContent = newName;
        msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Name updated!</span>';
    } catch (err) {
        msg.innerHTML = `<span class="text-danger">${err.message}</span>`;
    }
});

// Change Password
document.getElementById('change-password-btn').addEventListener('click', async () => {
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;
    const msg = document.getElementById('password-msg');

    if (!newPass || newPass.length < 6) {
        msg.innerHTML = '<span class="text-danger">Password must be at least 6 characters.</span>';
        return;
    }
    if (newPass !== confirmPass) {
        msg.innerHTML = '<span class="text-danger">Passwords do not match.</span>';
        return;
    }

    try {
        await updatePassword(auth.currentUser, newPass);
        msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Password updated!</span>';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
            msg.innerHTML = '<span class="text-warning">Please log out and log in again before changing password.</span>';
        } else {
            msg.innerHTML = `<span class="text-danger">${err.message}</span>`;
        }
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});
