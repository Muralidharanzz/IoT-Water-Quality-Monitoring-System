#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// ================= WIFI =================
#define WIFI_SSID "Test"
#define WIFI_PASSWORD "12345678"

// ================= FIREBASE =================
#define API_KEY "AIzaSyCTERiYn7j4-7VtVQy_SCDtPaJrUcBFiEA"
#define DATABASE_URL "https://water-quality-monitoring-9a110-default-rtdb.asia-southeast1.firebasedatabase.app/"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ================= SENSOR PINS =================
#define PH_PIN 34
#define TURBIDITY_PIN 35
#define TDS_PIN 32
#define ONE_WIRE_BUS 4

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// ================= CONNECT WIFI =================
void connectWiFi() {
  WiFi.disconnect(true, true);
  delay(2000);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

// ================= GET TIMESTAMP =================
String getTimeStamp() {
  configTime(0, 0, "pool.ntp.org");
  time_t now = time(nullptr);

  while (now < 100000) {
    delay(500);
    now = time(nullptr);
  }

  return String(now);
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  sensors.begin();
  connectWiFi();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth Success");
  } else {
    Serial.printf("Auth Failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase Ready");
}

void loop() {

  // ===== READ SENSORS =====
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);

  float phValue = (analogRead(PH_PIN) * 14.0) / 4095.0;
  float turbidity = (analogRead(TURBIDITY_PIN) * 20.0) / 4095.0;
  float tdsValue = (analogRead(TDS_PIN) * 1000.0) / 4095.0;

  // ===== CREATE JSON OBJECT =====
  FirebaseJson json;

  json.set("temperature", temperature);
  json.set("ph", phValue);
  json.set("turbidity", turbidity);
  json.set("tds", tdsValue);
  json.set("timestamp", getTimeStamp());

  // ===== UPLOAD LATEST DATA =====
  Firebase.RTDB.setJSON(&fbdo, "/current", &json);

  // ===== LOG HISTORY =====
  Firebase.RTDB.pushJSON(&fbdo, "/history", &json);

  Serial.println("Raw Sensor Data Uploaded");
  delay(5000);
}
