import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = window.__FIREBASE_CONFIG__;

function createDisabledClient() {
  return {
    isConfigured: false,
    app: null,
    auth: null,
    db: null
  };
}

if (!firebaseConfig || firebaseConfig.apiKey === "REPLACE_ME") {
  window.orthoFirebase = createDisabledClient();
} else {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  window.orthoFirebase = {
    isConfigured: true,
    app,
    auth: getAuth(app),
    db: getFirestore(app)
  };
}
