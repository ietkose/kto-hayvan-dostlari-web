// KTO Hayvan Dostları Topluluğu - Firebase Yapılandırma Modülü (ktohayvandostlari.web.app)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBg0k-CP03gw04ddw80NS3DAJSQLBsmreQ",
  authDomain: "ktohayvandostlari.firebaseapp.com",
  projectId: "ktohayvandostlari",
  storageBucket: "ktohayvandostlari.firebasestorage.app",
  messagingSenderId: "293121838519",
  appId: "1:293121838519:web:5aea92dfa81d7dbe85ec32"
};

export const SUPER_ADMIN_EMAIL = "iremdudukose@gmail.com";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
