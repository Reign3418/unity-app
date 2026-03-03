class FirebaseRosterService {
    constructor() {
        this.app = null;
        this.db = null;
        this.connected = false;
        this.currentKingdom = null;
        this.unsubscribe = null;
        this.onDataCallback = null;
        this.onStatusCallback = null;
    }

    init(firebaseUrl) {
        if (!firebaseUrl) {
            this.updateStatus(false, 'Firebase URL not configured');
            return false;
        }

        try {
            // Check if already initialized to prevent Firebase re-init errors
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp({
                    databaseURL: firebaseUrl
                });
            } else {
                this.app = firebase.app();
            }

            this.db = firebase.database();

            // Listen for connection state changes
            const connectedRef = this.db.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    this.connected = true;
                    this.updateStatus(true, 'Connected to Cloud');
                } else {
                    this.connected = false;
                    this.updateStatus(false, 'Disconnected');
                }
            });

            return true;
        } catch (error) {
            console.error('Firebase Init Error:', error);
            this.updateStatus(false, 'Initialization Failed');
            return false;
        }
    }

    updateStatus(isConnected, message) {
        if (this.onStatusCallback) {
            this.onStatusCallback(isConnected, message);
        }
    }

    // Subscribe to a specific Kingdom's roster
    subscribeToKingdom(kingdomId, callback) {
        if (!this.db) return;

        this.onDataCallback = callback;

        // Clean up previous subscription
        if (this.currentKingdom && this.unsubscribe && this.currentKingdom !== kingdomId) {
            this.db.ref(`rosters/${this.currentKingdom}`).off('value', this.unsubscribe);
        }

        this.currentKingdom = kingdomId;

        // Set up real-time listener
        const rosterRef = this.db.ref(`rosters/${kingdomId}`);
        this.unsubscribe = rosterRef.on('value', (snapshot) => {
            const data = snapshot.val();
            // Convert Firebase object to Array
            const players = data ? Object.values(data) : [];
            if (this.onDataCallback) {
                this.onDataCallback(players);
            }
        }, (errorObject) => {
            console.error('The read failed: ' + errorObject.name);
            this.updateStatus(false, 'Permission Denied');
        });
    }

    // Push a single scanned player profile to the active Kingdom roster
    async pushPlayerScan(kingdomId, playerData) {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to Firebase. Please configure in settings.');
        }

        if (!playerData.id && !playerData.name) {
            throw new Error('Player must have an ID or Name to sync');
        }

        try {
            // Firebase keys cannot contain certain characters like . # $ [ ]
            // We use Governor ID as primary key. If null, use sanitized Name.
            let key = (playerData.id) ? String(playerData.id) : playerData.name.replace(/[.#$\[\]]/g, "_");

            // Add sync timestamp
            const payload = {
                ...playerData,
                lastSync: Date.now()
            };

            const playerRef = this.db.ref(`rosters/${kingdomId}/${key}`);
            await playerRef.update(payload); // Merges fields natively in Firebase

            return true;
        } catch (error) {
            console.error('Firebase Push Error:', error);
            throw error;
        }
    }
    // Pull a one-time array of all players in a kingdom (for Core Analytics injection)
    async getKingdomDataOnce(kingdomId) {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to Firebase.');
        }

        try {
            const rosterRef = this.db.ref(`rosters/${kingdomId}`);
            const snapshot = await rosterRef.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Firebase Fetch Error:', error);
            throw error;
        }
    }

    // Fetch a list of all Kingdoms currently holding data in the Cloud
    async getActiveKingdoms() {
        if (!this.db || !this.connected) return [];
        try {
            const rosterSnap = await this.db.ref('rosters').once('value');
            const kingdomsSnap = await this.db.ref('kingdoms').once('value');

            const kds = new Set();
            if (rosterSnap.exists()) Object.keys(rosterSnap.val()).forEach(k => kds.add(k));
            if (kingdomsSnap.exists()) Object.keys(kingdomsSnap.val()).forEach(k => kds.add(k));

            return Array.from(kds);
        } catch (error) {
            console.error('Firebase Fetch Kingdoms Error:', error);
            return [];
        }
    }

    // ------------------------------------------------------------------------
    // GLOBAL CLOUD TRACKING & TIMELINE
    // ------------------------------------------------------------------------

    // Push an entire scan array to the cloud in one atomic operation
    async pushFullScan(kingdomId, scanDate, scanData) {
        if (!this.db || !this.connected) throw new Error('Not connected to Firebase.');

        let updates = {};
        const safeDate = String(scanDate).replace(/[.#$\/\[\]\s]/g, "_");

        // Helper function to sanitize object keys for Firebase
        const sanitizeObjectKeys = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(sanitizeObjectKeys);

            const newObj = {};
            for (const [key, value] of Object.entries(obj)) {
                // Firebase illegal characters: . # $ / [ ]
                const safeKey = String(key).replace(/[.#$\/\[\]]/g, "_");
                newObj[safeKey] = sanitizeObjectKeys(value);
            }
            return newObj;
        };

        const safeScanData = sanitizeObjectKeys(scanData);

        let kingdomScanObj = {};

        // 2. Add each governor to their own timeline history node
        safeScanData.forEach(player => {
            const rawId = player['Governor ID'] || player['ID'] || player['id'];
            const rawName = player['Governor Name'] || player['Name'] || player['name'] || "Unknown";

            // Build the primary key
            let key = (rawId) ? String(rawId) : rawName.replace(/[.#$\/\[\]\s]/g, "_");

            // Avoid pushing empty or broken keys
            if (key !== "undefined" && key !== "Unknown") {
                // Flatten the scan into governor objects!
                kingdomScanObj[key] = player;

                // Keep the root profile updated with the latest seen data
                updates[`governors/${key}/profile/name`] = rawName;
                updates[`governors/${key}/profile/lastSeenKingdom`] = kingdomId;
                updates[`governors/${key}/profile/lastSeenDate`] = safeDate;

                // Add the snapshot to their personal history tree
                updates[`governors/${key}/history/${kingdomId}_${safeDate}`] = player;
            }
        });

        const originalHeaders = scanData.length > 0 ? Object.keys(scanData[0]) : [];

        // 1. Store the full scan array in the kingdom node for instant retrieval later
        // We nest it inside 'data' so we can store the ordered headers alongside it
        updates[`kingdoms/${kingdomId}/scans/${safeDate}/data`] = kingdomScanObj;
        if (originalHeaders.length > 0) {
            updates[`kingdoms/${kingdomId}/scans/${safeDate}/headers`] = originalHeaders;
        }

        try {
            // Push the massive payload atomically
            await this.db.ref().update(updates);
            return true;
        } catch (error) {
            console.error('Firebase Push Full Scan Error:', error);
            throw error;
        }
    }

    // Retrieve a list of all historical scan dates available for a specific kingdom
    async getAvailableScanDates(kingdomId) {
        if (!this.db || !this.connected) throw new Error('Not connected to Firebase.');
        try {
            const snap = await this.db.ref(`kingdoms/${kingdomId}/scans`).once('value');
            if (snap.exists()) {
                // Return an array of sorted dates
                return Object.keys(snap.val()).sort((a, b) => new Date(b) - new Date(a));
            }
            return [];
        } catch (e) {
            console.error("Error fetching available scan dates:", e);
            return [];
        }
    }

    // Download the massive JSON block for a specific kingdom at a specific time
    async loadScanDetails(kingdomId, scanDate) {
        if (!this.db || !this.connected) throw new Error('Not connected to Firebase.');
        try {
            const snap = await this.db.ref(`kingdoms/${kingdomId}/scans/${scanDate}`).once('value');
            if (snap.exists()) {
                const payload = snap.val();

                let rawData = payload;
                let originalHeaders = null;

                // Support new nested structure with headers
                if (payload && payload.data) {
                    rawData = payload.data;
                    originalHeaders = payload.headers;
                }

                let arr = [];
                if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
                    arr = Object.values(rawData);
                } else {
                    arr = rawData || [];
                }

                // Reconstruct exact column order and restore original keys containing illegal Firebase chars
                if (originalHeaders) {
                    const headersArray = Array.isArray(originalHeaders) ? originalHeaders : Object.values(originalHeaders);
                    if (headersArray.length > 0) {
                        return arr.map(row => {
                            const newRow = {};
                            headersArray.forEach(origKey => {
                                // The data was saved with illegal characters replaced by '_'
                                const safeKey = String(origKey).replace(/[.#$\/\[\]]/g, "_");
                                if (row[safeKey] !== undefined) {
                                    newRow[origKey] = row[safeKey];
                                } else if (row[origKey] !== undefined) {
                                    newRow[origKey] = row[origKey]; // Fallback
                                }
                            });
                            return newRow;
                        });
                    }
                }

                return arr;
            }
            return null;
        } catch (e) {
            console.error("Error loading specific scan:", e);
            throw e;
        }
    }

    // Look up a specific Governor ID to pull their entire lifetime history
    async getGovernorHistory(govId) {
        if (!this.db || !this.connected) throw new Error('Not connected to Firebase.');
        try {
            // Make safe key
            const safeKey = String(govId).replace(/[.#$\/\[\]\s]/g, "_");
            const snap = await this.db.ref(`governors/${safeKey}`).once('value');
            return snap.val();
        } catch (e) {
            console.error("Error fetching governor history:", e);
            throw e;
        }
    }

    // ------------------------------------------------------------------------
    // DATABASE MANAGEMENT
    // ------------------------------------------------------------------------

    // Forcibly wipe the entire Firebase Realtime Database
    async wipeDatabase() {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to Firebase. Please configure your Database URL in Settings.');
        }

        try {
            // Setting the root reference to null deletes all data
            await this.db.ref('/').set(null);
            console.warn("FIREBASE DATABASE HAS BEEN WIPED.");
            return true;
        } catch (error) {
            console.error('Database Wipe Error:', error);
            throw error;
        }
    }

}

window.FirebaseRosterService = FirebaseRosterService;
