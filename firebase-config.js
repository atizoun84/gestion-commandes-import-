// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, remove, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

export { db, ref, set, onValue, push, update, remove, query, orderByChild };
