import { database, auth } from './firebase-config.js';
import { ref, onValue, get, query, limitToLast, push } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
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
    userGreeting: document.getElementById('user-greeting'),
    lastUpdated: document.getElementById('last-updated'),
    sidebarUserName: document.getElementById('sidebar-user-name'),
    detailPh: document.getElementById('detail-ph'),
    detailTds: document.getElementById('detail-tds'),
    detailTurb: document.getElementById('detail-turb'),
    detailTemp: document.getElementById('detail-temp'),
    detailBadgePh: document.getElementById('detail-badge-ph'),
    detailBadgeTds: document.getElementById('detail-badge-tds'),
    detailBadgeTurb: document.getElementById('detail-badge-turb'),
    detailBadgeTemp: document.getElementById('detail-badge-temp')
};

// Thresholds
const SAFE_LIMITS = {
    ph: { min: 6.5, max: 8.5 },
    tds: { max: 300 },
    turb: { max: 5 },
    temp: { max: 35 }
};

let currentUserDoc = null;

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
        currentUserDoc = userData;

        if (userData.role !== 'user' || !userData.approved) {
            window.location.href = 'index.html'; // Kick unauthorized or unapproved
        } else {
            const displayName = userData.name || 'User';
            elements.userGreeting.textContent = `Welcome, ${displayName}`;
            if (elements.sidebarUserName) elements.sidebarUserName.textContent = displayName;
            initUserChart();
            listenToLiveData();
            listenToHistory();
        }
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        const user = auth.currentUser;
        if (user && currentUserDoc) {
            try {
                await push(ref(database, 'auth_logs'), {
                    email: user.email,
                    name: currentUserDoc.name || 'User',
                    role: currentUserDoc.role || 'user',
                    action: 'Logout',
                    timestamp: Date.now()
                });
            } catch (logError) {
                console.error("Logout logging failed:", logError);
            }
        }
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        await signOut(auth);
        window.location.href = 'index.html';
    }
});

// Sidebar Toggle (mobile)
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('d-none');
    });
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.add('d-none');
    });
    // Close sidebar when nav link clicked on mobile
    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.add('d-none');
            }
        });
    });
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

let connectionInterval;
let lastDataTimestamp = 0;

function updateConnectionStatus(timestamp) {
    const connStatusEl = document.getElementById('connection-status');
    if (!connStatusEl) return;
    
    let ts = timestamp;
    if (!isNaN(Number(ts))) {
        ts = Number(ts);
        if (ts > 1e11) ts = ts / 1000;
    }
    
    const currentSeconds = Date.now() / 1000;
    const isOnline = (currentSeconds - ts) < 120;
    
    if (isOnline) {
        connStatusEl.className = 'status-badge status-safe online-badge d-flex align-items-center';
        connStatusEl.innerHTML = '<i class="bi bi-wifi me-1"></i>Online';
    } else {
        connStatusEl.className = 'status-badge status-danger online-badge d-flex align-items-center opacity-75';
        connStatusEl.innerHTML = '<i class="bi bi-wifi-off me-1"></i>Offline';
    }
}

// Listen to Latest Sensor Data
function listenToLiveData() {
    const latestRef = ref(database, 'current');
    onValue(latestRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            lastDataTimestamp = data.timestamp || (Date.now() / 1000);
            updateDashboardUI(data);
            updateConnectionStatus(lastDataTimestamp);
        }
    });

    clearInterval(connectionInterval);
    connectionInterval = setInterval(() => {
        if (lastDataTimestamp > 0) {
            updateConnectionStatus(lastDataTimestamp);
        }
    }, 10000);
}

function updateDashboardUI(data) {
    // Update Values (rounded to 2 decimal places)
    const fmt = (v) => parseFloat(v).toFixed(2);
    elements.phVal.textContent = fmt(data.ph);
    elements.tdsVal.textContent = fmt(data.tds);
    elements.turbVal.textContent = fmt(data.turbidity);
    elements.tempVal.textContent = fmt(data.temperature);

    // Format timestamp
    let ts = data.timestamp;
    if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
    const date = new Date(ts);
    elements.lastUpdated.textContent = date.toLocaleString('en-IN');

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

    // Update Detail Table
    if (elements.detailPh) {
        elements.detailPh.textContent = fmt(data.ph);
        elements.detailTds.textContent = fmt(data.tds) + ' ppm';
        elements.detailTurb.textContent = fmt(data.turbidity) + ' NTU';
        elements.detailTemp.textContent = fmt(data.temperature) + '°C';
        updateBadge(elements.detailBadgePh, phStatus);
        updateBadge(elements.detailBadgeTds, tdsStatus);
        updateBadge(elements.detailBadgeTurb, turbStatus);
        updateBadge(elements.detailBadgeTemp, tempStatus);
    }

    // Water Intelligence - analyze and render
    const analysis = analyzeWaterQuality(data);
    renderIntelligenceUI(analysis);

    // Alert banner + toast + email
    if (analysis.exceededCount >= 3) {
        elements.alertBanner.classList.remove('d-none');
        elements.alertMessage.textContent = `Community Alert: ${analysis.exceededCount} parameters out of safe bounds. ${analysis.status.recommendation}`;
        showToast(`⚠️ ${analysis.status.label}: ${analysis.exceededCount} parameters exceeded!`, 'danger');
        // Send email alert to admin + user
        const userEmail = auth.currentUser?.email || '';
        sendCriticalEmailAlert(analysis, userEmail);
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

// ==================== CHART ====================
let userChart;
let allHistoryData = [];

function initUserChart() {
    const ctx = document.getElementById('userHistoryChart').getContext('2d');

    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    userChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'pH', data: [], borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.1)', tension: 0.4, fill: false, pointRadius: 3 },
                { label: 'TDS (/10)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', tension: 0.4, fill: false, pointRadius: 3 },
                { label: 'Turbidity', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: false, pointRadius: 3 },
                { label: 'Temp', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.4, fill: false, pointRadius: 3 }
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

function listenToHistory() {
    const pointCount = parseInt(document.getElementById('chart-range')?.value || '20');
    const historyRef = query(ref(database, 'history'), limitToLast(pointCount));
    onValue(historyRef, (snapshot) => {
        if (snapshot.exists()) {
            const dataObj = snapshot.val();
            allHistoryData = Object.values(dataObj).sort((a, b) => {
                const tsA = !isNaN(Number(a.timestamp)) ? Number(a.timestamp) * 1000 : new Date(a.timestamp).getTime();
                const tsB = !isNaN(Number(b.timestamp)) ? Number(b.timestamp) * 1000 : new Date(b.timestamp).getTime();
                return tsA - tsB;
            });
            applyDateFilter();
        }
    });
}

function applyDateFilter() {
    let filtered = [...allHistoryData];
    const fromVal = document.getElementById('date-from')?.value;
    const toVal = document.getElementById('date-to')?.value;

    if (fromVal) {
        const fromDate = new Date(fromVal).getTime();
        filtered = filtered.filter(d => {
            const ts = !isNaN(Number(d.timestamp)) ? Number(d.timestamp) * 1000 : new Date(d.timestamp).getTime();
            return ts >= fromDate;
        });
    }
    if (toVal) {
        const toDate = new Date(toVal).getTime() + 86400000; // include end day
        filtered = filtered.filter(d => {
            const ts = !isNaN(Number(d.timestamp)) ? Number(d.timestamp) * 1000 : new Date(d.timestamp).getTime();
            return ts <= toDate;
        });
    }

    updateUserChart(filtered);
}

function updateUserChart(dataList) {
    if (!userChart) return;

    const labels = dataList.map(d => {
        let ts = d.timestamp;
        if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
        const date = new Date(ts);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    });

    userChart.data.labels = labels;
    userChart.data.datasets[0].data = dataList.map(d => d.ph);
    userChart.data.datasets[1].data = dataList.map(d => d.tds / 10);
    userChart.data.datasets[2].data = dataList.map(d => d.turbidity);
    userChart.data.datasets[3].data = dataList.map(d => d.temperature);

    userChart.update();
}

// ==================== FILTER & EXPORT ====================

// Filter button
document.getElementById('filter-btn')?.addEventListener('click', () => {
    listenToHistory();
    showToast('Chart updated with filter', 'info');
});

// CSV Export
document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    if (allHistoryData.length === 0) { showToast('No data to export', 'warning'); return; }
    const headers = 'Timestamp,pH,TDS (ppm),Turbidity (NTU),Temperature (°C)\n';
    const rows = allHistoryData.map(d => {
        let ts = d.timestamp;
        if (!isNaN(Number(ts))) ts = Number(ts) * 1000;
        return `${new Date(ts).toLocaleString('en-IN')},${d.ph},${d.tds},${d.turbidity},${d.temperature}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquasense_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded!', 'success');
});

// PDF Export
document.getElementById('export-pdf-btn')?.addEventListener('click', async () => {
    if (allHistoryData.length === 0) { showToast('No data to export', 'warning'); return; }

    // Dynamically load jsPDF
    if (!window.jspdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(14, 165, 233);
    doc.text('AquaSense Water Quality Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.text(`Total Records: ${allHistoryData.length}`, 14, 34);

    // Table header
    let y = 44;
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFillColor(14, 165, 233);
    doc.setTextColor(255);
    doc.rect(14, y - 5, 182, 8, 'F');
    doc.text('Timestamp', 16, y);
    doc.text('pH', 70, y);
    doc.text('TDS (ppm)', 90, y);
    doc.text('Turbidity', 120, y);
    doc.text('Temp (°C)', 150, y);
    y += 8;

    doc.setTextColor(0);
    allHistoryData.forEach((d, i) => {
        if (y > 280) { doc.addPage(); y = 20; }
        let ts = d.timestamp;
        if (!isNaN(Number(ts))) ts = Number(ts) * 1000;

        if (i % 2 === 0) {
            doc.setFillColor(240, 240, 240);
            doc.rect(14, y - 5, 182, 7, 'F');
        }

        doc.text(new Date(ts).toLocaleString('en-IN'), 16, y);
        doc.text(String(d.ph), 70, y);
        doc.text(String(d.tds), 90, y);
        doc.text(String(d.turbidity), 120, y);
        doc.text(String(d.temperature), 150, y);
        y += 7;
    });

    doc.save(`aquasense_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF report downloaded!', 'success');
});

// ==================== LEAFLET MAP ====================
function initSensorMap() {
    const mapEl = document.getElementById('sensor-map');
    if (!mapEl || typeof L === 'undefined') return;

    const map = L.map('sensor-map').setView([11.0168, 76.9558], 13); // Default: Coimbatore

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    // Sensor marker
    const marker = L.marker([11.0168, 76.9558]).addTo(map);
    marker.bindPopup('<b>AquaSense Main Station</b><br>pH, TDS, Turbidity, Temp').openPopup();

    // Fix map rendering in hidden containers
    setTimeout(() => map.invalidateSize(), 500);
}

// Init map after DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSensorMap);
} else {
    initSensorMap();
}

// ==================== WEEKLY REPORT ====================
onValue(query(ref(database, 'history'), limitToLast(50)), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = Object.values(snapshot.val());

    let safe = 0, warning = 0, critical = 0;

    data.forEach(d => {
        let exceeded = 0;
        const ph = parseFloat(d.ph);
        const tds = parseFloat(d.tds);
        const turb = parseFloat(d.turbidity);
        const temp = parseFloat(d.temperature);

        if (ph < 6.5 || ph > 8.5) exceeded++;
        if (tds > 300) exceeded++;
        if (turb > 5) exceeded++;
        if (temp > 35) exceeded++;

        if (exceeded >= 3) critical++;
        else if (exceeded >= 1) warning++;
        else safe++;
    });

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('safe-days', safe);
    el('warning-days', warning);
    el('critical-days', critical);
    el('total-readings', data.length);
});
