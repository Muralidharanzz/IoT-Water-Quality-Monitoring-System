/**
 * AquaSense Water Intelligence Engine
 * Shared module for water quality analysis, disease prediction, risk assessment,
 * and disease detail modal.
 */

// ─── Safe Limits ───────────────────────────────────────────────────────────────
export const SAFE_LIMITS = {
    ph: { min: 6.5, max: 8.5 },
    tds: { max: 300 },
    turbidity: { max: 5 },
    temperature: { max: 35 }
};

// ─── Disease Knowledge Base ────────────────────────────────────────────────────
const DISEASE_INFO = {
    'Cholera': {
        icon: 'bi-bug-fill',
        color: '#ef4444',
        severity: 'Critical',
        description: 'Cholera is a severe bacterial infection caused by Vibrio cholerae. It spreads through contaminated water and can cause life-threatening dehydration within hours if untreated.',
        why: 'High turbidity creates hiding spots for bacteria in suspended particles. High temperature accelerates bacterial growth. High TDS indicates dissolved waste, sewage, or fecal contamination.',
        triggers: [
            { param: 'Turbidity', limit: '> 5 NTU', icon: 'bi-cloud-haze', color: '#f97316' },
            { param: 'Temperature', limit: '> 35 °C',  icon: 'bi-thermometer-high', color: '#ef4444' },
            { param: 'TDS',         limit: '> 300 ppm', icon: 'bi-water',            color: '#f59e0b' }
        ],
        symptoms: [
            'Profuse watery diarrhoea ("rice-water" stools)',
            'Severe vomiting',
            'Rapid dehydration and muscle cramps',
            'Low blood pressure, sunken eyes',
            'Can be fatal within hours if untreated'
        ],
        precaution: '⚠️ Do NOT drink this water. Seek immediate medical attention. Use oral rehydration salts (ORS). Boil all water before use or switch to sealed bottled water. Report to local health authorities immediately.'
    },
    'Typhoid': {
        icon: 'bi-virus',
        color: '#f97316',
        severity: 'High',
        description: 'Typhoid fever is caused by Salmonella typhi bacteria. It spreads via water contaminated with human feces and causes a prolonged illness with high fever.',
        why: 'Murky water (high turbidity) carries Salmonella typhi bacteria in suspended particles. pH imbalance removes natural antimicrobial protection. High temperature promotes rapid bacterial multiplication.',
        triggers: [
            { param: 'Turbidity',    limit: '> 5 NTU',        icon: 'bi-cloud-haze',       color: '#f97316' },
            { param: 'pH',           limit: '< 6.5 or > 8.5', icon: 'bi-activity',          color: '#ef4444' },
            { param: 'Temperature',  limit: '> 35 °C',         icon: 'bi-thermometer-high', color: '#f59e0b' }
        ],
        symptoms: [
            'Sustained high fever (39–40 °C)',
            'Severe headache and weakness',
            'Abdominal pain and loss of appetite',
            'Rose-coloured spots on chest',
            'Constipation or diarrhoea'
        ],
        precaution: '⚠️ Avoid drinking untreated water. Get vaccinated if travelling to endemic areas. Wash hands thoroughly. Consult a doctor immediately if fever persists beyond 3 days. Use antibiotics only as prescribed.'
    },
    'Gastroenteritis': {
        icon: 'bi-heart-pulse-fill',
        color: '#f97316',
        severity: 'High',
        description: 'Gastroenteritis (stomach flu) is inflammation of the stomach and intestines caused by bacteria, viruses, or parasites present in contaminated water.',
        why: 'High TDS means excess dissolved chemicals and salts irritating the gut lining. High turbidity indicates microbial load (bacteria, viruses, parasites). pH imbalance destroys the stomach\'s natural acid defences.',
        triggers: [
            { param: 'TDS',       limit: '> 300 ppm',    icon: 'bi-water',    color: '#f97316' },
            { param: 'Turbidity', limit: '> 5 NTU',       icon: 'bi-cloud-haze', color: '#ef4444' },
            { param: 'pH',        limit: '< 6.5 or > 8.5', icon: 'bi-activity', color: '#f59e0b' }
        ],
        symptoms: [
            'Nausea and vomiting',
            'Watery diarrhoea (3+ times a day)',
            'Stomach cramps and bloating',
            'Mild fever and chills',
            'Dehydration if untreated'
        ],
        precaution: '⚠️ Do not use this water for cooking or drinking. Stay hydrated with clean water or ORS. Rest and eat bland foods. Seek medical attention if vomiting lasts > 24 hours or blood appears in stool.'
    },
    'Hepatitis A': {
        icon: 'bi-lungs-fill',
        color: '#dc2626',
        severity: 'Critical',
        description: 'Hepatitis A is a viral liver infection caused by the HAV virus. It spreads through water contaminated with fecal matter and can cause lasting liver damage.',
        why: 'HAV binds to suspended particles in turbid water, making it invisible and hard to remove. High TDS indicates fecal contamination (main transmission route). pH imbalance means the water cannot naturally inactivate the virus.',
        triggers: [
            { param: 'Turbidity', limit: '> 5 NTU',        icon: 'bi-cloud-haze', color: '#dc2626' },
            { param: 'TDS',       limit: '> 300 ppm',       icon: 'bi-water',      color: '#ef4444' },
            { param: 'pH',        limit: '< 6.5 or > 8.5',  icon: 'bi-activity',   color: '#f97316' }
        ],
        symptoms: [
            'Jaundice (yellowing of skin and eyes)',
            'Dark urine and pale stools',
            'Extreme fatigue and nausea',
            'Abdominal pain (upper right)',
            'Fever and loss of appetite'
        ],
        precaution: '🚨 Do NOT drink or cook with this water. Get vaccinated against Hepatitis A. Practise strict handwashing. Consult a doctor immediately. This is a notifiable disease — report to health authorities.'
    },
    'Diarrhea': {
        icon: 'bi-droplet-fill',
        color: '#f59e0b',
        severity: 'Moderate',
        description: 'Waterborne diarrhoea is the most common consequence of contaminated water. It is caused by a range of bacteria (E. coli, Salmonella), viruses, and parasites.',
        why: 'High turbidity carries microorganisms into the gut. High TDS introduces dissolved sewage and waste products. High temperature speeds up bacterial growth, increasing microbial load dramatically.',
        triggers: [
            { param: 'Turbidity',   limit: '> 5 NTU',  icon: 'bi-cloud-haze',       color: '#f59e0b' },
            { param: 'TDS',         limit: '> 300 ppm', icon: 'bi-water',            color: '#f97316' },
            { param: 'Temperature', limit: '> 35 °C',   icon: 'bi-thermometer-high', color: '#ef4444' }
        ],
        symptoms: [
            'Loose or watery stools (3+ per day)',
            'Stomach cramps and urgency',
            'Mild nausea and discomfort',
            'Dehydration in children and elderly',
            'Usually resolves in 2–3 days'
        ],
        precaution: '⚠️ Switch to bottled or boiled water immediately. Drink plenty of clean fluids to avoid dehydration. Use ORS sachets. Children and elderly need immediate medical attention if symptoms worsen.'
    },
    'Skin Irritation': {
        icon: 'bi-bandaid-fill',
        color: '#f59e0b',
        severity: 'Moderate',
        description: 'Skin irritation and chemical dermatitis occur when highly acidic or alkaline water, combined with dissolved minerals, disrupts the skin\'s natural pH barrier.',
        why: 'Extreme pH (< 6 or > 9) is chemically corrosive — it directly damages the skin barrier. High TDS means dissolved salts, heavy metals, and minerals that cause dryness, rashes, and inflammation. High temperature opens skin pores, making absorption of irritants worse.',
        triggers: [
            { param: 'pH',          limit: '< 6.0 or > 9.0 (extreme)', icon: 'bi-activity',          color: '#f59e0b' },
            { param: 'TDS',         limit: '> 300 ppm',                  icon: 'bi-water',            color: '#f97316' },
            { param: 'Temperature', limit: '> 35 °C',                    icon: 'bi-thermometer-high', color: '#ef4444' }
        ],
        symptoms: [
            'Redness, itching, and rashes after water contact',
            'Dry or flaky skin',
            'Burning sensation on skin or eyes',
            'Eczema flare-ups or hives',
            'Hair damage or scalp irritation'
        ],
        precaution: '⚠️ Do not bathe or wash with this water. Use bottled or purified water for personal hygiene. Apply soothing moisturiser if skin is affected. Consult a dermatologist if rash worsens. Install a water softener or neutraliser.'
    }
};

// Status Tiers
const STATUS_TIERS = [
    { exceeded: 0, label: 'Safe to Drink', icon: 'bi-check-circle-fill', color: '#10b981', recommendation: 'Water is safe for drinking and cooking.', cssClass: 'wq-safe' },
    { exceeded: 1, label: 'Slightly Contaminated', icon: 'bi-exclamation-circle-fill', color: '#f59e0b', recommendation: 'Boil before drinking.', cssClass: 'wq-slight' },
    { exceeded: 2, label: 'Moderately Unsafe', icon: 'bi-exclamation-triangle-fill', color: '#f97316', recommendation: 'Use purifier before consumption.', cssClass: 'wq-moderate' },
    { exceeded: 3, label: 'Highly Unsafe', icon: 'bi-shield-exclamation', color: '#ef4444', recommendation: 'Avoid drinking, use only for cleaning.', cssClass: 'wq-high' },
    { exceeded: 4, label: 'Severe Contamination', icon: 'bi-radioactive', color: '#dc2626', recommendation: 'Do not use water, immediate action required.', cssClass: 'wq-severe' }
];

// Risk Levels
const RISK_LEVELS = [
    { max: 25, label: 'Low', color: '#10b981' },
    { max: 50, label: 'Moderate', color: '#f59e0b' },
    { max: 75, label: 'High', color: '#f97316' },
    { max: 100, label: 'Critical', color: '#ef4444' }
];

/**
 * Analyze water quality from sensor data
 */
export function analyzeWaterQuality(data) {
    const ph = parseFloat(data.ph);
    const tds = parseFloat(data.tds);
    const turbidity = parseFloat(data.turbidity);
    const temperature = parseFloat(data.temperature);

    // Determine which parameters exceed limits
    const exceeded = {
        ph: ph < SAFE_LIMITS.ph.min || ph > SAFE_LIMITS.ph.max,
        tds: tds > SAFE_LIMITS.tds.max,
        turbidity: turbidity > SAFE_LIMITS.turbidity.max,
        temperature: temperature > SAFE_LIMITS.temperature.max
    };

    const exceededCount = Object.values(exceeded).filter(Boolean).length;

    // Status tier
    const status = STATUS_TIERS[exceededCount];

    // Risk score
    const riskScore = (exceededCount / 4) * 100;
    const riskLevel = RISK_LEVELS.find(r => riskScore <= r.max) || RISK_LEVELS[3];

    // Disease prediction (active when 3+ parameters exceed)
    const diseases = [];
    if (exceededCount >= 3) {
        // High turbidity + high temperature + high TDS → Cholera
        if (exceeded.turbidity && exceeded.temperature && exceeded.tds) {
            diseases.push({ name: 'Cholera', icon: 'bi-bug-fill', severity: 'Critical', color: '#ef4444' });
        }
        // High turbidity + pH imbalance + high temperature → Typhoid
        if (exceeded.turbidity && exceeded.ph && exceeded.temperature) {
            diseases.push({ name: 'Typhoid', icon: 'bi-virus', severity: 'High', color: '#f97316' });
        }
        // High TDS + high turbidity + pH imbalance → Gastroenteritis
        if (exceeded.tds && exceeded.turbidity && exceeded.ph) {
            diseases.push({ name: 'Gastroenteritis', icon: 'bi-heart-pulse-fill', severity: 'High', color: '#f97316' });
        }
        // High turbidity + high TDS + pH imbalance → Hepatitis A
        // HAV hides in suspended particles (high turbidity) + fecal contamination (high TDS + pH imbalance)
        if (exceeded.turbidity && exceeded.tds && exceeded.ph) {
            diseases.push({ name: 'Hepatitis A', icon: 'bi-lungs-fill', severity: 'Critical', color: '#dc2626' });
        }
        // High turbidity + high TDS + high temperature → Diarrhea
        if (exceeded.turbidity && exceeded.tds && exceeded.temperature) {
            diseases.push({ name: 'Diarrhea', icon: 'bi-droplet-fill', severity: 'Moderate', color: '#f59e0b' });
        }
        // Extreme pH (<6 or >9) + high TDS + high temperature → Skin Irritation
        if ((ph < 6 || ph > 9) && exceeded.tds && exceeded.temperature) {
            diseases.push({ name: 'Skin Irritation', icon: 'bi-bandaid-fill', severity: 'Moderate', color: '#f59e0b' });
        }
    }

    // Build detailed exceeded array for email alerts
    const exceededDetails = [];
    if (exceeded.ph) exceededDetails.push({ param: 'ph', value: ph, limit: '6.5–8.5' });
    if (exceeded.tds) exceededDetails.push({ param: 'tds', value: tds, limit: '<300 ppm' });
    if (exceeded.turbidity) exceededDetails.push({ param: 'turbidity', value: turbidity, limit: '<5 NTU' });
    if (exceeded.temperature) exceededDetails.push({ param: 'temperature', value: temperature, limit: '<35°C' });

    return {
        exceededCount,
        exceeded,
        exceededDetails,
        status,
        riskScore,
        riskLevel,
        diseases,
        values: { ph, tds, turbidity, temperature }
    };
}

/**
 * Render the Water Intelligence UI
 */
export function renderIntelligenceUI(analysis) {
    const { exceededCount, exceeded, status, riskScore, riskLevel, diseases, values } = analysis;

    // --- Water Status Card ---
    const statusCard = document.getElementById('wq-status-card');
    if (statusCard) {
        statusCard.innerHTML = `
            <div class="wq-status-header ${status.cssClass}">
                <i class="bi ${status.icon} wq-status-icon"></i>
                <h2 class="wq-status-label">${status.label}</h2>
                <p class="wq-exceeded-count">${exceededCount} of 4 parameters exceeded</p>
            </div>
        `;
    }

    // --- Recommendation Box ---
    const recBox = document.getElementById('wq-recommendation');
    if (recBox) {
        const urgencyIcon = exceededCount >= 3 ? 'bi-exclamation-octagon-fill' : exceededCount >= 1 ? 'bi-info-circle-fill' : 'bi-shield-check';
        recBox.innerHTML = `
            <div class="wq-rec-box ${status.cssClass}">
                <div class="wq-rec-icon-wrap">
                    <i class="bi ${urgencyIcon}"></i>
                </div>
                <div class="wq-rec-content">
                    <h5 class="wq-rec-title">Recommendation</h5>
                    <p class="wq-rec-text">${status.recommendation}</p>
                    <div class="wq-exceeded-params">
                        ${exceeded.ph ? `<span class="wq-param-chip wq-param-bad"><i class="bi bi-x-circle-fill"></i> pH ${values.ph}</span>` : `<span class="wq-param-chip wq-param-ok"><i class="bi bi-check-circle-fill"></i> pH ${values.ph}</span>`}
                        ${exceeded.tds ? `<span class="wq-param-chip wq-param-bad"><i class="bi bi-x-circle-fill"></i> TDS ${values.tds}</span>` : `<span class="wq-param-chip wq-param-ok"><i class="bi bi-check-circle-fill"></i> TDS ${values.tds}</span>`}
                        ${exceeded.turbidity ? `<span class="wq-param-chip wq-param-bad"><i class="bi bi-x-circle-fill"></i> Turb ${values.turbidity}</span>` : `<span class="wq-param-chip wq-param-ok"><i class="bi bi-check-circle-fill"></i> Turb ${values.turbidity}</span>`}
                        ${exceeded.temperature ? `<span class="wq-param-chip wq-param-bad"><i class="bi bi-x-circle-fill"></i> Temp ${values.temperature}°</span>` : `<span class="wq-param-chip wq-param-ok"><i class="bi bi-check-circle-fill"></i> Temp ${values.temperature}°</span>`}
                    </div>
                </div>
            </div>
        `;
    }

    // --- Risk Meter ---
    const riskSection = document.getElementById('wq-risk-meter');
    if (riskSection) {
        riskSection.innerHTML = `
            <div class="wq-risk-container">
                <h5 class="wq-section-title"><i class="bi bi-speedometer2 me-2"></i>Risk Assessment</h5>
                <div class="wq-meter-wrap">
                    <svg viewBox="0 0 200 120" class="wq-gauge">
                        <defs>
                            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#10b981" />
                                <stop offset="33%" stop-color="#f59e0b" />
                                <stop offset="66%" stop-color="#f97316" />
                                <stop offset="100%" stop-color="#ef4444" />
                            </linearGradient>
                        </defs>
                        <!-- Background arc -->
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12" stroke-linecap="round" />
                        <!-- Filled arc -->
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" stroke-width="12" stroke-linecap="round"
                            stroke-dasharray="${(riskScore / 100) * 251.2} 251.2" class="wq-gauge-fill" />
                        <!-- Needle -->
                        <line x1="100" y1="100" x2="${100 + 65 * Math.cos(Math.PI * (1 - riskScore / 100))}" y2="${100 - 65 * Math.sin(Math.PI * (1 - riskScore / 100))}" 
                            stroke="${riskLevel.color}" stroke-width="2.5" stroke-linecap="round" class="wq-needle" />
                        <circle cx="100" cy="100" r="5" fill="${riskLevel.color}" />
                        <!-- Score -->
                        <text x="100" y="88" text-anchor="middle" fill="${riskLevel.color}" font-size="28" font-weight="700" font-family="Outfit">${riskScore}%</text>
                    </svg>
                    <div class="wq-risk-label" style="color: ${riskLevel.color}">
                        <span class="wq-risk-level">${riskLevel.label} Risk</span>
                    </div>
                </div>
                <div class="wq-risk-scale">
                    <span style="color:#10b981">Low</span>
                    <span style="color:#f59e0b">Moderate</span>
                    <span style="color:#f97316">High</span>
                    <span style="color:#ef4444">Critical</span>
                </div>
            </div>
        `;
    }

    // --- Disease Prediction ---
    const diseaseSection = document.getElementById('wq-disease-prediction');
    if (diseaseSection) {
        if (diseases.length === 0) {
            // Build preview chips using DISEASE_INFO for educational purposes
            const previewCards = Object.entries(DISEASE_INFO).map(([name, info]) => `
                <div class="wq-disease-card" style="--disease-color: ${info.color}; padding: 12px 16px; min-width: 130px; text-align: center; justify-content: center; align-items: center;" data-disease="${name}" role="button" tabindex="0" aria-label="View details for ${name}">
                    <div style="pointer-events:none;">
                        <i class="bi ${info.icon}" style="font-size: 1.4rem; color: ${info.color}; display: block; margin-bottom: 6px;"></i>
                        <h6 style="margin: 0; font-size: 0.85rem; font-weight: 600;">${name}</h6>
                    </div>
                </div>
            `).join('');

            diseaseSection.innerHTML = `
                <div class="wq-disease-container">
                    <h5 class="wq-section-title"><i class="bi bi-shield-check me-2" style="color: #10b981;"></i>Disease Risk Analysis</h5>
                    <div class="wq-no-disease" style="text-align: center; padding: 25px 20px; background: rgba(16,185,129,0.05); border-radius: 12px; border: 1px solid rgba(16,185,129,0.1); margin-bottom: 24px;">
                        <i class="bi bi-emoji-smile-fill" style="color: #10b981; font-size: 2.2rem; display: block; margin-bottom: 12px;"></i>
                        <p style="margin: 0; font-size: 1.05rem; font-weight: 500; color: #fff;">No disease risks detected</p>
                        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.6); font-size: 0.9rem;">Water parameters are within acceptable ranges.</p>
                    </div>

                    <div class="wq-disease-preview">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0" style="color: rgba(255,255,255,0.7); font-size: 0.95rem;"><i class="bi bi-book me-2"></i>Educational Preview</h6>
                            <small style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">Tap to learn ›</small>
                        </div>
                        <div class="d-flex flex-wrap gap-2" id="disease-preview-grid">
                            ${previewCards}
                        </div>
                    </div>
                </div>
            `;

            // Delegate click listener for the preview cards
            const previewGrid = diseaseSection.querySelector('#disease-preview-grid');
            if (previewGrid) {
                previewGrid.addEventListener('click', (e) => {
                    const card = e.target.closest('.wq-disease-card');
                    if (card && card.dataset.disease) {
                        openDiseaseModal(card.dataset.disease);
                    }
                });
                previewGrid.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        const card = e.target.closest('.wq-disease-card');
                        if (card && card.dataset.disease) openDiseaseModal(card.dataset.disease);
                    }
                });
            }
        } else {
            // Build cards — children have pointer-events:none so clicks always land on the card
            const diseaseCards = diseases.map(d => `
                <div class="wq-disease-card" style="--disease-color: ${d.color}" data-disease="${d.name}" role="button" tabindex="0" aria-label="View details for ${d.name}">
                    <div class="wq-disease-icon" style="pointer-events:none;"><i class="bi ${d.icon}"></i></div>
                    <div class="wq-disease-info" style="pointer-events:none;">
                        <h6>${d.name}</h6>
                        <span class="wq-disease-severity" style="color: ${d.color}">${d.severity} Risk</span>
                    </div>
                </div>
            `).join('');

            diseaseSection.innerHTML = `
                <div class="wq-disease-container">
                    <h5 class="wq-section-title"><i class="bi bi-virus me-2 text-danger"></i>Disease Risk Prediction</h5>
                    <p class="wq-disease-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${diseases.length} potential disease risk${diseases.length > 1 ? 's' : ''} detected — <small style="opacity:0.7;">tap a card for details ›</small></p>
                    <div class="wq-disease-grid" id="disease-card-grid">
                        ${diseaseCards}
                    </div>
                </div>
            `;

            // Single delegated listener — catches clicks anywhere inside the grid
            const grid = diseaseSection.querySelector('#disease-card-grid');
            if (grid) {
                grid.addEventListener('click', (e) => {
                    const card = e.target.closest('.wq-disease-card');
                    if (card && card.dataset.disease) {
                        openDiseaseModal(card.dataset.disease);
                    }
                });
                grid.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        const card = e.target.closest('.wq-disease-card');
                        if (card && card.dataset.disease) openDiseaseModal(card.dataset.disease);
                    }
                });
            }
        }
    }
}

// ─── Disease Detail Modal Engine ───────────────────────────────────────────────

function ensureModalDOM() {
    if (document.getElementById('disease-modal-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'disease-modal-backdrop';
    backdrop.className = 'disease-modal-backdrop';
    backdrop.addEventListener('click', closeDiseaseModal);

    const sheet = document.createElement('div');
    sheet.id = 'disease-modal-sheet';
    sheet.className = 'disease-modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = `
        <div class="disease-modal-handle"></div>
        <div id="disease-modal-body" class="disease-modal-body"></div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDiseaseModal(); });
}

export function openDiseaseModal(diseaseName) {
    const info = DISEASE_INFO[diseaseName];
    if (!info) return;

    ensureModalDOM();

    const severityColors = {
        'Critical': { bg: 'rgba(220,38,38,0.15)',  border: 'rgba(220,38,38,0.3)',  text: '#ef4444' },
        'High':     { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)', text: '#f97316' },
        'Moderate': { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' }
    };
    const sc = severityColors[info.severity] || severityColors['Moderate'];

    const triggerChips = info.triggers.map(t => `
        <div class="disease-trigger-chip" style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08);">
            <i class="bi ${t.icon}" style="color:${t.color}; font-size:0.9rem;"></i>
            <span class="dchip-label">${t.param}:</span>
            <span class="dchip-limit">${t.limit}</span>
        </div>`).join('');

    const symptomItems = info.symptoms.map(s => `
        <li>
            <i class="bi bi-dot" style="color:${info.color}; font-size:1.2rem;"></i>
            ${s}
        </li>`).join('');

    document.getElementById('disease-modal-body').innerHTML = `
        <div class="disease-modal-header">
            <div class="disease-modal-title-wrap">
                <div class="disease-modal-icon" style="background:${sc.bg}; border:1px solid ${sc.border};">
                    <i class="bi ${info.icon}" style="color:${info.color};"></i>
                </div>
                <div>
                    <h4 class="disease-modal-name">${diseaseName}</h4>
                    <span class="disease-modal-severity-badge" style="background:${sc.bg}; color:${sc.text}; border:1px solid ${sc.border};">
                        ${info.severity} Risk
                    </span>
                </div>
            </div>
            <button class="disease-modal-close" id="dmodal-close-btn" aria-label="Close">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <p class="disease-modal-section-label">What is it?</p>
        <p class="disease-modal-desc">${info.description}</p>
        <hr class="disease-modal-divider">

        <p class="disease-modal-section-label">Why this water is risky</p>
        <p class="disease-modal-desc">${info.why}</p>
        <hr class="disease-modal-divider">

        <p class="disease-modal-section-label">Triggered when</p>
        <div class="disease-trigger-grid">${triggerChips}</div>
        <hr class="disease-modal-divider">

        <p class="disease-modal-section-label">Symptoms to watch</p>
        <ul class="disease-symptom-list">${symptomItems}</ul>
        <hr class="disease-modal-divider">

        <p class="disease-modal-section-label">Precautions &amp; Action</p>
        <div class="disease-precaution-box" style="background:${sc.bg}; border:1px solid ${sc.border};">
            <p>${info.precaution}</p>
        </div>
    `;

    requestAnimationFrame(() => {
        document.getElementById('disease-modal-backdrop').classList.add('visible');
        document.getElementById('disease-modal-sheet').classList.add('visible');
        document.body.style.overflow = 'hidden';
    });

    document.getElementById('dmodal-close-btn').addEventListener('click', closeDiseaseModal);
}

function closeDiseaseModal() {
    const backdrop = document.getElementById('disease-modal-backdrop');
    const sheet    = document.getElementById('disease-modal-sheet');
    if (!backdrop || !sheet) return;
    backdrop.classList.remove('visible');
    sheet.classList.remove('visible');
    document.body.style.overflow = '';
}
