// ==========================================
// SERVICE: UI EVENTS
// ==========================================
Object.assign(UIService.prototype, {
    setupEventListeners() {
        // Main Tab Switching (Sidebar)
        const sidebarMenu = document.querySelector('.sidebar-menu');
        if (sidebarMenu) {
            sidebarMenu.addEventListener('click', (e) => {
                const btn = e.target.closest('.nav-btn, .nav-category-btn, .subtab-btn');
                if (btn && btn.dataset.tab) {
                    this.switchMainTab(btn.dataset.tab);
                }
            });
        }
        
        // Classic HTML Top Nav Binding
        const classicTabsContainer = document.getElementById('main-tabs-classic');
        if (classicTabsContainer) {
            classicTabsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (btn && btn.dataset.tab) {
                    this.switchMainTab(btn.dataset.tab);
                }
            });
        }

        const classicKingdomTabs = document.getElementById('kingdom-tabs-classic');
        if (classicKingdomTabs) {
            classicKingdomTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.kingdom-tab-btn');
                if (!btn) return;
                const tabId = btn.dataset.tab;
                if (tabId.startsWith('kingdom-')) {
                    this.switchKingdom(tabId.replace('kingdom-', ''));
                }
            });
        }

        if (this.elements['dynamic-kingdom-tabs']) {
            this.elements['dynamic-kingdom-tabs'].addEventListener('click', (e) => {
                const btn = e.target.closest('.kingdom-tab-btn');
                if (!btn) return;
                const tabId = btn.dataset.tab;
                if (tabId.startsWith('kingdom-')) {
                    this.switchKingdom(tabId.replace('kingdom-', ''));
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

        // --------------------------------------------------------------------
        // MASTER WIPE LOCK LOGIC (HOTEL SAFE)
        // --------------------------------------------------------------------
        const toggleWipeLockBtn = document.getElementById('toggleWipeLockBtn');
        const wipePasswordInput = document.getElementById('wipePasswordInput');
        const wipeLockStatus = document.getElementById('wipeLockStatus');

        // Helper to check whichever DB is currently active for the lock
        const fetchActiveLock = async () => {
            if (window.awsRosterService && window.awsRosterService.connected) {
                return await window.awsRosterService.getWipeLock();
            } else if (window.firebaseRosterService && window.firebaseRosterService.connected) {
                return await window.firebaseRosterService.getWipeLock();
            }
            return localStorage.getItem('unityWipeLock');
        };

        const updateLockUI = async () => {
            const currentLock = await fetchActiveLock();
            if (currentLock) {
                // Safe is locked
                if (wipeLockStatus) wipeLockStatus.innerHTML = '🔒 Locked';
                if (toggleWipeLockBtn) {
                    toggleWipeLockBtn.textContent = 'Unlock';
                    toggleWipeLockBtn.style.background = 'var(--text-muted)';
                }
            } else {
                // Safe is unlocked
                if (wipeLockStatus) wipeLockStatus.innerHTML = '🔓 Unlocked';
                if (toggleWipeLockBtn) {
                    toggleWipeLockBtn.textContent = 'Lock';
                    toggleWipeLockBtn.style.background = 'var(--accent-primary)';
                }
            }
        };

        // UI Initialization checks lock state
        if (wipeLockStatus) updateLockUI();

        if (toggleWipeLockBtn && wipePasswordInput) {
            toggleWipeLockBtn.addEventListener('click', async () => {
                // Prevent multi-clicks
                toggleWipeLockBtn.disabled = true;

                try {
                    const inputVal = wipePasswordInput.value.trim();
                    const currentLock = await fetchActiveLock();

                    if (!currentLock) {
                        // UNLOCKED -> LOCKING
                        if (!inputVal) {
                            alert("To lock the safe, enter a password first.");
                            return;
                        }

                        // Write to all active databases
                        if (window.awsRosterService && window.awsRosterService.connected) await window.awsRosterService.setWipeLock(inputVal);
                        if (window.firebaseRosterService && window.firebaseRosterService.connected) await window.firebaseRosterService.setWipeLock(inputVal);
                        localStorage.setItem('unityWipeLock', inputVal); // Fallback

                        wipePasswordInput.value = '';
                        await updateLockUI();
                        alert("Safe Locked Globally. You will need this password to wipe databases or unlock the safe.");
                    } else {
                        // LOCKED -> UNLOCKING
                        if (!inputVal) {
                            alert("Enter the active password to unlock the safe.");
                            return;
                        }
                        if (inputVal === currentLock) {
                            // Valid password: Remove locks
                            if (window.awsRosterService && window.awsRosterService.connected) await window.awsRosterService.setWipeLock(null);
                            if (window.firebaseRosterService && window.firebaseRosterService.connected) await window.firebaseRosterService.setWipeLock(null);
                            localStorage.removeItem('unityWipeLock');

                            wipePasswordInput.value = '';
                            await updateLockUI();
                            alert("Safe Unlocked. Wipe buttons are now accessible via 'DELETE'.");
                        } else {
                            alert("Incorrect Master Password.");
                        }
                    }
                } catch (e) {
                    console.error("Lock Toggle Error", e);
                    alert("Failed to toggle safe lock state check console for details.");
                } finally {
                    toggleWipeLockBtn.disabled = false;
                }
            });
        }

        // Helper to validate wipe intent
        const requestWipeClearance = async (actionName) => {
            const currentLock = await fetchActiveLock();
            if (currentLock) {
                // Locked mode: requires exact password
                const output = prompt(`[LOCKED] Enter Master Wipe Password to execute ${actionName}:`);
                if (output === null) return false; // Cancelled
                if (output === currentLock) return true;
                alert("Incorrect Master Password. Action denied.");
                return false;
            } else {
                // Unlocked mode: standard confirmation
                const output = prompt(`WARNING: You are about to irrevocably execute ${actionName}.\n\nType 'DELETE' in all caps to confirm.`);
                if (output === null) return false;
                if (output === 'DELETE') return true;
                alert("Incorrect confirmation string. Action cancelled.");
                return false;
            }
        };

        // Factory Reset
        const resetBtn = document.getElementById('factoryResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const isCleared = await requestWipeClearance('Factory Reset');
                if (isCleared) {
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
                }
            });
        }

        // Wipe Firebase
        const wipeFbBtn = document.getElementById('wipeFirebaseBtn');
        if (wipeFbBtn) {
            wipeFbBtn.addEventListener('click', async () => {
                const isCleared = await requestWipeClearance('Wipe Firebase Database');
                if (isCleared) {
                    if (window.firebaseRosterService) {
                        try {
                            wipeFbBtn.textContent = 'Wiping...';
                            wipeFbBtn.disabled = true;
                            await window.firebaseRosterService.wipeDatabase();
                            alert("Firebase Database has been successfully wiped clean.");
                        } catch (err) {
                            alert("Failed to wipe Firebase: " + err.message);
                        } finally {
                            wipeFbBtn.textContent = 'Wipe Firebase';
                            wipeFbBtn.disabled = false;
                        }
                    } else {
                        alert("Firebase Sync is not connected.");
                    }
                }
            });
        }

        // Wipe AWS DynamoDB
        const wipeAwsBtn = document.getElementById('wipeAwsBtn');
        if (wipeAwsBtn) {
            wipeAwsBtn.addEventListener('click', async () => {
                const isCleared = await requestWipeClearance('Wipe AWS DynamoDB Table');
                if (isCleared) {
                    if (window.awsRosterService && window.awsRosterService.connected) {
                        try {
                            wipeAwsBtn.textContent = 'Wiping...';
                            wipeAwsBtn.disabled = true;
                            await window.awsRosterService.wipeDatabase();
                            alert("AWS Database has been successfully wiped clean.");
                        } catch (err) {
                            alert("Failed to wipe AWS Database: " + err.message);
                        } finally {
                            wipeAwsBtn.textContent = 'Wipe AWS';
                            wipeAwsBtn.disabled = false;
                        }
                    } else {
                        alert("AWS Sync is not connected.");
                    }
                }
            });
        }

        // --- Export / Import Settings ---
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        const importSettingsBtn = document.getElementById('importSettingsBtn');
        const importSettingsInput = document.getElementById('importSettingsInput');

        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                const configToExport = {
                    active_cloud_provider: localStorage.getItem('active_cloud_provider'),
                    __unity_firebase_url: localStorage.getItem('__unity_firebase_url'),
                    __unity_recruit_firebase_url: localStorage.getItem('__unity_recruit_firebase_url'),
                    aws_dynamo_config: localStorage.getItem('aws_dynamo_config'),
                    unity_gh_config: localStorage.getItem('unity_gh_config'),
                    geminiApiKey: localStorage.getItem('geminiApiKey'),
                    geminiApiModel: localStorage.getItem('geminiApiModel')
                };

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configToExport, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "unity_config.json");
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            });
        }

        if (importSettingsBtn && importSettingsInput) {
            importSettingsBtn.addEventListener('click', () => {
                importSettingsInput.click();
            });

            importSettingsInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importedConfig = JSON.parse(event.target.result);

                        // Set the keys if they exist in the uploaded JSON
                        const keysToImport = [
                            'active_cloud_provider', '__unity_firebase_url', '__unity_recruit_firebase_url',
                            'aws_dynamo_config', 'unity_gh_config', 'geminiApiKey', 'geminiApiModel'
                        ];

                        let importedCount = 0;
                        keysToImport.forEach(key => {
                            if (importedConfig[key] !== undefined && importedConfig[key] !== null) {
                                localStorage.setItem(key, importedConfig[key]);
                                importedCount++;
                            }
                        });

                        // Clear input so same file can be selected again
                        importSettingsInput.value = '';

                        if (importedCount > 0) {
                            alert(`Successfully imported ${importedCount} configuration keys. The app will now reload to apply the changes.`);
                            location.reload(); // Reload to initialize services with new keys and update UI elements
                        } else {
                            alert('No valid configuration keys found in the file.');
                        }

                    } catch (err) {
                        alert('Error parsing the configuration file. Please ensure it is a valid unity_config.json file.');
                        console.error('Config Import Error:', err);
                    }
                };
                reader.readAsText(file);
            });
        }

        // Firebase Global Config
        const firebaseDbUrl = document.getElementById('firebaseDbUrl');
        const saveFirebaseBtn = document.getElementById('saveSettingsBtn');
        if (firebaseDbUrl) firebaseDbUrl.value = localStorage.getItem('__unity_firebase_url') || '';

        if (saveFirebaseBtn) {
            saveFirebaseBtn.addEventListener('click', () => {
                const url = firebaseDbUrl ? firebaseDbUrl.value.trim() : '';
                localStorage.setItem('__unity_firebase_url', url);
                alert("Firebase Database URL saved. Unity will attempt to connect...");

                if (window.firebaseRosterService) {
                    window.firebaseRosterService.init(url);
                }
            });
        }

        // Recruiting Firebase Config
        const recruitFirebaseUrl = document.getElementById('recruitFirebaseUrl');
        const saveRecruitBtn = document.getElementById('saveRecruitDbBtn');
        if (recruitFirebaseUrl) recruitFirebaseUrl.value = localStorage.getItem('__unity_recruit_firebase_url') || 'https://recruitingroster-default-rtdb.firebaseio.com/';

        if (saveRecruitBtn) {
            saveRecruitBtn.addEventListener('click', () => {
                const url = recruitFirebaseUrl.value.trim();
                localStorage.setItem('__unity_recruit_firebase_url', url);
                alert("Recruiting Database URL saved! Scanned applicants will now be pushed here.");
            });
        }

        // Bulk Firebase Upload
        const bulkFirebaseBtn = document.getElementById('bulkFirebaseUploadBtn');
        const bulkFirebaseInput = document.getElementById('bulkFirebaseUploadInput');
        if (bulkFirebaseBtn && bulkFirebaseInput) {
            bulkFirebaseBtn.addEventListener('click', () => {
                bulkFirebaseInput.click();
            });

            bulkFirebaseInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const originalText = bulkFirebaseBtn.innerHTML;
                bulkFirebaseBtn.innerHTML = `<span>⏳</span> Processing ${files.length} files...`;
                bulkFirebaseBtn.disabled = true;

                let successCount = 0;
                let failCount = 0;

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        // 1. Parse the file into the standard {data, date, kingdoms} format using the existing DataService pipeline
                        if (!this.data) throw new Error("DataService is not initialized on this instance.");
                        const parsed = await this.data.parseFile(file);

                        const { data, date } = parsed;
                        if (!data || data.length === 0 || !date) {
                            console.warn(`[BulkImport] Skipping ${file.name}: Missing data or date.`);
                            failCount++;
                            continue;
                        }

                        // 2. Group records by Kingdom to handle multi-kd CSVs correctly
                        const kingdomGroups = {};
                        data.forEach(p => {
                            const kId = p['_kingdom'];
                            if (!kId) return;
                            if (!kingdomGroups[kId]) kingdomGroups[kId] = [];
                            kingdomGroups[kId].push(p);
                        });

                        // 3. Push each kingdom's slice directly to Firebase
                        for (const [kId, records] of Object.entries(kingdomGroups)) {
                            await window.uiMyAlliance.rosterService.pushFullScan(kId, date, records);
                        }

                        successCount++;
                    } catch (err) {
                        console.error(`[BulkImport] Error processing file ${file.name}:`, err);
                        failCount++;
                    }
                }

                bulkFirebaseBtn.innerHTML = `<span>✅</span> Complete!`;

                setTimeout(() => {
                    bulkFirebaseBtn.innerHTML = originalText;
                    bulkFirebaseBtn.disabled = false;
                    bulkFirebaseInput.value = ''; // Reset input

                    alert(`Bulk Firebase Upload Complete!\n\nSuccessfully pushed: ${successCount} files.\nFailed: ${failCount} files.`);
                }, 2000);
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

        // ---- Gemini API Key & Model ----
        const geminiInput = document.getElementById('geminiApiKey');
        const geminiModelSelect = document.getElementById('geminiApiModel');

        // Load previously saved key & model from localStorage
        const savedGeminiKey = localStorage.getItem('geminiApiKey') || '';
        const savedGeminiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';

        if (geminiInput && savedGeminiKey) geminiInput.value = savedGeminiKey;
        if (geminiModelSelect && savedGeminiModel) geminiModelSelect.value = savedGeminiModel;

        // Also seed the OCR service if it's already running
        if (savedGeminiKey && window.ocrService) {
            window.ocrService.apiKey = savedGeminiKey;
            window.ocrService.apiModel = savedGeminiModel;
            window.ocrService.updateStatusBadge();
        }

        const saveGeminiBtn = document.getElementById('saveGeminiKeyBtn');
        if (saveGeminiBtn) {
            saveGeminiBtn.addEventListener('click', () => {
                const key = geminiInput ? geminiInput.value.trim() : '';
                const model = geminiModelSelect ? geminiModelSelect.value : 'gemini-2.5-flash';

                localStorage.setItem('geminiApiKey', key);
                localStorage.setItem('geminiApiModel', model);

                if (window.ocrService) {
                    window.ocrService.apiKey = key;
                    window.ocrService.apiModel = model;
                    window.ocrService.updateStatusBadge();
                }
                alert('Gemini API key saved! ✅');
            });
        }

        // ---- Google Calendar Settings ----
        const googleCalendarIdInput = document.getElementById('googleCalendarId');
        const googleCalendarApiKeyInput = document.getElementById('googleCalendarApiKey');
        const saveCalendarConfigBtn = document.getElementById('saveCalendarConfigBtn');

        if (saveCalendarConfigBtn) {
            // Load existing
            if (googleCalendarIdInput) googleCalendarIdInput.value = localStorage.getItem('google_calendar_id') || '';
            if (googleCalendarApiKeyInput) googleCalendarApiKeyInput.value = localStorage.getItem('google_calendar_api_key') || '';

            saveCalendarConfigBtn.addEventListener('click', () => {
                const calId = googleCalendarIdInput ? googleCalendarIdInput.value.trim() : '';
                const apiKey = googleCalendarApiKeyInput ? googleCalendarApiKeyInput.value.trim() : '';

                if (window.calendarService) {
                    window.calendarService.updateConfig(calId, apiKey);
                } else {
                    localStorage.setItem('google_calendar_id', calId);
                    localStorage.setItem('google_calendar_api_key', apiKey);
                }

                alert('Google Calendar configuration saved locally!');

                // Immediately try to re-render events if configured
                if (window.calendarService && window.uiCalendarRenderer) {
                    window.uiCalendarRenderer.render();
                }
            });
        }

        // ---- AWS DynamoDB Settings ----
        const awsTableName = document.getElementById('awsTableName');
        const awsRegion = document.getElementById('awsRegion');
        const awsAccessKey = document.getElementById('awsAccessKey');
        const awsSecretKey = document.getElementById('awsSecretKey');
        const awsActiveToggle = document.getElementById('awsActiveToggle');
        const saveAwsBtn = document.getElementById('saveAwsConfigBtn');

        if (saveAwsBtn && awsActiveToggle) {
            // Load saved config
            const savedAwsConfig = JSON.parse(localStorage.getItem('aws_dynamo_config')) || {};
            if (savedAwsConfig.tableName) awsTableName.value = savedAwsConfig.tableName;
            if (savedAwsConfig.region) awsRegion.value = savedAwsConfig.region;
            if (savedAwsConfig.accessKey) awsAccessKey.value = savedAwsConfig.accessKey;
            if (savedAwsConfig.secretKey) awsSecretKey.value = savedAwsConfig.secretKey;

            const isAwsActive = localStorage.getItem('active_cloud_provider') === 'aws';
            awsActiveToggle.checked = isAwsActive;

            // Save AWS Config
            saveAwsBtn.addEventListener('click', () => {
                const config = {
                    tableName: awsTableName.value.trim(),
                    region: awsRegion.value.trim(),
                    accessKey: awsAccessKey.value.trim(),
                    secretKey: awsSecretKey.value.trim()
                };
                localStorage.setItem('aws_dynamo_config', JSON.stringify(config));

                if (window.awsRosterService) {
                    window.awsRosterService.init(config);
                }

                alert('AWS DynamoDB configurations saved locally and updated in your current session!');
            });

            // Toggle active provider (Firebase vs AWS)
            awsActiveToggle.addEventListener('change', (e) => {
                const provider = e.target.checked ? 'aws' : 'firebase';
                localStorage.setItem('active_cloud_provider', provider);
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
                    if (activeSubTab === 'kingdom-analysis') this.renderKingdomAnalysis();
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
        ['kingdomComparisonLimit', 'allKingdomT4Weight', 'allKingdomT5Weight', 'allKingdomDeadWeight', 'allKingdomT4DeadWeight', 'allKingdomT5DeadWeight'].forEach(id => {
            if (this.elements[id]) {
                this.elements[id].addEventListener('input', Utils.debounce(() => this.renderKingdomComparison(), 300));
            }
        });

        // Advanced Mode Toggle
        if (this.elements.allKingdomDkpMode) {
            this.elements.allKingdomDkpMode.addEventListener('change', (e) => {
                const mode = e.target.value;
                const basicInputs = document.getElementById('basicAllKingdomInputs');
                const advInputs = document.getElementById('advancedAllKingdomInputs');
                const scanner = document.getElementById('allKingdomHoHScannerContainer');

                if (mode === 'advanced') {
                    basicInputs?.classList.add('hidden');
                    advInputs?.classList.remove('hidden');
                    scanner?.classList.remove('hidden');
                } else {
                    advInputs?.classList.add('hidden');
                    scanner?.classList.add('hidden');
                    basicInputs?.classList.remove('hidden');
                }

                this.renderKingdomComparison();
            });
            // trigger initialization
            this.elements.allKingdomDkpMode.dispatchEvent(new Event('change'));
        }

        // New Phone Who Dis Listeners
        if (this.elements.npwdKingdomSelect) {
            this.elements.npwdKingdomSelect.addEventListener('change', (e) => {
                this.renderLocalTransferAnalysis(e.target.value);
            });
        }

        const npwdSubTabs = document.getElementById('npwdSubTabs');
        if (npwdSubTabs) {
            const subTabs = npwdSubTabs.querySelectorAll('.upload-tab-btn');
            subTabs.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetId = e.currentTarget.dataset.subtab;
                    subTabs.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    document.querySelectorAll('#new-phone-who-dis .upload-tab-content').forEach(content => {
                        content.classList.remove('active');
                        if (content.dataset.content === targetId) {
                            content.classList.add('active');
                        }
                    });
                });
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
