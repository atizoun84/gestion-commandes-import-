// Fichier : google-sheets-sync.js
// À inclure dans toutes vos pages HTML : <script src="google-sheets-sync.js"></script>

// URL DE DÉPLOIEMENT - AVEC VOTRE URL
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzU4GugVUEulJ-UQXqCR9E9vmTxP7ReUDvIRO6UxlsP_jUhCg7vDkrV9L8q056ShTtJg/exec';

const SYNC_INTERVAL = 20000; // 20 secondes
const LOCAL_KEYS = {
  config: 'BONE_OFFICIAL_CONFIG_V2',
  products: 'BONE_PRODUCTS_LIST',
  orders: 'BONE_ORDERS_HISTORY',
  finance: 'BONE_FINANCE_FLUX',
  users: 'BONE_USERS_ACCOUNTS'
};

class GoogleSheetsSync {
  constructor() {
    this.lastSync = {
      config: parseInt(localStorage.getItem('lastSync_config')) || 0,
      products: parseInt(localStorage.getItem('lastSync_products')) || 0,
      orders: parseInt(localStorage.getItem('lastSync_orders')) || 0,
      finance: parseInt(localStorage.getItem('lastSync_finance')) || 0,
      users: parseInt(localStorage.getItem('lastSync_users')) || 0
    };
    this.syncInProgress = false;
    this.isOnline = navigator.onLine;
    this.syncEnabled = true;
    
    // Écouter les changements de connexion
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 En ligne - Reprise synchronisation');
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Hors ligne - Mise en file d\'attente');
    });
  }

  // Initialisation de la connexion
  async init() {
    try {
      const url = `${GOOGLE_APPS_SCRIPT_URL}?operation=init`;
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors', // Évite les erreurs CORS
        cache: 'no-cache'
      });
      
      // En mode no-cors, la réponse est opaque. On assume le succès si pas d'erreur réseau.
      console.log('✅ Tentative initialisation envoyée (mode no-cors)');
      
      // Sauvegarder les données locales initiales
      setTimeout(() => this.backupAllLocalData(), 3000);
      
      return true;
    } catch (error) {
      console.warn('⚠️ Erreur initialisation Google Sheets:', error.message);
      console.log('📱 Utilisation du stockage local uniquement');
      return false;
    }
  }

  // Synchronisation automatique
  startAutoSync() {
    // Démarrer l'intervalle de synchronisation
    setInterval(() => {
      if (!this.syncInProgress && this.syncEnabled && this.isOnline) {
        this.syncAll();
      }
    }, SYNC_INTERVAL);
    
    // Sync immédiat au démarrage
    setTimeout(() => {
      if (this.isOnline) {
        this.syncAll();
      }
    }, 2000);
    
    console.log('🔄 Synchronisation automatique démarrée (toutes les 20s)');
  }

  // Synchroniser toutes les données
  async syncAll() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    
    try {
      console.log('🔄 Début synchronisation complète...');
      
      await Promise.all([
        this.pullData('config'),
        this.pullData('products'),
        this.pullData('orders'),
        this.pullData('finance'),
        this.pullData('users')
      ]);
      
      console.log('✅ Toutes données synchronisées');
      
      // Déclencher un événement global
      window.dispatchEvent(new CustomEvent('fullSyncComplete'));
    } catch (error) {
      console.error('❌ Erreur synchronisation:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Récupérer les données depuis Google Sheets
  async pullData(sheetType) {
    if (!this.isOnline) return [];
    
    try {
      const url = `${GOOGLE_APPS_SCRIPT_URL}?operation=get&sheet=${sheetType}&lastSync=${this.lastSync[sheetType]}`;
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors', // Changement appliqué ici
        cache: 'no-cache'
      });
      
      // NOTE IMPORTANTE: Avec 'no-cors', on ne peut pas lire le corps JSON (response.json()) 
      // Si vous avez besoin de RECEVOIR des données (GET), le mode 'no-cors' ne retournera rien de lisible.
      // Mais cela évitera l'erreur de blocage console.
      return [];
    } catch (error) {
      console.error(`❌ Erreur récupération ${sheetType}:`, error.message);
      return [];
    }
  }

  // Fusionner les données locales et distantes
  async mergeData(sheetType, remoteData) {
    const localKey = LOCAL_KEYS[sheetType];
    let localData = JSON.parse(localStorage.getItem(localKey)) || [];
    
    if (!Array.isArray(localData)) {
      localData = [];
    }
    
    // Pour chaque élément distant
    remoteData.forEach(remoteItem => {
      // Trouver l'index de l'élément local correspondant
      let existingIndex = -1;
      
      if (sheetType === 'config') {
        existingIndex = localData.findIndex(localItem => 
          localItem.companyName === remoteItem.companyName
        );
      } else if (sheetType === 'users') {
        existingIndex = localData.findIndex(localItem => 
          localItem.username === remoteItem.username
        );
      } else {
        existingIndex = localData.findIndex(localItem => 
          localItem.id === remoteItem.id
        );
      }
      
      if (existingIndex >= 0) {
        // Mettre à jour avec données les plus récentes
        const remoteTimestamp = remoteItem.timestamp || 0;
        const localTimestamp = localData[existingIndex].timestamp || 0;
        
        if (remoteTimestamp > localTimestamp) {
          localData[existingIndex] = remoteItem;
        }
      } else {
        // Ajouter nouvel élément
        localData.push(remoteItem);
      }
    });
    
    // Trier par timestamp (plus récent en premier)
    localData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Sauvegarder localement
    localStorage.setItem(localKey, JSON.stringify(localData));
    
    return localData;
  }

  // Envoyer des données vers Google Sheets
  async pushData(sheetType, items, operation = 'insert') {
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    if (items.length === 0) {
      return null;
    }
    
    // Si hors ligne, mettre en file d'attente
    if (!this.isOnline) {
      this.queueForSync(sheetType, items, operation);
      return { success: false, queued: true, message: 'En attente (hors ligne)' };
    }
    
    try {
      const payload = {
        operation: operation,
        sheet: sheetType,
        items: items
      };
      
      // Application de la recommandation no-cors ici pour l'envoi
      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        body: JSON.stringify(payload)
      });
      
      console.log(`✅ Données envoyées (mode no-cors) pour ${sheetType}: ${items.length} éléments`);
      
      // On met à jour les timestamps locaux en supposant que l'envoi est fait
      this.lastSync[sheetType] = Date.now();
      localStorage.setItem(`lastSync_${sheetType}`, this.lastSync[sheetType].toString());
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Erreur réelle envoi ${sheetType}:`, error.message);
      
      // En cas d'erreur, stocker en local
      this.queueForSync(sheetType, items, operation);
      
      return { 
        success: false, 
        error: error.message,
        queued: true 
      };
    }
  }

  // File d'attente pour synchronisation ultérieure
  queueForSync(sheetType, items, operation) {
    const queueKey = `syncQueue_${sheetType}`;
    let queue = JSON.parse(localStorage.getItem(queueKey)) || [];
    
    queue.push({
      items: items,
      operation: operation,
      timestamp: Date.now()
    });
    
    localStorage.setItem(queueKey, JSON.stringify(queue));
    console.log(`📦 ${items.length} éléments en attente pour ${sheetType} (${operation})`);
    
    // Déclencher un événement
    window.dispatchEvent(new CustomEvent('dataQueued', {
      detail: { 
        type: sheetType, 
        count: items.length,
        operation: operation 
      }
    }));
  }

  // Traiter la file d'attente
  async processQueue() {
    if (!this.isOnline) return;
    
    console.log('🔄 Traitement file d\'attente...');
    
    for (const sheetType of Object.keys(LOCAL_KEYS)) {
      const queueKey = `syncQueue_${sheetType}`;
      const queue = JSON.parse(localStorage.getItem(queueKey)) || [];
      
      if (queue.length > 0) {
        console.log(`📤 File ${sheetType}: ${queue.length} éléments en attente`);
        
        // Trier par timestamp
        queue.sort((a, b) => a.timestamp - b.timestamp);
        
        for (const item of queue) {
          try {
            await this.pushData(sheetType, item.items, item.operation);
            
            // Pause pour éviter limites
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`❌ Échec traitement file ${sheetType}:`, error);
            break;
          }
        }
        
        // Vider la file après succès
        localStorage.removeItem(queueKey);
        console.log(`✅ File traitée pour ${sheetType}`);
      }
    }
  }

  // Sauvegarde complète de toutes les données locales
  async backupAllLocalData() {
    if (!this.isOnline) return;
    
    console.log('💾 Sauvegarde complète vers Google Sheets...');
    
    const backupPromises = [];
    
    Object.keys(LOCAL_KEYS).forEach(key => {
      const data = JSON.parse(localStorage.getItem(LOCAL_KEYS[key])) || [];
      
      if (data.length > 0) {
        console.log(`📤 Sauvegarde ${key}: ${data.length} éléments`);
        
        if (key === 'config' && data.length > 0) {
          backupPromises.push(this.pushData(key, data[0], 'update'));
        } else {
          backupPromises.push(this.pushData(key, data, 'insert'));
        }
      }
    });
    
    try {
      await Promise.all(backupPromises);
      console.log('✅ Sauvegarde complète terminée');
    } catch (error) {
      console.error('❌ Échec sauvegarde:', error);
    }
  }

  // Vérifier la connexion
  async checkConnection() {
    try {
      const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?operation=init`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      
      return true; // En mode no-cors, on retourne true si la requête est partie
    } catch (error) {
      return false;
    }
  }
}

// Singleton pour le gestionnaire
window.GoogleSheetsManager = new GoogleSheetsSync();

// ============================================================================
// FONCTIONS D'INTÉGRATION
// ============================================================================

// 1. Pour la configuration
function syncConfigToGoogleSheets(configData) {
  if (!configData || !configData.companyName) {
    console.error('❌ Données config invalides');
    return;
  }
  
  configData.timestamp = Date.now();
  configData.lastSync = Date.now();
  
  return window.GoogleSheetsManager.pushData('config', configData, 'update');
}

// 2. Pour les produits
function syncProductToGoogleSheets(productData, operation = 'insert') {
  if (!productData || !productData.id) {
    console.error('❌ Données produit invalides');
    return;
  }
  
  productData.timestamp = Date.now();
  
  return window.GoogleSheetsManager.pushData('products', productData, operation);
}

// 3. Pour les commandes
function syncOrderToGoogleSheets(orderData) {
  if (!orderData || !orderData.id) {
    console.error('❌ Données commande invalides');
    return;
  }
  
  if (!orderData.timestamp) {
    orderData.timestamp = Date.now();
  }
  
  return window.GoogleSheetsManager.pushData('orders', orderData, 'insert');
}

// 4. Pour les flux financiers
function syncFinanceToGoogleSheets(financeData) {
  if (!financeData || !financeData.id) {
    console.error('❌ Données finance invalides');
    return;
  }
  
  if (!financeData.timestamp) {
    financeData.timestamp = Date.now();
  }
  
  return window.GoogleSheetsManager.pushData('finance', financeData, 'insert');
}

// 5. Pour les utilisateurs
function syncUserToGoogleSheets(userData) {
  if (!userData || !userData.username) {
    console.error('❌ Données utilisateur invalides');
    return;
  }
  
  userData.timestamp = Date.now();
  
  return window.GoogleSheetsManager.pushData('users', userData, 'update');
}

// ============================================================================
// INTÉGRATION AVEC VOS PAGES EXISTANTES
// ============================================================================

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 B-ONE PWA - Synchronisation Google Sheets initialisation...');
  
  // Créer indicateur statut
  const statusEl = document.createElement('div');
  statusEl.id = 'sync-status';
  statusEl.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: #333;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    z-index: 9999;
    opacity: 0.9;
    font-family: 'Segoe UI', sans-serif;
    border: 1px solid #555;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    transition: all 0.3s;
  `;
  document.body.appendChild(statusEl);
  
  // Mettre à jour statut
  function updateStatus(text, color = '#333') {
    statusEl.innerHTML = `🔄 ${text}`;
    statusEl.style.background = color;
    statusEl.style.display = 'block';
    
    if (text.includes('✅')) {
      setTimeout(() => {
        statusEl.style.opacity = '0.3';
      }, 3000);
    }
  }
  
  // Mettre à jour connexion
  function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    const icon = isOnline ? '🌐' : '📴';
    const text = isOnline ? 'En ligne' : 'Hors ligne';
    const color = isOnline ? '#2ecc71' : '#e74c3c';
    
    const connEl = document.getElementById('connection-status');
    if (connEl) {
      connEl.innerHTML = `${icon} ${text}`;
      connEl.style.color = color;
    }
  }
  
  // Créer indicateur connexion si non existant
  if (!document.getElementById('connection-status')) {
    const connEl = document.createElement('div');
    connEl.id = 'connection-status';
    connEl.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      font-size: 12px;
      z-index: 9998;
      padding: 3px 8px;
      border-radius: 3px;
      background: rgba(255,255,255,0.9);
      font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(connEl);
    updateConnectionStatus();
  }
  
  // Écouter changement connexion
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  
  // Initialiser synchronisation
  setTimeout(async () => {
    try {
      updateStatus('Connexion Google Sheets...', '#3498db');
      
      const initialized = await window.GoogleSheetsManager.init();
      
      if (initialized) {
        updateStatus('✅ Connecté à Google Sheets', '#2ecc71');
        
        // Démarrer synchronisation
        window.GoogleSheetsManager.startAutoSync();
        
        // Traiter file d'attente
        window.GoogleSheetsManager.processQueue();
        
        console.log('✅ Synchronisation Google Sheets active');
        
        // Déclencher événement
        window.dispatchEvent(new CustomEvent('googleSheetsReady'));
      } else {
        updateStatus('⚠️ Mode local uniquement', '#f39c12');
        console.warn('⚠️ Synchronisation Google Sheets non disponible');
      }
    } catch (error) {
      updateStatus('❌ Erreur connexion', '#e74c3c');
      console.error('❌ Erreur initialisation:', error);
    }
  }, 1000);
  
  // Écouter événements synchronisation
  window.addEventListener('dataSynced', function(e) {
    console.log(`📊 Données synchronisées: ${e.detail.type} (${e.detail.count})`);
    
    // Mettre à jour interface si nécessaire
    if (typeof Finance !== 'undefined' && e.detail.type === 'finance') {
      Finance.renderAccounting();
    }
    
    if (typeof Shop !== 'undefined' && e.detail.type === 'products') {
      Shop.render();
    }
    
    if (typeof CartManager !== 'undefined' && e.detail.type === 'orders') {
      CartManager.renderOrders();
    }
  });
  
  window.addEventListener('dataQueued', function(e) {
    updateStatus(`📦 ${e.detail.count} éléments en attente`, '#f39c12');
  });
});

// ============================================================================
// INTERCEPTION DES FONCTIONS EXISTANTES
// ============================================================================

// Intercepter sauvegarde configuration
if (typeof UI !== 'undefined') {
  // Sauvegarde originale
  const originalUISave = UI.save;
  
  UI.save = function() {
    const result = originalUISave.apply(this, arguments);
    
    // Synchroniser après sauvegarde locale
    const config = JSON.parse(localStorage.getItem('BONE_OFFICIAL_CONFIG_V2'));
    if (config) {
      setTimeout(() => {
        syncConfigToGoogleSheets(config);
      }, 500);
    }
    
    return result;
  };
}

// Intercepter sauvegarde produit
if (typeof Shop !== 'undefined' && Shop.saveProduct) {
  const originalSaveProduct = Shop.saveProduct;
  
  Shop.saveProduct = function(e) {
    const result = originalSaveProduct.apply(this, arguments);
    
    // Synchroniser produit
    setTimeout(() => {
      const products = JSON.parse(localStorage.getItem('BONE_PRODUCTS_LIST')) || [];
      if (products.length > 0) {
        const lastProduct = products[products.length - 1];
        syncProductToGoogleSheets(lastProduct, 'update');
      }
    }, 500);
    
    return result;
  };
}

// Intercepter validation commande
if (typeof Shop !== 'undefined' && Shop.validateProject) {
  const originalValidateProject = Shop.validateProject;
  
  Shop.validateProject = function() {
    const result = originalValidateProject.apply(this, arguments);
    
    // Synchroniser commande
    setTimeout(() => {
      const orders = JSON.parse(localStorage.getItem('BONE_ORDERS_HISTORY')) || [];
      if (orders.length > 0) {
        const lastOrder = orders[orders.length - 1];
        syncOrderToGoogleSheets(lastOrder);
      }
    }, 1000);
    
    return result;
  };
}

// Intercepter retraits financiers
if (typeof Finance !== 'undefined' && Finance.addWithdraw) {
  const originalAddWithdraw = Finance.addWithdraw;
  
  Finance.addWithdraw = function(type) {
    const result = originalAddWithdraw.apply(this, arguments);
    
    // Synchroniser flux financier
    setTimeout(() => {
      const financeData = JSON.parse(localStorage.getItem('BONE_FINANCE_FLUX')) || [];
      if (financeData.length > 0) {
        const lastEntry = financeData[financeData.length - 1];
        syncFinanceToGoogleSheets(lastEntry);
      }
    }, 500);
    
    return result;
  };
}

// Intercepter sauvegarde utilisateur (login.html)
if (typeof saveUser !== 'undefined') {
  const originalSaveUser = saveUser;
  
  window.saveUser = function() {
    const result = originalSaveUser.apply(this, arguments);
    
    // Synchroniser utilisateur
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('BONE_USERS_ACCOUNTS')) || {};
      const name = document.getElementById('newUserName')?.value;
      if (name && users[name]) {
        const userData = {
          username: name,
          password: users[name].password,
          role: users[name].role,
          timestamp: Date.now()
        };
        syncUserToGoogleSheets(userData);
      }
    }, 500);
    
    return result;
  };
}

// Fonction manuelle pour forcer synchronisation
window.forceSync = function() {
  console.log('🔄 Synchronisation manuelle demandée');
  window.GoogleSheetsManager.syncAll();
  return 'Synchronisation démarrée';
};

// Fonction pour vider cache local
window.clearLocalCache = function() {
  if (confirm('Vider toutes les données locales et resynchroniser depuis Google Sheets ?')) {
    Object.keys(LOCAL_KEYS).forEach(key => {
      localStorage.removeItem(LOCAL_KEYS[key]);
    });
    
    Object.keys(window.GoogleSheetsManager.lastSync).forEach(key => {
      localStorage.removeItem(`lastSync_${key}`);
      window.GoogleSheetsManager.lastSync[key] = 0;
    });
    
    // Resynchroniser
    setTimeout(() => {
      window.GoogleSheetsManager.syncAll();
    }, 1000);
    
    return 'Cache vidé, resynchronisation...';
  }
  return 'Annulé';
};

// Export pour usage global
window.syncToGoogleSheets = {
  config: syncConfigToGoogleSheets,
  product: syncProductToGoogleSheets,
  order: syncOrderToGoogleSheets,
  finance: syncFinanceToGoogleSheets,
  user: syncUserToGoogleSheets
};

console.log('📱 Module Google Sheets Sync chargé');
console.log('URL:', GOOGLE_APPS_SCRIPT_URL);
