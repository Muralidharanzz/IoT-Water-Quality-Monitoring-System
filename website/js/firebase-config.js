// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration for iot-wq-monitor-2026
const firebaseConfig = {
  apiKey: "AIzaSyDFCNi5FYEjLWs2paWBIKsuxb8XHOUfOLo",
  authDomain: "iot-wq-monitor-2026.firebaseapp.com",
  databaseURL: "https://iot-wq-monitor-2026-default-rtdb.firebaseio.com",
  projectId: "iot-wq-monitor-2026",
  storageBucket: "iot-wq-monitor-2026.firebasestorage.app",
  messagingSenderId: "830608170525",
  appId: "1:830608170525:web:59368e2d09892a81c9b0f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };
