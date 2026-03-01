class UIMyAlliance {
    constructor(dataService, firebaseService) {
        this.dataService = dataService;
        this.rosterService = firebaseService;

        // DOM Elements
        this.kingdomSelect = document.getElementById('rosterKingdomSelect');
        this.statusText = document.getElementById('rosterConnectionStatus');
        this.tableBody = document.getElementById('myAllianceTableBody');
        this.emptyState = document.getElementById('myAllianceEmptyState');

        this.currentPlayerList = [];
    }

    async init() {
        this.setupListeners();
        await this.refreshKingdomDropdown();

        // 1. Check for saved Firebase URL and update status early
        const savedUrl = localStorage.getItem('__unity_firebase_url');
        if (savedUrl) {
            this.bindFirebaseStatus();
            // Assuming main.js has already called rosterService.init(savedUrl)
        } else {
            this.statusText.innerHTML = '⚠️ Disconnected - Configure Firebase Database URL in Settings';
            this.statusText.style.color = 'var(--warning-color)';
        }

        // Auto-select Kingdom if available
        if (this.dataService.state.loadedKingdoms.size > 0) {
            const firstKingdom = Array.from(this.dataService.state.loadedKingdoms)[0];
            this.kingdomSelect.value = firstKingdom;
            this.switchKingdom(firstKingdom);
        }
    }

    bindFirebaseStatus() {
        this.rosterService.onStatusCallback = async (isConnected, message) => {
            if (isConnected) {
                this.statusText.innerHTML = `🟢 ${message}`;
                this.statusText.style.color = 'var(--success-color)';

                // Re-fetch dropdown options since we are now connected to the cloud
                await this.refreshKingdomDropdown();

                // If we dropped connection and reconnected, re-subscribe
                if (this.kingdomSelect.value) {
                    this.switchKingdom(this.kingdomSelect.value);
                }
            } else {
                this.statusText.innerHTML = `🔴 ${message}`;
                this.statusText.style.color = 'var(--danger-color)';
            }
        };

        // Trigger initial status check if it's already connected
        if (this.rosterService.connected) {
            this.rosterService.onStatusCallback(true, 'Connected to Cloud');
        }
    }

    setupListeners() {
        if (this.kingdomSelect) {
            this.kingdomSelect.addEventListener('change', (e) => {
                if (e.target.value === '__add_new') {
                    this.handleAddNewKingdom(this.kingdomSelect);
                } else {
                    this.switchKingdom(e.target.value);
                }
            });
        }

        // We can safely add this once in init, since ocrKingdomSelect is static in the DOM usually.
        // Wait, ocrKingdomSelect might be added by OCRScanner. Let's just bind it here.
        const ocrSelect = document.getElementById('ocrKingdomSelect');
        if (ocrSelect) {
            ocrSelect.addEventListener('change', (e) => {
                if (e.target.value === '__add_new') {
                    this.handleAddNewKingdom(ocrSelect);
                }
            });
        }
    }

    handleAddNewKingdom(selectElement) {
        const newK = prompt("Enter Kingdom Number (e.g., 9331):");
        if (newK && newK.trim() && !isNaN(newK.trim())) {
            const kStr = newK.trim();
            // Add to loadedKingdoms
            this.dataService.state.loadedKingdoms.add(kStr);
            this.dataService.initKingdom(kStr);

            // Re-render UI components globally to reflect new kingdom
            if (window.uiService) {
                window.uiService.renderKingdomTabs();
            }

            this.refreshKingdomDropdown();

            // Set the selected value to the newly added kingdom
            if (this.kingdomSelect) this.kingdomSelect.value = kStr;
            const ocrSelect = document.getElementById('ocrKingdomSelect');
            if (ocrSelect) ocrSelect.value = kStr;

            if (selectElement === this.kingdomSelect) {
                this.switchKingdom(kStr);
            }
        } else {
            // Revert to default selection
            if (selectElement) selectElement.value = "";
        }
    }

    async refreshKingdomDropdown() {
        if (!this.kingdomSelect) return;

        const ocrSelect = document.getElementById('ocrKingdomSelect');
        const localKingdoms = Array.from(this.dataService.state.loadedKingdoms);

        let cloudKingdoms = [];
        if (this.rosterService && this.rosterService.connected) {
            cloudKingdoms = await this.rosterService.getActiveKingdoms();
        }

        const allKingdomsSet = new Set([...localKingdoms, ...cloudKingdoms]);
        const allKingdoms = Array.from(allKingdomsSet).sort((a, b) => parseInt(a) - parseInt(b));

        let html = '<option value="" disabled selected>Select Kingdom</option>';
        allKingdoms.forEach(k => {
            const isCloudOnly = !localKingdoms.includes(k) && cloudKingdoms.includes(k);
            const label = isCloudOnly ? `${k} ☁️` : k;
            html += `<option value="${k}">${label}</option>`;
        });
        html += '<option value="__add_new" style="font-weight:bold; color:var(--accent-primary);">➕ Add Kingdom...</option>';

        const currentVal = this.kingdomSelect.value;
        const currentOcrVal = ocrSelect ? ocrSelect.value : null;

        this.kingdomSelect.innerHTML = html;
        if (ocrSelect) ocrSelect.innerHTML = html;

        if (currentVal && allKingdoms.includes(currentVal)) {
            this.kingdomSelect.value = currentVal;
        }
        if (ocrSelect && currentOcrVal && allKingdoms.includes(currentOcrVal)) {
            ocrSelect.value = currentOcrVal;
        } else if (ocrSelect && allKingdoms.length > 0 && (!currentOcrVal || currentOcrVal === '__add_new')) {
            ocrSelect.value = allKingdoms[0];
        }
    }

    switchKingdom(kingdomId) {
        if (!kingdomId || !this.rosterService.connected) return;

        this.rosterService.subscribeToKingdom(kingdomId, (players) => {
            this.currentPlayerList = players;
            this.renderTable();
        });
    }

    renderTable() {
        if (!this.tableBody) return;

        if (this.currentPlayerList.length === 0) {
            this.tableBody.innerHTML = '';
            if (this.emptyState) this.emptyState.style.display = 'block';
            return;
        }

        if (this.emptyState) this.emptyState.style.display = 'none';

        // Sort descending by Power
        const sorted = [...this.currentPlayerList].sort((a, b) => (b.power || 0) - (a.power || 0));

        const formatNum = (num) => num ? num.toLocaleString() : '-';

        const timeAgo = (timestamp) => {
            if (!timestamp) return 'Unknown';
            const seconds = Math.floor((Date.now() - timestamp) / 1000);
            if (seconds < 60) return `${seconds}s ago`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
            return `${Math.floor(seconds / 86400)}d ago`;
        };

        const html = sorted.map(p => `
            <tr>
                <td style="color:var(--text-muted)">${p.id || 'N/A'}</td>
                <td style="font-weight:bold; color:var(--text-primary)">${p.name || 'Unknown'}</td>
                <td>${p.alliance || '-'}</td>
                <td>${formatNum(p.power)}</td>
                <td>${formatNum(p.killPoints)}</td>
                <td>${formatNum(p.t1Kills)}</td>
                <td>${formatNum(p.t2Kills)}</td>
                <td>${formatNum(p.t3Kills)}</td>
                <td>${formatNum(p.t4Kills)}</td>
                <td>${formatNum(p.t5Kills)}</td>
                <td>${formatNum(p.dead)}</td>
                <td>${formatNum(p.helps)}</td>
                <td>${formatNum(p.rssGathered)}</td>
                <td>${formatNum(p.rssAssistance)}</td>
                <td>${formatNum(p.troopPower)}</td>
                <td>${formatNum(p.techPower)}</td>
                <td>${formatNum(p.buildingPower)}</td>
                <td>${formatNum(p.commanderPower)}</td>
                <td>${formatNum(p.acclaim)}</td>
                <td>${formatNum(p.autarch)}</td>
                <td style="color:var(--text-muted); font-size: 0.85em;">
                    ${timeAgo(p.lastSync)}
                </td>
            </tr>
        `).join('');

        this.tableBody.innerHTML = html;
    }
}

window.UIMyAlliance = UIMyAlliance;
