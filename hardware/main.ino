#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

#define WIFI_SSID "Test"
#define WIFI_PASSWORD "12345678"

#define API_KEY "AIzaSyDFCNi5FYEjLWs2paWBIKsuxb8XHOUfOLo"
#define DATABASE_URL "iot-wq-monitor-2026-default-rtdb.firebaseio.com"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;
unsigned long sendDataPrevMillis = 0;

#define PH_PIN 34
#define TURBIDITY_PIN 35
#define TDS_PIN 32
#define ONE_WIRE_BUS 4

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

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

void setupNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync: ");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("");
  Serial.println("Time synchronized");
}

String getTimeStamp() {
  time_t now = time(nullptr);
  return String(now);
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  sensors.begin();
  connectWiFi();
  
  // Set time BEFORE initializing Firebase so SSL certificates can be validated properly
  setupNTP();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign up
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth Sign Up Success");
    signupOK = true;
  } else {
    Serial.printf("Auth Failed: %s\n", config.signer.signupError.message.c_str());
  }

  /* Assign the token status callback */
  config.token_status_callback = tokenStatusCallback; 

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase Setup Called");
}

void loop() {
  // Wait for Firebase to be ready and sign up to succeed before uploading data
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);

    float phValue = (analogRead(PH_PIN) * 14.0) / 4095.0;
    float turbidity = (analogRead(TURBIDITY_PIN) * 20.0) / 4095.0;
    float tdsValue = (analogRead(TDS_PIN) * 1000.0) / 4095.0;

    FirebaseJson json;

    json.set("temperature", temperature);
    json.set("ph", phValue);
    json.set("turbidity", turbidity);
    json.set("tds", tdsValue);
    json.set("timestamp", getTimeStamp());

    Serial.println("Uploading current data...");
    if (Firebase.RTDB.setJSON(&fbdo, "/current", &json)) {
      Serial.println("Passed /current");
    } else {
      Serial.println("FAILED /current: " + fbdo.errorReason());
    }

    Serial.println("Pushing history data...");
    if (Firebase.RTDB.pushJSON(&fbdo, "/history", &json)) {
      Serial.println("Passed /history");
    } else {
      Serial.println("FAILED /history: " + fbdo.errorReason());
    }
    
    Serial.println("----------------------------------");
  }
}
