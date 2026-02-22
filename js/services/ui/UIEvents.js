// ==========================================
// SERVICE: UI EVENTS
// ==========================================
Object.assign(UIService.prototype, {
    setupEventListeners() {
        // Main Tab Switching
        if (this.elements.mainTabs) {
            this.elements.mainTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (btn) this.switchMainTab(btn.dataset.tab);
            });
        }

        if (this.elements.kingdomTabs) {
            this.elements.kingdomTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (btn) {
                    const kId = btn.dataset.tab.replace('kingdom-', '');
                    this.switchKingdom(kId);
                }
            });
        }

        // Town Hall Filter
        if (this.elements.townHallFilter) {
            this.elements.townHallFilter.addEventListener('change', (e) => {
                this.data.state.filterTownHall25 = e.target.checked;
                // Re-render active view
                const activeMainTab = document.querySelector('.tab-btn.active');
                if (activeMainTab) {
                    const tabId = activeMainTab.dataset.tab;
                    if (tabId === 'prekvk-analysis') {
                        const activeSubTab = document.querySelector('.prekvk-subtabs .subtab-btn.active');
                        if (activeSubTab) this.switchPrekvkSubTab(activeSubTab.dataset.subtab);
                    } else if (tabId === 'all-kingdom-results') {
                        this.renderKingdomComparison();
                    } else if (tabId.startsWith('kingdom-')) {
                        const kId = tabId.replace('kingdom-', '');
                        // Recalculate if needed
                        if (this.data.state.kingdoms[kId].calculatedData.length > 0) CalculationService.calculateKingdom(kId, this.data.state);
                        this.updateOverview(kId);
                    }
                }
            });
        }

        // Reset Data (Clear Loaded Scans)
        if (this.elements.resetDataBtn) {
            this.elements.resetDataBtn.addEventListener('click', async () => {
                if (confirm('Clear current loaded scans? This will clear your workspace but keep your settings and cloud saves safe.')) {
                    try {
                        if (this.data.storage) {
                            // Initialize a fresh state and save it.
                            this.data.state = {
                                kingdoms: {},
                                loadedKingdoms: new Set(),
                                startScanDate: null, midScanDate: null, endScanDate: null,
                                soc: { activeSubTab: 'overview', zones: {} }
                            };
                            // Ensure we save it to the DB
                            const stateToSave = {
                                kingdoms: {}, loadedKingdoms: [], startScanDate: null, midScanDate: null, endScanDate: null, soc: { activeSubTab: 'overview', zones: {} }
                            };
                            await this.data.storage.saveAppState(stateToSave);
                        }
                        location.reload();
                    } catch (e) {
                        console.error(e);
                        location.reload();
                    }
                }
            });
        }

        // Factory Reset
        const factoryBtn = document.getElementById('factoryResetBtn');
        if (factoryBtn) {
            factoryBtn.addEventListener('click', async () => {
                const output = prompt("TYPE 'unity' TO CONFIRM FACTORY RESET.\nThis will wipe ALL data, settings, and local files permanently.");
                if (output === 'unity') {
                    try {
                        localStorage.clear();
                        if (this.data && this.data.storage && this.data.storage.db) {
                            this.data.storage.db.close();
                        }
                        const req = window.indexedDB.deleteDatabase('UnityDKP_DB');
                        req.onsuccess = () => location.reload();
                        req.onerror = () => { console.error("DB Delete Failed"); location.reload(); };
                        req.onblocked = () => { console.warn("DB Delete Blocked"); location.reload(); };
                    } catch (e) {
                        alert("Reset failed: " + e.message);
                        location.reload();
                    }
                } else {
                    if (output !== null) alert("Incorrect password. Reset cancelled.");
                }
            });
        }

        // GitHub Integration
        this.ghService = new GitHubService();
        const ghOwner = document.getElementById('ghOwner');
        const ghRepo = document.getElementById('ghRepo');
        const ghToken = document.getElementById('ghToken');

        // Load saved config
        if (this.ghService.config.token) {
            if (ghOwner) ghOwner.value = this.ghService.config.owner;
            if (ghRepo) ghRepo.value = this.ghService.config.repo;
            if (ghToken) ghToken.value = this.ghService.config.token;
        }

        const saveGhBtn = document.getElementById('saveGhConfigBtn');
        if (saveGhBtn) {
            saveGhBtn.addEventListener('click', () => {
                const success = this.ghService.saveConfig(
                    ghOwner.value.trim(),
                    ghRepo.value.trim(),
                    ghToken.value.trim()
                );
                if (success) alert('GitHub configuration saved!');
            });
        }

        // ---- Gemini API Key ----
        const geminiInput = document.getElementById('geminiApiKey');

        // Load previously saved key from localStorage
        const savedGeminiKey = localStorage.getItem('geminiApiKey') || '';
        if (geminiInput && savedGeminiKey) geminiInput.value = savedGeminiKey;

        // Also seed the OCR service if it's already running
        if (savedGeminiKey && window.ocrService) {
            window.ocrService.apiKey = savedGeminiKey;
            window.ocrService.updateStatusBadge();
        }

        const saveGeminiBtn = document.getElementById('saveGeminiKeyBtn');
        if (saveGeminiBtn) {
            saveGeminiBtn.addEventListener('click', () => {
                const key = geminiInput ? geminiInput.value.trim() : '';
                if (!key) {
                    alert('Please enter a Gemini API key.');
                    return;
                }
                localStorage.setItem('geminiApiKey', key);

                // Apply immediately to live OCR service
                if (window.ocrService) {
                    window.ocrService.apiKey = key;
                    window.ocrService.updateStatusBadge();
                }

                alert('Gemini API key saved! ✅');
            });
        }

        // Upload Buttons
        ['start', 'mid', 'end'].forEach(type => {
            const btn = document.getElementById(`cloudUpload${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
            if (btn) {
                btn.addEventListener('click', async () => {
                    const kingdoms = Array.from(this.data.state.loadedKingdoms);
                    if (kingdoms.length === 0) return alert('No data to upload.');

                    // Gather data for this type
                    let allData = [];
                    let date = new Date().toISOString().split('T')[0];
                    if (type === 'start') {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].startData));
                        date = this.data.state.startScanDate || date;
                    } else if (type === 'mid') {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].midData));
                        date = this.data.state.midScanDate || date;
                    } else {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].endData));
                        date = this.data.state.endScanDate || date;
                    }

                    if (allData.length === 0) return alert('No relevant scan data found to upload.');

                    const name = prompt('Enter a name for this cloud save:', `${type}_scan_${date}`);
                    if (!name) return;

                    const fileName = `scans/${type}/${name}.json`;

                    try {
                        btn.textContent = '⏳';
                        await this.ghService.uploadFile(fileName, allData, `Upload ${type} scan: ${name}`);
                        alert(`Uploaded successfully to ${fileName}`);
                        btn.textContent = '☁️';
                    } catch (e) {
                        alert('Upload failed: ' + e.message);
                        btn.textContent = '❌';
                        setTimeout(() => btn.textContent = '☁️', 2000);
                    }
                });
            }
        });

        // PreKVK Analysis Listeners
        const prekvkSubTabs = document.querySelector('.prekvk-subtabs');
        if (prekvkSubTabs) {
            prekvkSubTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('subtab-btn')) {
                    this.switchPrekvkSubTab(e.target.dataset.subtab);
                }
            });
        }

        if (this.elements.prekvkKingdomSelect) {
            this.elements.prekvkKingdomSelect.addEventListener('change', (e) => {
                const kingdomId = e.target.value;
                const activeBtn = document.querySelector('.prekvk-subtabs .subtab-btn.active');
                if (activeBtn) {
                    const activeSubTab = activeBtn.dataset.subtab;
                    if (activeSubTab === 'alliance-analysis') this.renderAllianceAnalysis(kingdomId);
                    if (activeSubTab === 'governor-analysis') this.renderGovernorAnalysis(kingdomId);
                }
            });
        }

        if (this.elements.prekvkGovCountSelect) {
            this.elements.prekvkGovCountSelect.addEventListener('change', () => this.renderKingdomAnalysis());
        }

        // PreKVK Ranking Listeners
        if (this.elements.rankingGovCountSelect) {
            this.elements.rankingGovCountSelect.addEventListener('change', (e) => {
                document.getElementById('rankingCountLabel').textContent = e.target.value === 'all' ? 'All' : e.target.value;
                this.renderPreKVKRanking();
            });
        }

        // Comparison Limit and Custom Weights
        ['kingdomComparisonLimit', 'allKingdomT4Weight', 'allKingdomT5Weight', 'allKingdomDeadWeight'].forEach(id => {
            if (this.elements[id]) {
                this.elements[id].addEventListener('input', Utils.debounce(() => this.renderKingdomComparison(), 300));
            }
        });

        // New Phone Who Dis Listeners
        if (this.elements.npwdKingdomSelect) {
            this.elements.npwdKingdomSelect.addEventListener('change', (e) => {
                this.renderNewPhoneWhoDis(e.target.value);
            });
        }

        this.attachProfileListeners();
    },

    attachProfileListeners() {
        const types = ['start', 'mid', 'end'];
        types.forEach(type => {
            const nameInput = document.getElementById(`${type}ProfileName`);
            if (!nameInput) return; // Skip if element removed from UI

            const saveBtn = nameInput.nextElementSibling;
            const loadBtn = document.getElementById(`load${type.charAt(0).toUpperCase() + type.slice(1)}ScanBtn`);
            const deleteBtn = document.getElementById(`delete${type.charAt(0).toUpperCase() + type.slice(1)}ScanBtn`);
            const select = document.getElementById(`${type}ProfileSelect`);

            // Populate initially
            this.updateProfileDropdown(type);

            // SAVE
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const nameInput = document.getElementById(`${type}ProfileName`);
                    const name = nameInput.value.trim();

                    const gatheredData = [];
                    const kingdoms = [];
                    let date = null;

                    Object.keys(this.data.state.kingdoms).forEach(kId => {
                        const k = this.data.state.kingdoms[kId];
                        const list = (type === 'start') ? k.startData : (type === 'mid' ? k.midData : k.endData);
                        if (list && list.length > 0) {
                            gatheredData.push(...list);
                            kingdoms.push(kId);
                        }
                    });

                    if (type === 'start') date = this.data.state.startScanDate;
                    if (type === 'mid') date = this.data.state.midScanDate;
                    if (type === 'end') date = this.data.state.endScanDate;

                    if (gatheredData.length === 0) {
                        alert(`No ${type} scan data loaded to save.`);
                        return;
                    }

                    try {
                        await this.data.storage.saveScan(type, name, { data: gatheredData, date, kingdoms });
                        this.updateProfileDropdown(type);
                        nameInput.value = '';
                        alert('Profile saved!');
                    } catch (e) { console.error(e); alert('Error saving profile.'); }
                });
            }

            // LOAD
            if (loadBtn) {
                loadBtn.addEventListener('click', async () => {
                    const val = select.value;
                    if (!val) return alert('Please select a profile first.');

                    if (val.startsWith('cloud:')) {
                        try {
                            loadBtn.textContent = '⏳';
                            const path = val.replace('cloud:', '');
                            const filename = path.split('/').pop().replace('.json', '');

                            // Attempt to extract date from filename (YYYY-MM-DD)
                            // Expected format: type_scan_YYYY-MM-DD OR just anything ending in date
                            let date = new Date().toISOString().split('T')[0]; // Default to today
                            const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
                            if (dateMatch) {
                                date = dateMatch[1];
                            }

                            const content = await this.ghService.getFileContent(path);

                            // Handle both Raw Array and Wrapped Object formats
                            let data = content;
                            if (!Array.isArray(content) && content.data && Array.isArray(content.data)) {
                                data = content.data;
                                if (content.date) date = content.date; // Prefer saved date
                            }

                            const kingdoms = new Set(data.map(r => r._kingdom).filter(k => k));

                            // Update State Date
                            if (type === 'start') this.data.state.startScanDate = date;
                            else if (type === 'mid') this.data.state.midScanDate = date;
                            else this.data.state.endScanDate = date;

                            this.updateScanDetails(type, date, Array.from(kingdoms));

                            kingdoms.forEach(kId => {
                                this.data.initKingdom(kId);
                                const kState = this.data.state.kingdoms[kId];
                                if (type === 'start') kState.startData = data.filter(r => r._kingdom === kId);
                                else if (type === 'mid') kState.midData = data.filter(r => r._kingdom === kId);
                                else kState.endData = data.filter(r => r._kingdom === kId);

                                if (kState.startData.length > 0 && kState.endData.length > 0) {
                                    CalculationService.calculateKingdom(kId, this.data.state);
                                }
                            });
                            this.data.saveState();
                            this.renderKingdomTabs();
                            this.updateOverview(this.data.state.activeKingdomId || Array.from(this.data.state.loadedKingdoms)[0]);
                            alert(`${type.toUpperCase()} cloud profile loaded!`);
                        } catch (e) {
                            console.error(e);
                            alert('Failed to load cloud profile: ' + e.message);
                        } finally {
                            loadBtn.textContent = 'Load';
                        }
                    } else {
                        // Local Load
                        try {
                            const result = await this.data.loadScanFromStorage(parseInt(val));
                            if (!result) throw new Error('Scan not found');
                            const { data, date, kingdoms } = result;

                            if (type === 'start') { this.data.state.startScanDate = date; }
                            else if (type === 'mid') { this.data.state.midScanDate = date; }
                            else { this.data.state.endScanDate = date; }

                            this.updateScanDetails(type, date, kingdoms);

                            kingdoms.forEach(kId => {
                                this.data.initKingdom(kId);
                                const kState = this.data.state.kingdoms[kId];
                                if (type === 'start') kState.startData = data.filter(r => r['_kingdom'] === kId);
                                else if (type === 'mid') kState.midData = data.filter(r => r['_kingdom'] === kId);
                                else kState.endData = data.filter(r => r['_kingdom'] === kId);
                            });

                            this.data.saveState();
                            this.renderKingdomTabs();
                            this.data.state.loadedKingdoms.forEach(kId => CalculationService.calculateKingdom(kId, this.data.state));
                            this.renderKingdomComparison();
                            alert(`${type.toUpperCase()} profile loaded!`);

                        } catch (e) { console.error(e); alert('Error loading profile.'); }
                    }
                });
            }

            // DELETE
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    const id = select.value;
                    if (!id) return;
                    if (confirm('Delete this profile permanently?')) {
                        await this.data.storage.deleteScan(parseInt(id));
                        this.updateProfileDropdown(type);
                    }
                });
            }
        });
    },

    async updateProfileDropdown(type) {
        const select = document.getElementById(`${type}ProfileSelect`);
        if (!select) return;

        const scans = await this.data.storage.getScans();

        select.innerHTML = '<option value="">Load Saved Profile...</option>';
        scans.forEach(scan => {
            const option = document.createElement('option');
            option.value = scan.id;
            const typeLabel = scan.type.charAt(0).toUpperCase() + scan.type.slice(1);
            option.textContent = `[${typeLabel}] ${scan.name} (${new Date(scan.timestamp).toLocaleDateString()})`;
            select.appendChild(option);
        });

        if (this.ghService) {
            try {
                const files = await this.ghService.getFiles(`scans/${type}`);
                if (Array.isArray(files)) {
                    files.forEach(file => {
                        if (file.name.endsWith('.json')) {
                            const option = document.createElement('option');
                            const name = file.name.replace('.json', '');
                            option.value = `cloud:${file.path}`;
                            option.textContent = `☁️ ${name}`;
                            select.appendChild(option);
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch ${type} profiles from GitHub`, e);
            }
        }
    }
});
