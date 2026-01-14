// =========================================================
// B-ONE SYSTEM - MOTEUR DE SYNCHRONISATION UNIVERSEL V3
// =========================================================

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4gTiI7J0HKmGr2jv2FoeTTmZFrysxmUSjCEVcQFtL-4jBTaEgHu7ooZbHKIr6Li-Cww/exec';

const SYNC_CONFIG = {
    interval: 30000, // Sync toutes les 30 secondes
    keys: {
        products: 'BONE_PRODUCTS_LIST',
        orders: 'BONE_ORDERS_HISTORY',
        finance: 'BONE_FINANCE_FLUX',
        config: 'BONE_OFFICIAL_CONFIG_V2',
        users: 'BONE_USERS_ACCOUNTS'
    }
};

class BOneSyncManager {
    constructor() {
        this.isSyncing = false;
        this.createStatusUI(); // Initialisation de l'interface de statut
        this.init();
    }

    /**
     * CRÉATION DE L'INTERFACE DE STATUT (NOUVEAU)
     */
    createStatusUI() {
        const style = document.createElement('style');
        style.textContent = `
            #bone-sync-status {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 15px;
                background: #1a1a1a;
                color: white;
                border-radius: 30px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                z-index: 10000;
                transition: all 0.3s ease;
                border: 1px solid #333;
            }
            .sync-dot {
                width: 8px;
                height: 8px;
                background: #555;
                border-radius: 50%;
            }
            .sync-active .sync-dot {
                background: #00ff88;
                box-shadow: 0 0 10px #00ff88;
                animation: pulse 1s infinite alternate;
            }
            .sync-progress-bar {
                width: 0%;
                height: 2px;
                background: #00ff88;
                position: absolute;
                bottom: 0;
                left: 0;
                border-radius: 0 0 30px 30px;
                transition: width 0.3s ease;
            }
            @keyframes pulse {
                from { opacity: 0.4; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'bone-sync-status';
        statusDiv.innerHTML = `
            <div class="sync-dot"></div>
            <span id="sync-text">Cloud Prêt</span>
            <div id="sync-progress" class="sync-progress-bar"></div>
        `;
        document.body.appendChild(statusDiv);
        this.statusEl = statusDiv;
        this.textEl = document.getElementById('sync-text');
        this.progressEl = document.getElementById('sync-progress');
    }

    updateStatus(state, progress = 0) {
        if (state === 'syncing') {
            this.statusEl.classList.add('sync-active');
            this.textEl.innerText = `Mise à jour Cloud... ${progress}%`;
            this.progressEl.style.width = `${progress}%`;
        } else {
            this.statusEl.classList.remove('sync-active');
            this.textEl.innerText = 'Cloud Synchronisé';
            this.progressEl.style.width = '0%';
            setTimeout(() => { if(!this.isSyncing) this.textEl.innerText = 'Cloud Prêt'; }, 3000);
        }
    }

    init() {
        console.log("🚀 Sync Manager Initialisé");
        setTimeout(() => this.syncAll(), 5000);
        setInterval(() => this.syncAll(), SYNC_CONFIG.interval);
    }

    async syncAll() {
        if (this.isSyncing || !navigator.onLine) return;
        this.isSyncing = true;
        console.log("🔄 Début de la synchronisation globale...");
        
        const categories = Object.entries(SYNC_CONFIG.keys);
        const total = categories.length;

        try {
            for (let i = 0; i < total; i++) {
                const [category, storageKey] = categories[i];
                const progress = Math.round(((i + 1) / total) * 100);
                this.updateStatus('syncing', progress);
                
                await this.pushCategory(category, storageKey);
            }
            console.log("✅ Synchronisation terminée avec succès.");
        } catch (error) {
            console.error("❌ Échec de la synchronisation:", error);
        } finally {
            this.isSyncing = false;
            this.updateStatus('idle');
        }
    }

    async pushCategory(category, storageKey) {
        const localData = JSON.parse(localStorage.getItem(storageKey));
        
        if (!localData) return;

        const itemsArray = Array.isArray(localData) ? localData : [localData];
        
        if (itemsArray.length === 0) return;

        const payload = {
            operation: 'upsert',
            sheet: storageKey,
            items: itemsArray
        };

        try {
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.text();
            console.log(`📡 [${category}] : ${result}`);
        } catch (e) {
            console.warn(`⚠️ Erreur lors de l'envoi de ${category}:`, e);
        }
    }

    async deleteItem(storageKey, id) {
        if (!navigator.onLine) return;
        
        this.updateStatus('syncing', 50);
        const payload = {
            operation: 'delete',
            sheet: storageKey,
            items: [{ id: id }]
        };

        try {
            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(payload)
            });
            console.log(`🗑️ ID ${id} supprimé du Cloud (${storageKey})`);
        } catch (e) {
            console.error("Erreur suppression Cloud:", e);
        } finally {
            this.updateStatus('idle');
        }
    }
}

// Instance globale
window.SyncManager = new BOneSyncManager();

/**
 * HOOKS POUR VOS SCRIPTS EXISTANTS
 */
window.triggerSync = () => window.SyncManager.syncAll();
window.syncProductToGoogleSheets = () => window.SyncManager.pushCategory('products', SYNC_CONFIG.keys.products);
window.syncOrderToGoogleSheets = () => window.SyncManager.pushCategory('orders', SYNC_CONFIG.keys.orders);
window.syncFinanceToGoogleSheets = () => window.SyncManager.pushCategory('finance', SYNC_CONFIG.keys.finance);
