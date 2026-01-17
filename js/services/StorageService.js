// ==========================================
// SERVICE: STORAGE (INDEXEDDB)
// ==========================================
class StorageService {
    constructor() {
        this.dbName = 'UnityDKP_DB';
        this.storeName = 'scans';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2); // Dump version to 2
            request.onerror = (e) => { console.error('DB Error', e); reject(e); };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }
                // New store for full app state
                if (!db.objectStoreNames.contains('app_state')) {
                    db.createObjectStore('app_state', { keyPath: 'id' });
                }
            };
        });
    }

    async saveAppState(state) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['app_state'], 'readwrite');
            const store = transaction.objectStore('app_state');
            // We store the whole state under id: 'current'
            // Clone state to avoid issues? IndexedDB handles structured cloning.
            // But we need to remove Chart instances if any remain (DataService.saveState handles cleanup).
            const record = { id: 'current', state: state, timestamp: Date.now() };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async getAppState() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['app_state'], 'readonly');
            const store = transaction.objectStore('app_state');
            const request = store.get('current');
            request.onsuccess = () => resolve(request.result ? request.result.state : null);
            request.onerror = (e) => reject(e);
        });
    }

    async saveScan(type, name, data, date) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const record = {
                type, // 'start', 'mid', 'end'
                name: name || `Scan ${new Date().toLocaleString()}`,
                data,
                date: date || new Date().toISOString(),
                timestamp: Date.now()
            };
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async getScans(type = null) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            let request;
            if (type) {
                const index = store.index('type');
                request = index.getAll(type);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = (e) => reject(e);
        });
    }

    async getScan(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async deleteScan(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
}
