// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaLdUMDuWSfg7118-ZFpL1fARkM_BQ2zw",
    authDomain: "b-one-database.firebaseapp.com",
    projectId: "b-one-database",
    storageBucket: "b-one-database.firebasestorage.app",
    messagingSenderId: "423962812169",
    appId: "1:423962812169:web:34961a338fe06e693e7dd8",
    databaseURL: "https://b-one-database-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exportation des outils nécessaires
export { db, ref, set, push, onValue, remove, update };

/**
 * Système de Notification Centralisé
 */
export function sendNotification(type, details) {
    const userSession = JSON.parse(localStorage.getItem('BONE_USER_SESSION'));
    const notifRef = ref(db, 'notifications');
    const newNotif = {
        timestamp: Date.now(),
        user: userSession ? userSession.name : 'Inconnu',
        type: type,
        details: details,
        read: false
    };
    push(notifRef, newNotif);
}
