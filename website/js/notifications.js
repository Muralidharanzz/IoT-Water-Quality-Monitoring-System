// AquaSense Toast Notification System
// Usage: showToast('message', 'type') — type: 'success', 'warning', 'danger', 'info'

const TOAST_CONTAINER_ID = 'aquasense-toast-container';

function getOrCreateContainer() {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; max-width:380px; width:100%;';
        document.body.appendChild(container);
    }
    return container;
}

const TOAST_COLORS = {
    success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', icon: 'bi-check-circle-fill', color: '#10b981' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', icon: 'bi-exclamation-triangle-fill', color: '#f59e0b' },
    danger: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', icon: 'bi-x-circle-fill', color: '#ef4444' },
    info: { bg: 'rgba(14,165,233,0.15)', border: '#0ea5e9', icon: 'bi-info-circle-fill', color: '#0ea5e9' }
};

export function showToast(message, type = 'info', duration = 5000) {
    const container = getOrCreateContainer();
    const config = TOAST_COLORS[type] || TOAST_COLORS.info;

    // Log to notification history (bell dropdown)
    logNotification(message, type);

    // Send browser push for warning/danger alerts
    if (type === 'danger' || type === 'warning') {
        sendBrowserNotification('AquaSense Alert', message, type);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${config.bg};
        backdrop-filter: blur(12px);
        border: 1px solid ${config.border};
        border-left: 4px solid ${config.border};
        border-radius: 12px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: #e2e8f0;
        font-size: 0.9rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: toastSlideIn 0.3s ease-out;
        cursor: pointer;
        transition: opacity 0.3s, transform 0.3s;
    `;

    toast.innerHTML = `
        <i class="bi ${config.icon}" style="color:${config.color}; font-size:1.3rem; flex-shrink:0;"></i>
        <span style="flex:1;">${message}</span>
        <i class="bi bi-x" style="color:#94a3b8; cursor:pointer; font-size:1.1rem; flex-shrink:0;" onclick="this.parentElement.remove()"></i>
    `;

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Auto-remove
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    // Play sound if enabled
    const settings = JSON.parse(localStorage.getItem('aquasense_settings') || '{}');
    if (settings.notifSound && (type === 'danger' || type === 'warning')) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = type === 'danger' ? 880 : 660;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) { /* ignore audio errors */ }
    }

    // Browser notification if enabled
    if (settings.notifPush && 'Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('AquaSense Alert', { body: message, icon: '/icons/icon-192.png' });
        } catch (e) { /* ignore */ }
    }

    return toast;
}

// Inject toast animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(style);

// ==================== NOTIFICATION BELL & HISTORY ====================

const NOTIF_HISTORY_KEY = 'aquasense_notif_history';
const MAX_NOTIF_HISTORY = 50;

const NOTIF_ICONS = {
    success: { icon: 'bi-check-circle-fill', color: '#10b981' },
    warning: { icon: 'bi-exclamation-triangle-fill', color: '#f59e0b' },
    danger: { icon: 'bi-x-circle-fill', color: '#ef4444' },
    info: { icon: 'bi-info-circle-fill', color: '#0ea5e9' }
};

// Get notification history from localStorage
function getNotifHistory() {
    try {
        return JSON.parse(localStorage.getItem(NOTIF_HISTORY_KEY) || '[]');
    } catch { return []; }
}

// Save notification to history
export function logNotification(message, type = 'info') {
    const history = getNotifHistory();
    history.unshift({
        message,
        type,
        timestamp: Date.now(),
        read: false
    });
    // Cap at max
    if (history.length > MAX_NOTIF_HISTORY) history.length = MAX_NOTIF_HISTORY;
    localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(history));
    updateBellUI();
}

// Update bell badge & dropdown
function updateBellUI() {
    const history = getNotifHistory();
    const unread = history.filter(n => !n.read).length;

    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread > 9 ? '9+' : unread;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }

    const list = document.getElementById('notif-list');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<div class="text-center text-muted p-4"><small>No notifications yet</small></div>';
        return;
    }

    list.innerHTML = history.slice(0, 20).map(n => {
        const cfg = NOTIF_ICONS[n.type] || NOTIF_ICONS.info;
        const time = timeAgo(n.timestamp);
        return `
            <div class="d-flex align-items-start gap-2 p-3 border-bottom" style="border-color: var(--glass-border) !important; ${!n.read ? 'background: rgba(14,165,233,0.05);' : ''}">
                <i class="bi ${cfg.icon} mt-1" style="color:${cfg.color}; flex-shrink:0;"></i>
                <div style="flex:1; min-width:0;">
                    <p class="mb-0 small" style="color:#e2e8f0; word-wrap:break-word;">${n.message}</p>
                    <small class="text-muted">${time}</small>
                </div>
            </div>
        `;
    }).join('');
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// Bell toggle
document.addEventListener('DOMContentLoaded', () => {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const clearBtn = document.getElementById('notif-clear-btn');

    if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('d-none');
            // Mark all as read when opening
            if (!dropdown.classList.contains('d-none')) {
                const history = getNotifHistory();
                history.forEach(n => n.read = true);
                localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(history));
                updateBellUI();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== bellBtn && !bellBtn.contains(e.target)) {
                dropdown.classList.add('d-none');
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem(NOTIF_HISTORY_KEY);
            updateBellUI();
        });
    }

    // Initial render
    updateBellUI();

    // Request browser push permission proactively
    requestPushPermission();
});

// ==================== BROWSER PUSH NOTIFICATIONS ====================

async function requestPushPermission() {
    const settings = JSON.parse(localStorage.getItem('aquasense_settings') || '{}');
    if (!settings.notifPush) return;

    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

export function sendBrowserNotification(title, body, type = 'info') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        new Notification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: `aquasense-${type}-${Date.now()}`,
            requireInteraction: type === 'danger'
        });
    } catch (e) { /* ignore */ }
}

// ==================== EMAIL ALERT SYSTEM (EmailJS) ====================

// EmailJS Config — Update these after setting up your EmailJS account
const EMAILJS_CONFIG = {
    publicKey: 'hsdS5Y4zjJ4Itl82L',
    serviceId: 'service_r53ce9r',
    templateId: 'template_ax2y36n',
    adminEmail: 'muralidharanakpotter@gmail.com'
};

const EMAIL_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown between emails
const EMAIL_COOLDOWN_KEY = 'aquasense_last_email_alert';

// Load EmailJS SDK dynamically
let emailjsLoaded = false;
async function loadEmailJS() {
    if (emailjsLoaded) return true;
    if (EMAILJS_CONFIG.publicKey === 'YOUR_EMAILJS_PUBLIC_KEY') return false; // not configured

    try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
        emailjs.init(EMAILJS_CONFIG.publicKey);
        emailjsLoaded = true;
        return true;
    } catch (e) {
        console.warn('EmailJS failed to load:', e);
        return false;
    }
}

/**
 * Send critical email alert when 3+ parameters exceed safe limits
 * @param {Object} analysis - Water quality analysis result from analyzeWaterQuality()
 * @param {string} userEmail - Current user's email address
 */
export async function sendCriticalEmailAlert(analysis, userEmail) {
    // Check cooldown to prevent email spam
    const lastSent = parseInt(localStorage.getItem(EMAIL_COOLDOWN_KEY) || '0');
    const now = Date.now();
    if (now - lastSent < EMAIL_COOLDOWN_MS) {
        console.log(`Email alert skipped (cooldown: ${Math.round((EMAIL_COOLDOWN_MS - (now - lastSent)) / 60000)} min remaining)`);
        return false;
    }

    // Only send for critical conditions (3+ parameters exceeded)
    if (!analysis || analysis.exceededCount < 3) return false;

    const loaded = await loadEmailJS();
    if (!loaded) {
        console.warn('EmailJS not configured. Set EMAILJS_CONFIG in notifications.js');
        return false;
    }

    // Build exceeded parameters list
    const exceededList = (analysis.exceededDetails || []).map(p => {
        const labels = { ph: 'pH', tds: 'TDS', turbidity: 'Turbidity', temperature: 'Temperature' };
        return `${labels[p.param] || p.param}: ${p.value} (Safe: ${p.limit})`;
    }).join(', ');

    // Build disease list
    const diseaseList = analysis.diseases && analysis.diseases.length > 0
        ? analysis.diseases.map(d => `${d.name} (${d.severity})`).join(', ')
        : 'None predicted';

    const templateParams = {
        to_email: EMAILJS_CONFIG.adminEmail,
        user_email: userEmail || 'N/A',
        alert_level: analysis.status.label,
        risk_score: `${analysis.riskScore}%`,
        risk_level: analysis.riskLevel,
        exceeded_count: analysis.exceededCount,
        exceeded_params: exceededList,
        diseases: diseaseList,
        recommendation: analysis.status.recommendation,
        timestamp: new Date().toLocaleString('en-IN'),
        subject: `🚨 AquaSense CRITICAL: ${analysis.status.label} - ${analysis.exceededCount}/4 Parameters Exceeded`
    };

    try {
        // Send to admin
        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams);

        // Send to user (if different from admin)
        if (userEmail && userEmail !== EMAILJS_CONFIG.adminEmail) {
            await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
                ...templateParams,
                to_email: userEmail
            });
        }

        // Set cooldown
        localStorage.setItem(EMAIL_COOLDOWN_KEY, String(now));
        console.log('Critical email alert sent successfully.');
        showToast('📧 Critical alert email sent!', 'info');
        return true;
    } catch (err) {
        console.error('Email alert failed:', err);
        showToast('Email alert failed. Check EmailJS config.', 'warning');
        return false;
    }
}
