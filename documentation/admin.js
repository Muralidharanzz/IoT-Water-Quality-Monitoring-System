import { database, auth } from '../website/js/firebase-config.js';
import { ref, onValue, get, update, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
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
    pendingUsers: document.getElementById('pending-users-list'),
    totalUsers: document.getElementById('stat-total-users'),
    totalRecords: document.getElementById('stat-total-records'),
    adminName: document.getElementById('admin-name'),
    historyChartCanvas: document.getElementById('historyChart')
};

// Global Chart Instance
let historyChart;

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

    // Overall Status
    const statuses = [phStatus.status, tdsStatus.status, turbStatus.status, tempStatus.status];

    if (statuses.includes('Danger')) {
        elements.statusText.textContent = "UNSAFE";
        elements.statusText.className = "fw-bold my-3 text-danger";
        elements.recommendation.textContent = "Water quality is hazardous. Immediate action required. Do not consume.";
        elements.statusCard.className = "glass-card p-4 mb-5 text-center bg-danger bg-opacity-10 border-danger";

        elements.alertBanner.classList.remove('d-none');
        elements.alertMessage.innerHTML = `High Alert: 
            ${phStatus.status === 'Danger' ? `pH (${data.ph}) ` : ''}
            ${tdsStatus.status === 'Danger' ? `TDS (${data.tds}) ` : ''}
            ${turbStatus.status === 'Danger' ? `Turbidity (${data.turbidity}) ` : ''}
            ${tempStatus.status === 'Danger' ? `Temp (${data.temperature}) ` : ''} out of safe bounds.`;

    } else if (statuses.includes('Warning')) {
        elements.statusText.textContent = "WARNING";
        elements.statusText.className = "fw-bold my-3 text-warning";
        elements.recommendation.textContent = "Water parameters are approaching unsafe limits. Monitor closely.";
        elements.statusCard.className = "glass-card p-4 mb-5 text-center bg-warning bg-opacity-10 border-warning";
        elements.alertBanner.classList.add('d-none');
    } else {
        elements.statusText.textContent = "SAFE";
        elements.statusText.className = "fw-bold my-3 text-success";
        elements.recommendation.textContent = "All parameters are within safe limits. Water is strictly monitored.";
        elements.statusCard.className = "glass-card p-4 mb-5 text-center bg-success bg-opacity-10 border-success";
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

// User Approvals
function listenToPendingUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const usersObj = snapshot.val();
            const pending = [];
            let total = 0;

            for (const [uid, user] of Object.entries(usersObj)) {
                total++;
                if (user.role === 'user' && user.approved === false) {
                    pending.push({ uid, ...user });
                }
            }

            elements.totalUsers.textContent = total;
            renderPendingUsers(pending);
        }
    });
}

function renderPendingUsers(pendingList) {
    if (pendingList.length === 0) {
        elements.pendingUsers.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No pending users</td></tr>';
        return;
    }

    elements.pendingUsers.innerHTML = '';
    pendingList.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name || user.email || 'User'}</td>
            <td><span class="badge bg-secondary">User</span></td>
            <td>
                <button class="btn btn-sm btn-success approve-btn" data-uid="${user.uid}">
                    <i class="bi bi-check-circle"></i> Approve
                </button>
            </td>
        `;
        elements.pendingUsers.appendChild(tr);
    });

    // Attach click listeners
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.currentTarget.getAttribute('data-uid');
            try {
                const updates = {};
                updates[`users/${uid}/approved`] = true;
                await update(ref(database), updates);
                alert('User approved successfully!');
            } catch (e) {
                console.error("Error approving user:", e);
                alert('Failed to approve user.');
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
            csvContent += "Timestamp,pH,TDS (ppm),Turbidity (NTU),Temperature (°C),Status\n";

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
