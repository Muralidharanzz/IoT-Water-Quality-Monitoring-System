import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { database } from './firebase-config.js';

const SETTINGS_KEY = 'aquasense_settings';

// Default settings
const defaults = {
    darkMode: true,
    compactView: false,
    notifAlerts: true,
    notifSound: false,
    notifPush: false,
    autoRefresh: true,
    chartPoints: 20
};

// Load settings
function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        return { ...defaults, ...saved };
    } catch {
        return { ...defaults };
    }
}

// Save settings
function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Apply to UI
function applyToUI(settings) {
    document.getElementById('theme-toggle').checked = settings.darkMode;
    document.getElementById('compact-toggle').checked = settings.compactView;
    document.getElementById('notif-alerts').checked = settings.notifAlerts;
    document.getElementById('notif-sound').checked = settings.notifSound;
    document.getElementById('notif-push').checked = settings.notifPush;
    document.getElementById('auto-refresh').checked = settings.autoRefresh;
    document.getElementById('chart-points').value = settings.chartPoints;
}

// Auth guard
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Set back button
    const snapshot = await get(ref(database, `users/${user.uid}`));
    if (snapshot.exists()) {
        const role = snapshot.val().role;
        document.getElementById('back-btn').href = role === 'admin' ? 'admin.html' : 'user.html';
    }
});

// Init
const settings = loadSettings();
applyToUI(settings);

// Push notification toggle
document.getElementById('notif-push').addEventListener('change', async (e) => {
    if (e.target.checked) {
        if ('Notification' in window) {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                e.target.checked = false;
                const msg = document.getElementById('save-msg');
                msg.innerHTML = '<span class="text-warning">Browser notification permission denied.</span>';
            }
        }
    }
});

// Save button
document.getElementById('save-settings-btn').addEventListener('click', () => {
    const newSettings = {
        darkMode: document.getElementById('theme-toggle').checked,
        compactView: document.getElementById('compact-toggle').checked,
        notifAlerts: document.getElementById('notif-alerts').checked,
        notifSound: document.getElementById('notif-sound').checked,
        notifPush: document.getElementById('notif-push').checked,
        autoRefresh: document.getElementById('auto-refresh').checked,
        chartPoints: parseInt(document.getElementById('chart-points').value)
    };

    saveSettings(newSettings);

    // Apply theme immediately
    if (newSettings.darkMode) {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    const msg = document.getElementById('save-msg');
    msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Settings saved!</span>';
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
});
