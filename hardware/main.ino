// ============================================================
//  AquaSense IoT — ESP32 Firmware
//  v4.2 — Zero-Cal Turbidity (APT) + Self-Cal pH + EMA Filter
//
//  TURBIDITY — ZERO CALIBRATION NEEDED:
//   Uses Adaptive Peak Tracking (APT). The firmware learns the
//   clear-water voltage automatically by tracking the highest
//   voltage the sensor has ever seen. No commands to run.
//   Optionally type  t  to force-reset peak (e.g. after sensor swap).
//
//  pH CALIBRATION (optional but recommended):
//  1. Put pH probe in pH 7 tap water / buffer
//  2. Open Serial Monitor at 115200 baud, wait 2 min
//  3. Type  c  + Enter → auto-saves to flash
//
//  COMMANDS:
//   c  → calibrate pH
//   t  → force-reset turbidity peak (put sensor in clear water first)
//   r  → print all current calibration values
//
//  READING ORDER (prevents cross-sensor interference):
//  Temperature → pH → Turbidity → TDS
// ============================================================

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Preferences.h>   // ESP32 flash key-value store
#include <time.h>

// ── WiFi Credentials ─────────────────────────────────────────
#define WIFI_SSID     "Test"
#define WIFI_PASSWORD "12345678"

// ── Firebase Config ───────────────────────────────────────────
#define API_KEY       "AIzaSyDFCNi5FYEjLWs2paWBIKsuxb8XHOUfOLo"
#define DATABASE_URL  "iot-wq-monitor-2026-default-rtdb.firebaseio.com"

// ── Pin Definitions ───────────────────────────────────────────
#define PH_PIN        34
#define TURBIDITY_PIN 35
#define TDS_PIN       32
#define ONE_WIRE_BUS  4

// ── Timing ───────────────────────────────────────────────────
#define UPLOAD_INTERVAL    15000  // 15 seconds between Firebase uploads
#define SETTLE_AFTER_TEMP    500
#define SETTLE_AFTER_PH     1000
#define SETTLE_AFTER_TURB    300

// ── pH Calibration Defaults (overridden by saved flash values) ─
#define DEFAULT_PH_MIDPOINT   2.5f    // Voltage at pH 7.0
#define DEFAULT_PH_SLOPE      0.1776f // V per pH unit

// ── Turbidity — Adaptive Peak Tracking (APT) ─────────────────
// No manual calibration needed.
// The firmware tracks the highest turbidity voltage seen (= clear
// water) and uses it as a self-updating baseline.
//
// TURB_PEAK_DECAY : peak shrinks 0.02% per cycle → adapts to aging
// TURB_CLEAR_BAND : within 5% of peak counts as 0 NTU
// TURB_MURKY_RATIO: below 25% of peak → clamp to 3000 NTU
// PEAK_SAVE_MS    : how often to persist peak to flash (10 min)
// At 3.3V supply, the turbidity sensor outputs ~1.6V–2.1V in clear water
// (NOT 2.5V — that was the 5V assumption). Setting a realistic default
// allows APT to self-correct within the first few readings.
#define DEFAULT_TURB_PEAK    1.8f    // Realistic first-boot estimate (V @ 3.3V supply)
#define TURB_PEAK_DECAY      0.9998f // 0.02% per cycle — very slow aging compensation
#define TURB_CLEAR_BAND      0.92f   // ≥92% of peak → 0 NTU (wider band for stability)
#define TURB_MURKY_RATIO     0.20f   // ≤20% of peak → 3000 NTU
#define PEAK_SAVE_MS         600000UL // Save to flash every 10 minutes

// ── Noise Filter Settings ─────────────────────────────────────
#define MEDIAN_SAMPLES    15         // Samples for median filter
#define EMA_ALPHA        0.25f       // EMA weight: 0=never update, 1=no smoothing

// ── Firebase & Sensor Objects ─────────────────────────────────
FirebaseData    fbdo;
FirebaseAuth    auth;
FirebaseConfig  config;
Preferences     prefs;

bool            signupOK         = false;
unsigned long   lastUploadMillis  = 0;
unsigned long   lastPeakSaveMillis = 0;

// EMA state — persists across loop() calls
float emaPH    = -1.0f;   // -1 means "not initialised yet"
float emaTurb  = -1.0f;
float emaTDS   = -1.0f;

// Calibration values loaded from flash
float phMidpointV = DEFAULT_PH_MIDPOINT;
float phSlope     = DEFAULT_PH_SLOPE;

// Turbidity adaptive peak (APT) — automatically self-updates
float turbPeak    = DEFAULT_TURB_PEAK;  // Highest voltage seen = clear-water estimate

OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

// ============================================================
//  MEDIAN FILTER
//  Takes MEDIAN_SAMPLES ADC readings, sorts them, returns
//  the middle value. Spike outliers have ZERO effect on median.
// ============================================================
float medianAnalogRead(int pin) {
  int buf[MEDIAN_SAMPLES];

  // Collect samples
  for (int i = 0; i < MEDIAN_SAMPLES; i++) {
    buf[i] = analogRead(pin);
    delay(8);  // 8ms gap — longer than averaging for more stability
  }

  // Insertion sort (small array, fast enough)
  for (int i = 1; i < MEDIAN_SAMPLES; i++) {
    int key = buf[i];
    int j   = i - 1;
    while (j >= 0 && buf[j] > key) {
      buf[j + 1] = buf[j];
      j--;
    }
    buf[j + 1] = key;
  }

  // Return middle element
  return (float)buf[MEDIAN_SAMPLES / 2];
}

// ============================================================
//  EXPONENTIAL MOVING AVERAGE
//  Blends new reading with history so sudden jumps are damped.
//  alpha=0.25: new reading contributes 25%, history 75%
// ============================================================
float applyEMA(float newVal, float prevEMA) {
  if (prevEMA < 0.0f) return newVal;    // First reading — use as-is
  return EMA_ALPHA * newVal + (1.0f - EMA_ALPHA) * prevEMA;
}

// ============================================================
//  LOAD CALIBRATION FROM FLASH
// ============================================================
void loadCalibration() {
  prefs.begin("aquasense", true);  // read-only mode
  phMidpointV = prefs.getFloat("ph_mid",     DEFAULT_PH_MIDPOINT);
  phSlope     = prefs.getFloat("ph_slope",   DEFAULT_PH_SLOPE);
  turbPeak    = prefs.getFloat("turb_peak",  DEFAULT_TURB_PEAK);  // APT peak
  prefs.end();

  Serial.println("══════════════════════════════════════════");
  Serial.println("  Loaded Calibration from Flash");
  Serial.printf("  pH midpoint      : %.4f V\n", phMidpointV);
  Serial.printf("  pH slope         : %.4f V/pH\n", phSlope);
  Serial.printf("  Turb peak (APT)  : %.4f V\n", turbPeak);
  Serial.println("  Turbidity is ZERO-CALIBRATION (APT mode)");
  Serial.println("══════════════════════════════════════════");
}

// ============================================================
//  pH CALIBRATION ROUTINE
//  Triggered by typing 'c' in Serial Monitor.
//  Assumes probe is currently in pH 7 water (or buffer).
//  Samples voltage 60 times over 30 seconds → takes median.
//  Saves new midpoint to ESP32 flash.
// ============================================================
void runPHCalibration() {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║      pH CALIBRATION MODE           ║");
  Serial.println("╠════════════════════════════════════╣");
  Serial.println("║  Keep probe in pH 7 tap water or   ║");
  Serial.println("║  pH 7 buffer solution.             ║");
  Serial.println("║  Sampling for 30 seconds...        ║");
  Serial.println("╚════════════════════════════════════╝");

  long   sum   = 0;
  int    count = 60;  // 60 samples over ~30 seconds

  for (int i = 0; i < count; i++) {
    float raw  = medianAnalogRead(PH_PIN);
    float volt = (raw / 4095.0f) * 3.3f;
    sum += (long)(volt * 10000);  // scale to avoid float precision loss

    // Progress bar
    if ((i + 1) % 10 == 0) {
      String bar = "  [";
      for (int b = 0; b < (i + 1) / 3; b++) bar += "█";
      bar += "] " + String(i + 1) + "/60";
      Serial.println(bar + "  Voltage: " + String(volt, 3) + "V");
    }
    delay(500);
  }

  float avgVoltage = (sum / 10000.0f) / count;

  // Save to flash
  prefs.begin("aquasense", false);  // read-write mode
  prefs.putFloat("ph_mid",   avgVoltage);
  prefs.putFloat("ph_slope", DEFAULT_PH_SLOPE);  // slope unchanged
  prefs.end();

  // Update live values
  phMidpointV = avgVoltage;

  Serial.println("\n  ✅ CALIBRATION COMPLETE!");
  Serial.printf("  New midpoint voltage: %.4f V (was %.4f V)\n", avgVoltage, DEFAULT_PH_MIDPOINT);
  Serial.println("  Value saved to flash — survives reboot.");
  Serial.println("  Resuming normal readings...\n");
}

// ============================================================
//  TURBIDITY PEAK RESET (optional override for APT)
//  Triggered by typing 't' in Serial Monitor.
//  Put sensor in CLEAR water first. Samples 30s → sets that
//  reading as the new turbidity peak. APT continues from there.
//  THIS IS OPTIONAL — APT works automatically without this.
// ============================================================
void runTurbidityCalibration() {
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.println("║   TURBIDITY PEAK RESET (APT Override)   ║");
  Serial.println("╠════════════════════════════════════════╣");
  Serial.println("║  Sensor must be in CLEAR tap water.     ║");
  Serial.println("║  Sampling 30s to set new APT peak...   ║");
  Serial.println("╚════════════════════════════════════════╝");

  long sum   = 0;
  int  count = 60;  // 60 samples over ~30 seconds

  for (int i = 0; i < count; i++) {
    float raw  = medianAnalogRead(TURBIDITY_PIN);
    float volt = (raw / 4095.0f) * 3.3f;
    sum += (long)(volt * 10000);
    if ((i + 1) % 10 == 0) {
      String bar = "  [";
      for (int b = 0; b < (i + 1) / 3; b++) bar += "█";
      bar += "] " + String(i + 1) + "/60";
      Serial.println(bar + "  V=" + String(volt, 3) + "V");
    }
    delay(500);
  }

  float newPeak = (sum / 10000.0f) / count;

  // Force APT peak to this measured clear-water voltage
  turbPeak = newPeak;

  prefs.begin("aquasense", false);
  prefs.putFloat("turb_peak", turbPeak);
  prefs.end();

  Serial.println("\n  ✅ TURBIDITY PEAK RESET!");
  Serial.printf("  New turbPeak     : %.4f V\n", turbPeak);
  Serial.printf("  Clear threshold  : %.4f V (%.0f%% of peak)\n",
                turbPeak * TURB_CLEAR_BAND, TURB_CLEAR_BAND * 100);
  Serial.printf("  Murky floor      : %.4f V (%.0f%% of peak)\n",
                turbPeak * TURB_MURKY_RATIO, TURB_MURKY_RATIO * 100);
  Serial.println("  Saved to flash. APT auto-tracking continues from here.");
  Serial.println("  Resuming normal readings...\n");
}

// ============================================================
//  WIFI SETUP
// ============================================================
void connectWiFi() {
  WiFi.disconnect(true, true);
  delay(2000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

// ============================================================
//  NTP TIME SYNC
// ============================================================
void setupNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("NTP sync");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) { delay(500); Serial.print("."); now = time(nullptr); }
  Serial.println(" OK");
}

String getTimeStamp() { return String(time(nullptr)); }

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(2000);

  // Full 0–3.3V ADC range (without this, max readable = ~1.1V)
  analogSetAttenuation(ADC_11db);

  tempSensor.begin();

  // Load saved pH calibration from flash
  loadCalibration();

  connectWiFi();
  setupNTP();

  config.api_key      = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth OK");
    signupOK = true;
  } else {
    Serial.printf("Auth Failed: %s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("\n══════════════════════════════════════════");
  Serial.println("  AquaSense v4.1 Ready!");
  Serial.println("  c + Enter  →  calibrate pH (in pH7 water)");
  Serial.println("  t + Enter  →  calibrate turbidity (in clear water)");
  Serial.println("  r + Enter  →  print current calibration values");
  Serial.println("══════════════════════════════════════════\n");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {

  // ── Check for calibration command from Serial Monitor ──
  if (Serial.available()) {
    char cmd = Serial.read();
    while (Serial.available()) Serial.read();  // flush buffer
    if (cmd == 'c' || cmd == 'C') {
      runPHCalibration();
      return;
    }
    if (cmd == 't' || cmd == 'T') {
      runTurbidityCalibration();
      return;
    }
    if (cmd == 'r' || cmd == 'R') {
      Serial.printf("\nCurrent pH cal   → Midpoint: %.4fV | Slope: %.4f\n", phMidpointV, phSlope);
      Serial.printf("Current APT peak → turbPeak: %.4fV\n", turbPeak);
      Serial.printf("  Clear thresh   → %.4fV (%.0f%% of peak)\n",
                    turbPeak * TURB_CLEAR_BAND,  TURB_CLEAR_BAND  * 100);
      Serial.printf("  Murky floor    → %.4fV (%.0f%% of peak)\n\n",
                    turbPeak * TURB_MURKY_RATIO, TURB_MURKY_RATIO * 100);
    }
  }

  // ── Wait for Firebase + upload interval ──
  if (!Firebase.ready() || !signupOK) return;
  unsigned long now = millis();
  if (now - lastUploadMillis < UPLOAD_INTERVAL && lastUploadMillis != 0) return;
  lastUploadMillis = now;

  Serial.println("┌─────────────────────────────────┐");
  Serial.println("│      Sensor Reading Cycle        │");
  Serial.println("└─────────────────────────────────┘");

  // ──────────────────────────────────────────
  //  Phase 1: TEMPERATURE (digital, no noise)
  // ──────────────────────────────────────────
  Serial.print("[1] Temperature... ");
  tempSensor.requestTemperatures();
  delay(800);
  float temperature = tempSensor.getTempCByIndex(0);
  if (temperature == DEVICE_DISCONNECTED_C || temperature < -10.0f) temperature = 25.0f;
  Serial.printf("%.2f °C\n", temperature);
  delay(SETTLE_AFTER_TEMP);

  // ──────────────────────────────────────────
  //  Phase 2: pH (before TDS — avoids electric field corruption)
  //  Median filter → formula → EMA smoothing
  // ──────────────────────────────────────────
  Serial.print("[2] pH... ");
  float phRaw       = medianAnalogRead(PH_PIN);
  float phVoltage   = (phRaw / 4095.0f) * 3.3f;
  float phRawCalc   = 7.0f + ((phMidpointV - phVoltage) / phSlope);
  float phValue     = constrain(phRawCalc, 0.0f, 14.0f);

  // EMA smoothing across cycles
  emaPH   = applyEMA(phValue, emaPH);
  phValue = emaPH;

  Serial.printf("%.2f  (V=%.3f, mid=%.3f)\n", phValue, phVoltage, phMidpointV);
  delay(SETTLE_AFTER_PH);

  // ──────────────────────────────────────────
  //  Phase 3: TURBIDITY — Adaptive Peak Tracking (APT)
  //
  //  How APT works (zero calibration):
  //   1. turbPeak = highest voltage ever seen = clear water estimate
  //   2. If new reading EXCEEDS peak → peak updates UP immediately
  //      (clearer water found → recalibrate upward)
  //   3. If new reading is BELOW peak → peak decays 0.02% per cycle
  //      (slow drift down = compensates for sensor aging over months)
  //   4. Peak saved to flash every 10 min (survives power cuts)
  //   5. Turbidity = how far voltage is below the peak, scaled 0–3000
  // ──────────────────────────────────────────
  Serial.print("[3] Turbidity (APT)... ");
  float turbRaw     = medianAnalogRead(TURBIDITY_PIN);
  float turbVoltage = (turbRaw / 4095.0f) * 3.3f;

  // ── Step 1: Update adaptive peak ───────────────────────────────
  if (turbVoltage >= turbPeak) {
    turbPeak = turbVoltage;             // New high → update immediately
  } else {
    turbPeak *= TURB_PEAK_DECAY;        // Slow decay (sensor aging)
    turbPeak  = max(turbPeak, DEFAULT_TURB_PEAK * 0.5f);  // Hard floor
  }

  // ── Step 2: Periodic flash save (every 10 minutes) ───────────────
  unsigned long nowMs = millis();
  if (nowMs - lastPeakSaveMillis >= PEAK_SAVE_MS) {
    prefs.begin("aquasense", false);
    prefs.putFloat("turb_peak", turbPeak);
    prefs.end();
    lastPeakSaveMillis = nowMs;
    Serial.print("[peak saved] ");
  }

  // ── Step 3: Convert voltage to NTU using adaptive peak ──────────
  float clearThresh = turbPeak * TURB_CLEAR_BAND;   // 95% of peak = still clear
  float murkyFloor  = turbPeak * TURB_MURKY_RATIO;  // 25% of peak = max murky
  float turbRawCalc;

  if (turbVoltage >= clearThresh) {
    turbRawCalc = 0.0f;                              // At/near peak = clear
  } else if (turbVoltage <= murkyFloor) {
    turbRawCalc = 3000.0f;                           // Below floor = max murky
  } else {
    float span  = clearThresh - murkyFloor;
    float delta = turbVoltage - murkyFloor;
    turbRawCalc = (1.0f - (delta / span)) * 3000.0f;
    turbRawCalc = constrain(turbRawCalc, 0.0f, 3000.0f);
  }

  emaTurb  = applyEMA(turbRawCalc, emaTurb);
  float turbidity = emaTurb;

  Serial.printf("%.2f NTU  (V=%.3fV | peak=%.3fV | clear≥%.3fV)\n",
                turbidity, turbVoltage, turbPeak, clearThresh);
  delay(SETTLE_AFTER_TURB);

  // ──────────────────────────────────────────
  //  Phase 4: TDS (last — it injects current into water!)
  //
  //  ROOT CAUSE FIX: DFRobot's cubic formula was empirically derived
  //  for a 5V-powered TDS sensor. At 3.3V, the probe drive voltage is
  //  lower → less current → lower output voltage for the same PPM.
  //
  //  Fix: scale compV into the equivalent 5V domain before applying
  //  the polynomial, then constrain to a realistic tap-water range.
  //
  //  Also: the original formula gives PPM = conductivity × 0.5
  //  (the 0.5 factor converts μS/cm to PPM using TDS factor 0.5).
  //  This is correct for most mineral water sensors.
  // ──────────────────────────────────────────
  Serial.print("[4] TDS... ");
  float tdsRaw      = medianAnalogRead(TDS_PIN);
  float tdsVoltage  = (tdsRaw / 4095.0f) * 3.3f;

  // Temperature compensation (standard 2%/°C)
  float compCoeff   = 1.0f + 0.02f * (temperature - 25.0f);
  float compV       = tdsVoltage / compCoeff;

  // Scale 3.3V-domain voltage into the 5V-domain that the
  // DFRobot polynomial expects: V_5V_equiv = compV × (5.0/3.3)
  float compV5      = compV * (5.0f / 3.3f);

  // DFRobot cubic polynomial (valid for 0–2.3V in 5V domain)
  float tdsRawCalc  = (133.42f * compV5 * compV5 * compV5
                     - 255.86f * compV5 * compV5
                     +  857.39f * compV5) * 0.5f;

  // Constrain: tap water is 50–500 PPM, anything above 600 is suspect
  tdsRawCalc = constrain(tdsRawCalc, 0.0f, 600.0f);

  emaTDS = applyEMA(tdsRawCalc, emaTDS);
  float tdsValue = emaTDS;

  Serial.printf("%.2f ppm  (V=%.3fV, compV=%.3fV, compV5=%.3fV)\n",
                tdsValue, tdsVoltage, compV, compV5);

  // ──────────────────────────────────────────
  //  Summary
  // ──────────────────────────────────────────
  Serial.println("─────────────────────────────────");
  Serial.printf("  pH:        %.2f\n", phValue);
  Serial.printf("  Turbidity: %.2f NTU\n", turbidity);
  Serial.printf("  TDS:       %.2f ppm\n", tdsValue);
  Serial.printf("  Temp:      %.2f °C\n", temperature);
  Serial.println("─────────────────────────────────");
  Serial.println("  (Type  c  to recalibrate pH)");

  // ──────────────────────────────────────────
  //  Firebase Upload
  // ──────────────────────────────────────────
  FirebaseJson json;
  json.set("ph",          phValue);
  json.set("turbidity",   turbidity);
  json.set("tds",         tdsValue);
  json.set("temperature", temperature);
  json.set("timestamp",   getTimeStamp());

  if (Firebase.RTDB.setJSON(&fbdo, "/current", &json))
    Serial.println("  ✓ /current updated");
  else
    Serial.println("  ✗ /current FAILED: " + fbdo.errorReason());

  if (Firebase.RTDB.pushJSON(&fbdo, "/history", &json))
    Serial.println("  ✓ /history pushed");
  else
    Serial.println("  ✗ /history FAILED: " + fbdo.errorReason());

  Serial.println("  Next cycle in 15 seconds...\n");
}
