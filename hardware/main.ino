// ============================================================
//  AquaSense IoT — ESP32 Firmware
//  v4.0 — Self-Calibrating pH + Median Filter + EMA Smoothing
//
//  pH CALIBRATION GUIDE:
//  1. Flash this code
//  2. Open Serial Monitor at 115200 baud
//  3. Put pH probe in tap water (or pH 7 buffer if you have it)
//  4. Wait 2 minutes for probe to stabilise
//  5. Type  c  and press Enter
//  6. Calibration auto-saves to ESP32 flash — survives reboot!
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
#define DEFAULT_PH_MIDPOINT  2.5f    // Voltage at pH 7.0
#define DEFAULT_PH_SLOPE     0.1776f // V per pH unit

// ── Noise Filter Settings ─────────────────────────────────────
#define MEDIAN_SAMPLES    15         // Samples for median filter
#define EMA_ALPHA        0.25f       // EMA weight: 0=never update, 1=no smoothing

// ── Firebase & Sensor Objects ─────────────────────────────────
FirebaseData    fbdo;
FirebaseAuth    auth;
FirebaseConfig  config;
Preferences     prefs;

bool            signupOK         = false;
unsigned long   lastUploadMillis = 0;

// EMA state — persists across loop() calls
float emaPH    = -1.0f;   // -1 means "not initialised yet"
float emaTurb  = -1.0f;
float emaTDS   = -1.0f;

// Calibration values loaded from flash
float phMidpointV = DEFAULT_PH_MIDPOINT;
float phSlope     = DEFAULT_PH_SLOPE;

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
  phMidpointV = prefs.getFloat("ph_mid",   DEFAULT_PH_MIDPOINT);
  phSlope     = prefs.getFloat("ph_slope", DEFAULT_PH_SLOPE);
  prefs.end();

  Serial.println("══════════════════════════════════");
  Serial.println("  Loaded pH Calibration from Flash");
  Serial.printf("  Midpoint voltage : %.4f V\n", phMidpointV);
  Serial.printf("  Slope            : %.4f V/pH\n", phSlope);
  Serial.println("══════════════════════════════════");
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

  Serial.println("\n══════════════════════════════════════");
  Serial.println("  AquaSense Ready!");
  Serial.println("  Type  c  + Enter to calibrate pH");
  Serial.println("══════════════════════════════════════\n");
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
    if (cmd == 'r' || cmd == 'R') {
      // Print current calibration values
      Serial.printf("\nCurrent calibration → Midpoint: %.4fV | Slope: %.4f\n\n", phMidpointV, phSlope);
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
  //  Phase 3: TURBIDITY
  //  3.3V fix: scale voltage ×(5/3.3) before applying 5V formula
  // ──────────────────────────────────────────
  Serial.print("[3] Turbidity... ");
  float turbRaw     = medianAnalogRead(TURBIDITY_PIN);
  float turbVoltage = (turbRaw / 4095.0f) * 3.3f;
  float turbV5      = turbVoltage * (5.0f / 3.3f);  // 3.3V→5V scaling fix
  float turbRawCalc;

  if      (turbV5 >= 4.2f) turbRawCalc = 0.0f;
  else if (turbV5 <  1.5f) turbRawCalc = 3000.0f;
  else turbRawCalc = max(0.0f, -1120.4f * turbV5 * turbV5 + 5742.3f * turbV5 - 4352.9f);

  emaTurb  = applyEMA(turbRawCalc, emaTurb);
  float turbidity = emaTurb;

  Serial.printf("%.2f NTU  (V=%.3f → 5Veq=%.3f)\n", turbidity, turbVoltage, turbV5);
  delay(SETTLE_AFTER_TURB);

  // ──────────────────────────────────────────
  //  Phase 4: TDS (last — it injects current into water!)
  //  DFRobot cubic formula + temperature compensation
  // ──────────────────────────────────────────
  Serial.print("[4] TDS... ");
  float tdsRaw     = medianAnalogRead(TDS_PIN);
  float tdsVoltage = (tdsRaw / 4095.0f) * 3.3f;
  float compCoeff  = 1.0f + 0.02f * (temperature - 25.0f);
  float compV      = tdsVoltage / compCoeff;
  float tdsRawCalc = (133.42f * compV * compV * compV
                    - 255.86f * compV * compV
                    +  857.39f * compV) * 0.5f;
  tdsRawCalc = constrain(tdsRawCalc, 0.0f, 1000.0f);

  emaTDS = applyEMA(tdsRawCalc, emaTDS);
  float tdsValue = emaTDS;

  Serial.printf("%.2f ppm  (V=%.3f, compV=%.3f)\n", tdsValue, tdsVoltage, compV);

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
