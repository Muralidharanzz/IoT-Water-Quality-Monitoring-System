// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration from prompt
const firebaseConfig = {
  apiKey: "AIzaSyCTERiYn7j4-7VtVQy_SCDtPaJrUcBFiEA",
  authDomain: "water-quality-monitoring-9a110.firebaseapp.com",
  databaseURL: "https://water-quality-monitoring-9a110-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "water-quality-monitoring-9a110",
  storageBucket: "water-quality-monitoring-9a110.firebasestorage.app",
  messagingSenderId: "560397927880",
  appId: "1:560397927880:web:6873f37c0f87f0ae28acfd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };
