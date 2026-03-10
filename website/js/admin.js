import { database, auth } from './firebase-config.js';
import { ref, onValue, get, update, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { analyzeWaterQuality, renderIntelligenceUI } from './water-intelligence.js';
import { showToast, sendCriticalEmailAlert } from './notifications.js';

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
    alertBanner: document.getElementById('alert-banner'),
    alertMessage: document.getElementById('alert-message'),
    pendingUsers: document.getElementById('pending-users-list'),
    totalUsers: document.getElementById('stat-total-users'),
    totalRecords: document.getElementById('stat-total-records'),
    adminName: document.getElementById('admin-name'),
    historyChartCanvas: document.getElementById('historyChart')
};

// Global Chart Instance
let historyChart;

// Thresholds
const PARAM_RANGES = {
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
        if (userData.role !== 'admin') {
            window.location.href = 'index.html'; // Kick unauthorized
        } else {
            elements.adminName.textContent = userData.name || 'Admin User';
            initAdminDashboard();
        }
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Mobile Sidebar Toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('d-none');
    });
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.add('d-none');
    });
}

// Initialization Function
function initAdminDashboard() {
    initChart();
    listenToLiveData();
    listenToPendingUsers();
    listenToStats();
    setupExportButtons();
}

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

    // Listen for History for Chart
    const historyRef = query(ref(database, 'history'), limitToLast(20));
    onValue(historyRef, (snapshot) => {
        if (snapshot.exists()) {
            const dataObj = snapshot.val();
            // Convert to array and sort by time
            const dataList = Object.values(dataObj).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            updateChart(dataList);
            elements.totalRecords.textContent = Object.keys(dataObj).length + "+"; // Approximate
        }
    });
}

function updateDashboardUI(data) {
    // Update Values
    elements.phVal.textContent = data.ph;
    elements.tdsVal.textContent = data.tds;
    elements.turbVal.textContent = data.turbidity;
    elements.tempVal.textContent = data.temperature;

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

    // Water Intelligence - analyze and render
    const analysis = analyzeWaterQuality(data);
    renderIntelligenceUI(analysis);

    // Alert banner + toast + email
    if (analysis.exceededCount >= 3) {
        elements.alertBanner.classList.remove('d-none');
        elements.alertMessage.textContent = `High Alert: ${analysis.exceededCount} parameters out of safe bounds. ${analysis.status.recommendation}`;
        showToast(`âš ï¸ ${analysis.status.label}: ${analysis.exceededCount} parameters exceeded!`, 'danger');
        // Send email alert to admin + user
        const adminEmail = auth.currentUser?.email || '';
        sendCriticalEmailAlert(analysis, adminEmail);
    } else if (analysis.exceededCount >= 1) {
        elements.alertBanner.classList.add('d-none');
        showToast(`${analysis.status.label}: ${analysis.status.recommendation}`, 'warning');
    } else {
        elements.alertBanner.classList.add('d-none');
    }
}

function updateBadge(badgeEl, statusObj) {
    badgeEl.textContent = statusObj.status;
    badgeEl.className = `status-badge ${statusObj.class}`;
}

// Chart.js Setup
function initChart() {
    const ctx = elements.historyChartCanvas.getContext('2d');

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'pH', data: [], borderColor: '#0ea5e9', tension: 0.4 },
                { label: 'TDS ( / 10)', data: [], borderColor: '#8b5cf6', tension: 0.4 }, // Scaled down for visual layout
                { label: 'Turbidity', data: [], borderColor: '#10b981', tension: 0.4 },
                { label: 'Temp', data: [], borderColor: '#f59e0b', tension: 0.4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function updateChart(dataList) {
    if (!historyChart) return;

    const labels = dataList.map(d => {
        let ts = d.timestamp;
        if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
        const date = new Date(ts);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    });

    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = dataList.map(d => d.ph);
    historyChart.data.datasets[1].data = dataList.map(d => d.tds / 10); // scale TDS for visualization
    historyChart.data.datasets[2].data = dataList.map(d => d.turbidity);
    historyChart.data.datasets[3].data = dataList.map(d => d.temperature);

    historyChart.update();
}

// User Management â€” All Users
let currentAdminUid = null;

function listenToPendingUsers() {
    currentAdminUid = auth.currentUser?.uid;
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const usersObj = snapshot.val();
            const allUsers = [];
            let total = 0;
            for (const [uid, user] of Object.entries(usersObj)) {
                total++;
                allUsers.push({ uid, ...user });
            }
            elements.totalUsers.textContent = total;
            const countEl = document.getElementById('total-user-count');
            if (countEl) countEl.textContent = `${total} users`;
            renderAllUsers(allUsers);
        }
    });
}

function renderAllUsers(userList) {
    if (userList.length === 0) {
        elements.pendingUsers.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found</td></tr>';
        return;
    }

    userList.sort((a, b) => {
        const aPending = a.role === 'user' && a.approved === false;
        const bPending = b.role === 'user' && b.approved === false;
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
    });

    elements.pendingUsers.innerHTML = '';
    userList.forEach(user => {
        const isAdmin = user.role === 'admin';
        const isPending = user.role === 'user' && user.approved === false;
        const isApproved = user.role === 'user' && user.approved === true;
        const isSelf = user.uid === currentAdminUid;

        const roleBadge = isAdmin
            ? '<span class="badge bg-danger"><i class="bi bi-shield-fill me-1"></i>Admin</span>'
            : '<span class="badge bg-secondary"><i class="bi bi-person-fill me-1"></i>User</span>';

        let statusBadge = '';
        if (isPending) statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span>';
        else if (isApproved) statusBadge = '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Approved</span>';
        else if (isAdmin) statusBadge = '<span class="badge bg-info"><i class="bi bi-star-fill me-1"></i>Active</span>';

        let actions = '';
        if (isSelf) {
            actions = '<span class="badge bg-primary"><i class="bi bi-person-check me-1"></i>You</span>';
        } else if (isPending) {
            actions = `
                <button class="btn btn-sm btn-success me-1 approve-btn" data-uid="${user.uid}" data-name="${user.name || user.email}">
                    <i class="bi bi-check-lg"></i> Approve
                </button>
                <button class="btn btn-sm btn-outline-danger reject-btn" data-uid="${user.uid}" data-name="${user.name || user.email}">
                    <i class="bi bi-x-lg"></i> Reject
                </button>`;
        } else if (isApproved) {
            actions = `
                <button class="btn btn-sm btn-outline-warning promote-btn" data-uid="${user.uid}" data-name="${user.name || user.email}">
                    <i class="bi bi-arrow-up-circle"></i> Promote to Admin
                </button>`;
        } else if (isAdmin) {
            actions = `
                <button class="btn btn-sm btn-outline-secondary demote-btn" data-uid="${user.uid}" data-name="${user.name || user.email}">
                    <i class="bi bi-arrow-down-circle"></i> Demote to User
                </button>`;
        }

        const tr = document.createElement('tr');
        if (isPending) tr.style.background = 'rgba(255,193,7,0.05)';
        tr.innerHTML = `
            <td class="fw-semibold">${user.name || 'No Name'}${isSelf ? ' <small class="text-info">(You)</small>' : ''}</td>
            <td class="text-muted" style="font-size:0.85rem;">${user.email || '\u2014'}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        elements.pendingUsers.appendChild(tr);
    });

    attachUserActionListeners();
}

function attachUserActionListeners() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.currentTarget.dataset.uid;
            const name = e.currentTarget.dataset.name;
            if (!confirm(`Approve "${name}"? They will be able to access the dashboard.`)) return;
            try {
                await update(ref(database), { [`users/${uid}/approved`]: true });
                showToast(`\u2705 ${name} approved!`, 'success');
            } catch (err) {
                console.error("Error approving:", err);
                showToast('Failed to approve user.', 'danger');
            }
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.currentTarget.dataset.uid;
            const name = e.currentTarget.dataset.name;
            if (!confirm(`\u26a0\ufe0f Reject and remove "${name}"? This cannot be undone.`)) return;
            try {
                await update(ref(database), { [`users/${uid}`]: null });
                showToast(`\ud83d\uddd1\ufe0f ${name} rejected and removed.`, 'warning');
            } catch (err) {
                console.error("Error rejecting:", err);
                showToast('Failed to reject user.', 'danger');
            }
        });
    });

    document.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.currentTarget.dataset.uid;
            const name = e.currentTarget.dataset.name;
            if (!confirm(`\ud83d\udee1\ufe0f Promote "${name}" to ADMIN?\n\nThey will get full admin access:\n\u2022 View all sensor data\n\u2022 Approve/reject users\n\u2022 Promote/demote users\n\u2022 Configure thresholds\n\u2022 Export reports\n\nAre you sure?`)) return;
            try {
                await update(ref(database), { [`users/${uid}/role`]: 'admin', [`users/${uid}/approved`]: true });
                showToast(`\ud83d\udee1\ufe0f ${name} promoted to Admin!`, 'success');
            } catch (err) {
                console.error("Error promoting:", err);
                showToast('Failed to promote user.', 'danger');
            }
        });
    });

    document.querySelectorAll('.demote-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.currentTarget.dataset.uid;
            const name = e.currentTarget.dataset.name;
            if (!confirm(`\u2b07\ufe0f Demote "${name}" to User?\n\nThey will lose all admin privileges. Are you sure?`)) return;
            try {
                await update(ref(database), { [`users/${uid}/role`]: 'user' });
                showToast(`\u2b07\ufe0f ${name} demoted to User.`, 'warning');
            } catch (err) {
                console.error("Error demoting:", err);
                showToast('Failed to demote user.', 'danger');
            }
        });
    });
}

// Listen to overall Stats mapping
function listenToStats() {
    // handled implicitly in listenToPendingUsers & listenToLiveData
}

// Exports
function setupExportButtons() {
    document.getElementById('btn-export-csv').addEventListener('click', async () => {
        try {
            const historyRef = ref(database, 'history');
            const snapshot = await get(historyRef);
            if (!snapshot.exists()) return alert("No data available to export");

            const data = snapshot.val();
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Timestamp,pH,TDS (ppm),Turbidity (NTU),Temperature (C),Status\n";

            Object.values(data).forEach(row => {
                const phStat = evaluateParameter(row.ph, 'ph').status;
                const tsdStat = evaluateParameter(row.tds, 'tds').status;
                const rowStatus = (phStat === 'Danger' || tsdStat === 'Danger') ? 'Unsafe' : 'Safe';

                let ts = row.timestamp;
                if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
                const formattedTime = new Date(ts).toLocaleString();

                csvContent += `"${formattedTime}",${row.ph},${row.tds},${row.turbidity},${row.temperature},${rowStatus}\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `aqua_sense_data_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error(error);
            alert("Error exporting CSV");
        }
    });

    document.getElementById('btn-export-pdf').addEventListener('click', async () => {
        window.jspdf = window.jspdf || {};
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return alert("jsPDF library not loaded.");

        const doc = new jsPDF();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(14, 165, 233); // Primary color
        doc.text("AquaSense Dashboard Report", 105, 20, null, null, "center");

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, null, null, "center");

        doc.line(20, 35, 190, 35);

        // Fetch latest data for summary
        try {
            const snapshot = await get(ref(database, 'current'));
            if (snapshot.exists()) {
                const data = snapshot.val();

                doc.setFontSize(16);
                doc.setTextColor(0, 0, 0);
                doc.text("Current Parameter Snapshot", 20, 50);

                doc.setFontSize(12);
                doc.setTextColor(50, 50, 50);

                doc.text(`pH Level:`, 30, 65);
                doc.text(`${data.ph}`, 80, 65);

                doc.text(`TDS:`, 30, 75);
                doc.text(`${data.tds} ppm`, 80, 75);

                doc.text(`Turbidity:`, 30, 85);
                doc.text(`${data.turbidity} NTU`, 80, 85);

                doc.text(`Temperature:`, 30, 95);
                doc.text(`${data.temperature} C`, 80, 95);

                // Add simple footer
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text("IoT Community Water Quality Monitoring System", 105, 280, null, null, "center");

                doc.save(`AquaSense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            } else {
                alert("No current data available for Report");
            }
        } catch (e) {
            console.error(e);
            alert("Error fetching data for PDF");
        }
    });
}

// ==================== CUSTOM THRESHOLDS ====================
const THRESH_KEY = 'aquasense_thresholds';

// Safe limits â€” LOCKED to standard safe ranges (pH 6.5â€“8.5, TDS <300, Turb <5, Temp <35)
// Admins can set STRICTER limits but NEVER laxer than these standards
const SAFE_LIMITS = {
    'thresh-ph-min': { min: 6.5, max: 7.5, label: 'pH Min', unit: '', std: 6.5 },
    'thresh-ph-max': { min: 7.5, max: 8.5, label: 'pH Max', unit: '', std: 8.5 },
    'thresh-tds': { min: 50, max: 300, label: 'TDS Max', unit: ' ppm', std: 300 },
    'thresh-turb': { min: 1, max: 5, label: 'Turbidity', unit: ' NTU', std: 5 },
    'thresh-temp': { min: 20, max: 35, label: 'Temp Max', unit: 'Â°C', std: 35 }
};

function loadThresholds() {
    try {
        const saved = JSON.parse(localStorage.getItem(THRESH_KEY));
        if (saved) return saved;
    } catch { }
    return { phMin: 6.5, phMax: 8.5, tds: 300, turbidity: 5, temperature: 35 };
}

function applyThresholdsToUI() {
    const t = loadThresholds();
    const el = (id) => document.getElementById(id);
    if (el('thresh-ph-min')) el('thresh-ph-min').value = t.phMin;
    if (el('thresh-ph-max')) el('thresh-ph-max').value = t.phMax;
    if (el('thresh-tds')) el('thresh-tds').value = t.tds;
    if (el('thresh-turb')) el('thresh-turb').value = t.turbidity;
    if (el('thresh-temp')) el('thresh-temp').value = t.temperature;
}

// Real-time validation on each input
Object.keys(SAFE_LIMITS).forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    const { min, max, label, unit } = SAFE_LIMITS[id];

    // Add a warning span after input if not exists
    let warnEl = input.parentElement.querySelector('.thresh-warn');
    if (!warnEl) {
        warnEl = document.createElement('small');
        warnEl.className = 'thresh-warn d-block mt-1';
        input.parentElement.appendChild(warnEl);
    }

    // On typing â€” show warning
    input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        if (isNaN(val) || val < min || val > max) {
            warnEl.innerHTML = `<span style="color:#ef4444;"><i class="bi bi-exclamation-triangle-fill me-1"></i>Must be ${min}â€“${max}${unit}</span>`;
            input.style.borderColor = '#ef4444';
            input.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.25)';
        } else {
            warnEl.innerHTML = '';
            input.style.borderColor = '';
            input.style.boxShadow = '';
        }
    });

    // On blur â€” auto-clamp to safe range
    input.addEventListener('blur', () => {
        let val = parseFloat(input.value);
        if (isNaN(val)) val = min;
        if (val < min) { val = min; showToast(`âš ï¸ ${label} locked to minimum: ${min}${unit}`, 'warning'); }
        if (val > max) { val = max; showToast(`âš ï¸ ${label} locked to maximum: ${max}${unit}`, 'warning'); }
        input.value = val;
        warnEl.innerHTML = '';
        input.style.borderColor = '';
        input.style.boxShadow = '';
    });
});

// Save with validation
document.getElementById('save-thresholds-btn')?.addEventListener('click', () => {
    // Check all fields are in range
    let hasError = false;
    Object.keys(SAFE_LIMITS).forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        const val = parseFloat(input.value);
        const { min, max } = SAFE_LIMITS[id];
        if (isNaN(val) || val < min || val > max) {
            hasError = true;
            input.dispatchEvent(new Event('input')); // trigger warning display
        }
    });

    if (hasError) {
        showToast('âš ï¸ Fix values in red before saving! All thresholds must be within safe limits.', 'warning');
        return;
    }

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const t = {
        phMin: clamp(parseFloat(document.getElementById('thresh-ph-min')?.value || '6.5'), 6.5, 7.5),
        phMax: clamp(parseFloat(document.getElementById('thresh-ph-max')?.value || '8.5'), 7.5, 8.5),
        tds: clamp(parseFloat(document.getElementById('thresh-tds')?.value || '300'), 50, 300),
        turbidity: clamp(parseFloat(document.getElementById('thresh-turb')?.value || '5'), 1, 5),
        temperature: clamp(parseFloat(document.getElementById('thresh-temp')?.value || '35'), 20, 35)
    };
    localStorage.setItem(THRESH_KEY, JSON.stringify(t));
    const msg = document.getElementById('thresh-save-msg');
    if (msg) {
        msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Saved!</span>';
        setTimeout(() => { msg.innerHTML = ''; }, 3000);
    }
    showToast('âœ… Thresholds saved within safe limits!', 'success');
});

// Load thresholds on init
applyThresholdsToUI();

// ==================== ANALYTICS SUMMARY ====================
function computeAnalytics(historyData) {
    if (!historyData || historyData.length === 0) return;

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const phArr = historyData.map(d => parseFloat(d.ph)).filter(n => !isNaN(n));
    const tdsArr = historyData.map(d => parseFloat(d.tds)).filter(n => !isNaN(n));
    const turbArr = historyData.map(d => parseFloat(d.turbidity)).filter(n => !isNaN(n));
    const tempArr = historyData.map(d => parseFloat(d.temperature)).filter(n => !isNaN(n));

    const avgPh = phArr.length ? avg(phArr) : 0;
    const avgTds = tdsArr.length ? avg(tdsArr) : 0;
    const avgTurb = turbArr.length ? avg(turbArr) : 0;
    const avgTemp = tempArr.length ? avg(tempArr) : 0;

    // Current values (last entry)
    const last = historyData[historyData.length - 1];
    const curPh = parseFloat(last.ph);
    const curTds = parseFloat(last.tds);
    const curTurb = parseFloat(last.turbidity);
    const curTemp = parseFloat(last.temperature);

    function trendIcon(cur, avgVal) {
        if (cur > avgVal * 1.05) return '<span style="color:#ef4444;"><i class="bi bi-arrow-up-short"></i>Above avg</span>';
        if (cur < avgVal * 0.95) return '<span style="color:#10b981;"><i class="bi bi-arrow-down-short"></i>Below avg</span>';
        return '<span style="color:#f59e0b;"><i class="bi bi-dash"></i>Normal</span>';
    }

    const el = (id) => document.getElementById(id);
    if (el('avg-ph')) el('avg-ph').textContent = avgPh.toFixed(1);
    if (el('avg-tds')) el('avg-tds').textContent = avgTds.toFixed(0);
    if (el('avg-turb')) el('avg-turb').textContent = avgTurb.toFixed(1);
    if (el('avg-temp')) el('avg-temp').textContent = avgTemp.toFixed(1) + 'Â°';

    if (el('trend-ph')) el('trend-ph').innerHTML = trendIcon(curPh, avgPh);
    if (el('trend-tds')) el('trend-tds').innerHTML = trendIcon(curTds, avgTds);
    if (el('trend-turb')) el('trend-turb').innerHTML = trendIcon(curTurb, avgTurb);
    if (el('trend-temp')) el('trend-temp').innerHTML = trendIcon(curTemp, avgTemp);
}

// Hook analytics into history listener
onValue(query(ref(database, 'history'), limitToLast(50)), (snapshot) => {
    if (snapshot.exists()) {
        const data = Object.values(snapshot.val());
        computeAnalytics(data);
    }
});
