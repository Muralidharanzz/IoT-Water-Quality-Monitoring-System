/**
 * AquaSense Water Intelligence Engine
 * Shared module for water quality analysis, disease prediction, and risk assessment
 */

// Safe Limits
const SAFE_LIMITS = {
    ph: { min: 6.5, max: 8.5 },
    tds: { max: 300 },
    turbidity: { max: 5 },
    temperature: { max: 35 }
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
            diseaseSection.innerHTML = `
                <div class="wq-disease-container">
                    <h5 class="wq-section-title"><i class="bi bi-shield-check me-2"></i>Disease Risk Analysis</h5>
                    <div class="wq-no-disease">
                        <i class="bi bi-emoji-smile-fill"></i>
                        <p>No disease risks detected. Water parameters are within acceptable range.</p>
                    </div>
                </div>
            `;
        } else {
            const diseaseCards = diseases.map(d => `
                <div class="wq-disease-card" style="--disease-color: ${d.color}">
                    <div class="wq-disease-icon"><i class="bi ${d.icon}"></i></div>
                    <div class="wq-disease-info">
                        <h6>${d.name}</h6>
                        <span class="wq-disease-severity" style="color: ${d.color}">${d.severity} Risk</span>
                    </div>
                </div>
            `).join('');

            diseaseSection.innerHTML = `
                <div class="wq-disease-container">
                    <h5 class="wq-section-title"><i class="bi bi-virus me-2 text-danger"></i>Disease Risk Prediction</h5>
                    <p class="wq-disease-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${diseases.length} potential disease risk${diseases.length > 1 ? 's' : ''} detected</p>
                    <div class="wq-disease-grid">
                        ${diseaseCards}
                    </div>
                </div>
            `;
        }
    }
}
