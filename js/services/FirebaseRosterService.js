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
            const snapshot = await this.db.ref('rosters').once('value');
            const data = snapshot.val();
            return data ? Object.keys(data) : [];
        } catch (error) {
            console.error('Firebase Fetch Kingdoms Error:', error);
            return [];
        }
    }
    // ------------------------------------------------------------------------
    // COMMUNITY HUB METHODS
    // ------------------------------------------------------------------------

    // Push a new feedback post to the community board
    async submitFeedback(postData) {
        if (!this.db || !this.connected) {
            throw new Error('Not connected to Firebase. Please configure your Database URL in Settings.');
        }

        try {
            // Push generates a unique sequential key
            const newPostRef = this.db.ref('community_feedback').push();
            await newPostRef.set({
                ...postData,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        } catch (error) {
            console.error('Submit Feedback Error:', error);
            throw error;
        }
    }

    // Listen for new feedback posts in real-time
    listenToFeedback(callback) {
        if (!this.db) {
            // If not initialized yet, wait and retry silently, or the UI handles it
            return null;
        }

        const feedbackRef = this.db.ref('community_feedback').orderByChild('timestamp').limitToLast(100);

        const listener = feedbackRef.on('child_added', (snapshot) => {
            const val = snapshot.val();
            const key = snapshot.key;
            callback({ id: key, ...val });
        });

        // Provide the caller a way to unsubscribe if they leave the tab
        return () => {
            feedbackRef.off('child_added', listener);
        };
    }
}

window.FirebaseRosterService = FirebaseRosterService;
