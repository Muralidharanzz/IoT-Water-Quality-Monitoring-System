import { database, auth } from './firebase-config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// DOM Elements
const elements = {
    phVal: document.getElementById('val-ph'),
    tdsVal: document.getElementById('val-tds'),
    turbVal: document.getElementById('val-turb'),
    tempVal: document.getElementById('val-temp'),
    phBadge: document.getElementById('badge-ph'),
    tdsBadge: document.getElementById('badge-tds'),
    turbBadge: document.getElementById('badge-turb'),
    tempBadge: document.getElementById('badge-temp'),
    statusText: document.getElementById('overall-status-text'),
    recommendation: document.getElementById('overall-recommendation'),
    statusCard: document.getElementById('overall-status-card'),
    alertBanner: document.getElementById('alert-banner'),
    alertMessage: document.getElementById('alert-message'),
    userGreeting: document.getElementById('user-greeting'),
    lastUpdated: document.getElementById('last-updated')
};

// Thresholds
const SAFE_LIMITS = {
    ph: { min: 6.5, max: 8.5 },
    tds: { max: 300 },
    turb: { max: 5 },
    temp: { max: 35 }
};

// Auth Guard
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Check Role
    const dbRef = ref(database);
    const snapshot = await get(ref(database, `users/${user.uid}`));

    if (snapshot.exists()) {
        const userData = snapshot.val();

        if (userData.role !== 'user' || !userData.approved) {
            window.location.href = 'index.html'; // Kick unauthorized or unapproved
        } else {
            elements.userGreeting.textContent = `Welcome, ${userData.name || 'User'}`;
            listenToLiveData();
        }
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});


// Logic to evaluate safety
function evaluateParameter(val, type) {
    if (val == null) return { status: 'Unknown', class: 'status-warning' };

    switch (type) {
        case 'ph':
            if (val >= SAFE_LIMITS.ph.min && val <= SAFE_LIMITS.ph.max) return { status: 'Safe', class: 'status-safe' };
            if (val < SAFE_LIMITS.ph.min - 0.5 || val > SAFE_LIMITS.ph.max + 0.5) return { status: 'Danger', class: 'status-danger' };
            return { status: 'Warning', class: 'status-warning' };
        case 'tds':
            if (val <= SAFE_LIMITS.tds.max) return { status: 'Safe', class: 'status-safe' };
            if (val > SAFE_LIMITS.tds.max + 100) return { status: 'Danger', class: 'status-danger' };
            return { status: 'Warning', class: 'status-warning' };
        case 'turb':
            if (val <= SAFE_LIMITS.turb.max) return { status: 'Safe', class: 'status-safe' };
            if (val > SAFE_LIMITS.turb.max + 3) return { status: 'Danger', class: 'status-danger' };
            return { status: 'Warning', class: 'status-warning' };
        case 'temp':
            if (val <= SAFE_LIMITS.temp.max) return { status: 'Safe', class: 'status-safe' };
            if (val > SAFE_LIMITS.temp.max + 5) return { status: 'Danger', class: 'status-danger' };
            return { status: 'Warning', class: 'status-warning' };
    }
}

// Listen to Latest Sensor Data
function listenToLiveData() {
    const latestRef = ref(database, 'current');
    onValue(latestRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            updateDashboardUI(data);
        }
    });
}

function updateDashboardUI(data) {
    // Update Values
    elements.phVal.textContent = data.ph;
    elements.tdsVal.textContent = data.tds;
    elements.turbVal.textContent = data.turbidity;
    elements.tempVal.textContent = data.temperature;

    // Format timestamp
    let ts = data.timestamp;
    if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
    const date = new Date(ts);
    elements.lastUpdated.textContent = date.toLocaleString();

    // Evaluate
    const phStatus = evaluateParameter(data.ph, 'ph');
    const tdsStatus = evaluateParameter(data.tds, 'tds');
    const turbStatus = evaluateParameter(data.turbidity, 'turb');
    const tempStatus = evaluateParameter(data.temperature, 'temp');

    // Update Badges
    updateBadge(elements.phBadge, phStatus);
    updateBadge(elements.tdsBadge, tdsStatus);
    updateBadge(elements.turbBadge, turbStatus);
    updateBadge(elements.tempBadge, tempStatus);

    // Overall Status
    const statuses = [phStatus.status, tdsStatus.status, turbStatus.status, tempStatus.status];

    if (statuses.includes('Danger')) {
        elements.statusText.textContent = "UNSAFE";
        elements.statusText.className = "fw-bold display-4 mb-4 text-danger";
        elements.recommendation.textContent = "DO NOT USE. Water quality is hazardous. Immediate action required. Please boil water if absolutely necessary, but consumption is strongly discouraged.";
        elements.statusCard.className = "glass-card p-5 mb-5 text-center mx-auto bg-danger bg-opacity-10 border-danger";

        elements.alertBanner.classList.remove('d-none');
        elements.alertMessage.innerHTML = `Community Alert: Parameters are out of safe bounds. Please do not consume the community water until further notice.`;

    } else if (statuses.includes('Warning')) {
        elements.statusText.textContent = "WARNING";
        elements.statusText.className = "fw-bold display-4 mb-4 text-warning";
        elements.recommendation.textContent = "Parameters are approaching unsafe limits. It is recommended to use water filters or boil water before consumption.";
        elements.statusCard.className = "glass-card p-5 mb-5 text-center mx-auto bg-warning bg-opacity-10 border-warning";
        elements.alertBanner.classList.add('d-none');
    } else {
        elements.statusText.textContent = "SAFE";
        elements.statusText.className = "fw-bold display-4 mb-4 text-success";
        elements.recommendation.textContent = "Water quality is excellent. All parameters are within healthy limits. Safe for consumption and daily use.";
        elements.statusCard.className = "glass-card p-5 mb-5 text-center mx-auto bg-success bg-opacity-10 border-success";
        elements.alertBanner.classList.add('d-none');
    }
}

function updateBadge(badgeEl, statusObj) {
    badgeEl.textContent = statusObj.status;
    badgeEl.className = `status-badge ${statusObj.class}`;
}
