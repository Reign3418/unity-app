// ==========================================
// SERVICE: UI EXPORTS & COMMAND CENTER & CLOUD
// ==========================================
Object.assign(UIService.prototype, {
    exportToCSV(kingdomId) {
        const data = this.data.state.kingdoms[kingdomId].calculatedData;
        if (!data || data.length === 0) return;
        const headers = ['Governor ID', 'Governor Name', 'Kingdom', 'Starting Power', 'Power +/-', 'Troop Power', 'T1 Kills', 'T2 Kills', 'T3 Kills', 'T4 Kills', 'T5 Kills', 'T4+T5 Combined', 'Kvk Deads', 'KVK KP', 'Target DKP', 'KP % Complete', 'Target Deads', 'Dead% Complete', 'Total DKP %', 'Bonus/Punishment'];
        const csvContent = [headers.join(','), ...data.map(row => [row.id, `"${row.name}"`, row.kingdom, row.startPower, row.powerDiff, row.troopPowerDiff, row.t1, row.t2, row.t3, row.t4, row.t5, row.t4t5, row.deads, row.kvkKP, row.targetKP, row.kpPercent, row.targetDeads, row.deadPercent, row.totalDKPPercent, row.bonus].join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `dkp_results_kingdom_${kingdomId}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    },

    exportOverviewCSV(kingdomId, data) {
        if (!data || data.length === 0) {
            alert("No data available to export.");
            return;
        }

        // 1. Get Dynamic Headers
        const headers = Object.keys(data[0]).filter(h => h !== '_kingdom' && h !== 'Kingdom');

        // 2. Format Rows (Clean HTML from diffs)
        const rows = data.map(row => {
            return headers.map(header => {
                let cell = row[header] || '';
                // Clean HTML tags from diffs (e.g. <span class="diff-pos">+123</span> -> +123)
                if (typeof cell === 'string' && cell.includes('<')) {
                    const temp = document.createElement('div');
                    temp.innerHTML = cell;
                    cell = temp.textContent || temp.innerText || '';
                }
                // Wrap strings with commas in quotes
                if (typeof cell === 'string' && cell.includes(',')) {
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `overview_export_kingdom_${kingdomId}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    },

    updateCommandKingdomDropdown() {
        const select = document.getElementById('commandKingdomSelect');
        if (!select) return;

        // Preserve current selection if valid
        const currentVal = select.value;
        select.innerHTML = '';

        if (this.data.state.loadedKingdoms.size === 0) {
            select.innerHTML = '<option value="">No Kingdoms Loaded</option>';
            return;
        }

        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });

        // Set Default or Restore
        if (currentVal && this.data.state.loadedKingdoms.has(currentVal)) {
            select.value = currentVal;
        } else {
            select.value = Array.from(this.data.state.loadedKingdoms)[0];
        }
    },

    handleGenerateReportCard() {
        const kId = document.getElementById('commandKingdomSelect').value;
        const term = document.getElementById('reportCardSearch').value.trim().toLowerCase();

        if (!kId) return alert("Please upload scans and select a kingdom first.");
        if (!term) return alert("Please enter a Governor Name or ID.");

        const kState = this.data.state.kingdoms[kId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!sourceData || sourceData.length === 0) return alert("No data available for this kingdom.");

        const governor = sourceData.find(g =>
            (g['Governor Name'] && g['Governor Name'].toLowerCase().includes(term)) ||
            (g['Governor ID'] && g['Governor ID'].toString() === term)
        );

        if (!governor) {
            this.renderReportCard(null);
            return;
        }

        // Calculate Grade
        const kp = Utils.parseNumber(governor['Kill Points']);
        const dead = Utils.parseNumber(governor['Deads']);
        const t4 = Utils.parseNumber(governor['T4 Kills']);
        const t5 = Utils.parseNumber(governor['T5 Kills']);
        const power = Utils.parseNumber(governor['Power']);

        let grade = 'C';
        let colorClass = 'grade-C';

        // Grading Logic
        if (kp > 1000000000 || (kp > 500000000 && dead > 5000000)) { grade = 'S'; colorClass = 'grade-S'; }
        else if (kp > 300000000) { grade = 'A'; colorClass = 'grade-A'; }
        else if (kp > 100000000) { grade = 'B'; colorClass = 'grade-B'; }
        else if (kp < 10000000) { grade = 'F'; colorClass = 'grade-F'; }

        const cardData = {
            name: governor['Governor Name'],
            id: governor['Governor ID'],
            alliance: governor['Alliance Tag'] || 'Unknown',
            grade,
            colorClass,
            stats: {
                kp: kp.toLocaleString(),
                dead: dead.toLocaleString(),
                t4: t4.toLocaleString(),
                t5: t5.toLocaleString(),
                power: power.toLocaleString()
            }
        };

        this.renderReportCard(cardData);
    },

    handleBalanceSquads() {
        const kId = document.getElementById('commandKingdomSelect').value;
        const poolType = document.getElementById('squadPoolSelect').value;
        const squadCount = parseInt(document.getElementById('squadCountSelect').value);

        if (!kId) return alert("Please select a kingdom.");

        const kState = this.data.state.kingdoms[kId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!sourceData || sourceData.length === 0) return alert("No data available.");

        // Determine Pool Size
        let poolSize = 30;
        if (poolType === 'top60') poolSize = 60;
        if (poolType === 'top90') poolSize = 90;

        // 1. Sort by Power
        const sorted = [...sourceData]
            .sort((a, b) => Utils.parseNumber(b['Power']) - Utils.parseNumber(a['Power']))
            .slice(0, poolSize);

        // 2. Initialize Buckets
        const squads = Array.from({ length: squadCount }, (_, i) => ({
            id: i + 1,
            name: squadCount === 2 ? (i === 0 ? 'Team Sun ☀️' : 'Team Moon 🌙') : `Squad ${i + 1}`,
            members: [],
            totalPower: 0,
            totalKP: 0
        }));

        // 3. Greedy Partitioning
        sorted.forEach(gov => {
            squads.sort((a, b) => a.totalPower - b.totalPower);
            const target = squads[0];

            const pwr = Utils.parseNumber(gov['Power']);
            target.members.push({
                name: gov['Governor Name'],
                power: pwr,
                kp: Utils.parseNumber(gov['Kill Points'])
            });
            target.totalPower += pwr;
            target.totalKP += Utils.parseNumber(gov['Kill Points']);
        });

        this.renderSquads(squads);
    },

    renderCloudFileBrowser(modal, browser, closeBtn, onFileSelect, initialPath = '') {
        if (!modal || !browser) return;

        modal.classList.remove('hidden');
        browser.innerHTML = '<div class="loader">Loading files from GitHub...</div>';

        const close = () => modal.classList.add('hidden');
        closeBtn.onclick = close;
        window.onclick = (e) => { if (e.target == modal) close(); };

        const renderFiles = async (files, currentPath) => {
            try {
                let html = '';
                if (currentPath) {
                    html += `<div class="file-item folder" data-path="${currentPath.split('/').slice(0, -1).join('/')}" data-type="dir">📁 .. (Up)</div>`;
                }

                files.sort((a, b) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1));

                files.forEach(f => {
                    const isDir = f.type === 'dir';
                    const icon = isDir ? '📁' : '📄';
                    html += `<div class="file-item ${isDir ? 'folder' : ''}" data-path="${f.path}" data-type="${f.type}">
                         <span>${icon} ${f.name}</span>
                         ${!isDir ? `<small>${(f.size / 1024).toFixed(1)} KB</small>` : ''}
                     </div>`;
                });
                browser.innerHTML = html;

                browser.querySelectorAll('.file-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const itemPath = item.dataset.path;
                        const itemType = item.dataset.type;
                        const gh = new GitHubService();

                        if (itemType === 'dir') {
                            browser.innerHTML = '<div class="loader">Loading...</div>';
                            try {
                                const subFiles = await gh.getFiles(itemPath);
                                renderFiles(subFiles, itemPath);
                            } catch (e) {
                                console.error(e);
                                browser.innerHTML = `<p class="error">Error loading folder: ${e.message}</p>`;
                            }
                        } else {
                            if (!itemPath.endsWith('.xlsx') && !itemPath.endsWith('.csv') && !itemPath.endsWith('.json')) {
                                if (!confirm("This file doesn't look like a supported data file. Try to load anyway?")) return;
                            }

                            browser.innerHTML = '<div class="loader">Downloading file...</div>';
                            try {
                                const fileContent = await gh.getFileContent(itemPath);
                                const blob = new Blob([JSON.stringify(fileContent)], { type: 'application/json' });
                                const file = new File([blob], itemPath.split('/').pop(), { type: 'application/json' });

                                close();
                                if (onFileSelect) onFileSelect(file, itemPath);

                            } catch (e) {
                                alert("Failed to download: " + e.message);
                                renderFiles(files, currentPath);
                            }
                        }
                    });
                });
            } catch (e) {
                console.error(e);
                browser.innerHTML = `<p class="error">Render Error: ${e.message}</p>`;
            }
        };

        (async () => {
            try {
                const gh = new GitHubService();
                let files = [];
                try {
                    files = await gh.getFiles(initialPath);
                } catch (e) {
                    if (initialPath === 'scans') {
                        console.warn("'scans' folder not found, falling back to root");
                        try {
                            files = await gh.getFiles('');
                        } catch (innerE) {
                            // If even root fails, then it's a connection/config error
                            throw innerE;
                        }
                    } else { throw e; }
                }

                if (!Array.isArray(files) || files.length === 0) {
                    if (initialPath === 'scans') {
                        const rootFiles = await gh.getFiles('');
                        if (rootFiles.length > 0) renderFiles(rootFiles, '');
                        else browser.innerHTML = '<p>No files found in repository.</p>';
                    } else {
                        browser.innerHTML = '<p>No files found in repository.</p>';
                    }
                    return;
                }
                renderFiles(files, initialPath);
            } catch (e) {
                console.error(e);
                browser.innerHTML = `<p class="error">Error: ${e.message} <br>Check Settings > Cloud Integration.</p>`;
            }
        })();
    },

    async handleMainCloudImport(type) {
        const modal = document.getElementById('cloudFileModal');
        const browser = document.getElementById('cloudBrowser');
        const closeBtn = document.querySelector('.close-modal');

        const onFileSelect = async (fileRec) => {
            try {
                if (fileRec.name.toLowerCase().endsWith('.json')) {
                    if (window.handleFilesGlobal) {
                        await window.handleFilesGlobal([fileRec], type, `Loaded from Cloud: ${fileRec.name}`);
                    } else {
                        console.error("Global file handler not found");
                        alert("Error: File handler not linked.");
                    }
                } else {
                    alert("Only JSON imports supported from Cloud for now.");
                }

            } catch (e) {
                console.error(e);
                alert("Import failed: " + e.message);
            }
        };

        this.renderCloudFileBrowser(modal, browser, closeBtn, onFileSelect, 'scans');
    },

    async handleFirebaseImport(type) {
        const cloudName = localStorage.getItem('active_cloud_provider') === 'aws' ? 'AWS DynamoDB' : 'Firebase';
        const cloudIcon = localStorage.getItem('active_cloud_provider') === 'aws' ? '☁️' : '🔥';

        if (!window.uiMyAlliance || !window.uiMyAlliance.rosterService || !window.uiMyAlliance.rosterService.connected) {
            alert(`Please configure your ${cloudName} Settings in the Settings Tab to sync live rosters.`);
            return;
        }

        try {
            const modal = document.getElementById('firebaseSyncModal');
            const checkboxesContainer = document.getElementById('firebaseKingdomCheckboxes');
            const dateContainer = document.getElementById('firebaseDateSelectContainer');
            const dateSelect = document.getElementById('firebaseDateSelect');
            const confirmBtn = document.getElementById('confirmFirebaseBtn');
            const cancelBtn = document.getElementById('cancelFirebaseBtn');
            const closeBtn = document.getElementById('closeFirebaseModal');
            const modalTitle = document.getElementById('firebaseModalTitle');

            if (!modal || !checkboxesContainer || !confirmBtn || !cancelBtn || !closeBtn) {
                alert("Cloud Sync modal elements not found in DOM.");
                return;
            }

            if (modalTitle) modalTitle.textContent = `Select ${cloudName} Workspace ${cloudIcon}`;

            modal.classList.remove('hidden');
            checkboxesContainer.innerHTML = '<div style="padding: 5px; color: var(--text-muted);">Loading Workspaces...</div>';
            if (dateContainer) dateContainer.classList.add('hidden');
            confirmBtn.disabled = true;

            const kingdoms = await window.uiMyAlliance.rosterService.getActiveKingdoms();
            checkboxesContainer.innerHTML = '';

            if (kingdoms.length === 0) {
                checkboxesContainer.innerHTML = '<div style="padding: 5px; color: var(--text-muted);">No Cloud Workspaces Found</div>';
            } else {
                kingdoms.forEach(k => {
                    const id = `cb_kd_${k}`;
                    checkboxesContainer.innerHTML += `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px;">
                            <input type="checkbox" id="${id}" value="${k}" class="firebase-kd-checkbox" style="cursor: pointer; width: 16px; height: 16px;">
                            <label for="${id}" style="cursor: pointer; user-select: none;">${k}</label>
                        </div>
                    `;
                });
            }

            // Cleanup function to remove event listeners and hide modal
            const cleanup = () => {
                modal.classList.add('hidden');
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                closeBtn.onclick = null;
            };

            cancelBtn.onclick = cleanup;
            closeBtn.onclick = cleanup;

            // Helper to get checked items
            const getSelectedKingdoms = () => {
                return Array.from(checkboxesContainer.querySelectorAll('.firebase-kd-checkbox:checked')).map(cb => cb.value);
            };

            // Listen for checkbox changes to fetch dates
            checkboxesContainer.addEventListener('change', async (e) => {
                if (e.target && e.target.classList.contains('firebase-kd-checkbox')) {
                    const selectedOptions = getSelectedKingdoms();
                    if (selectedOptions.length === 0) {
                        if (dateContainer) dateContainer.classList.add('hidden');
                        confirmBtn.disabled = true;
                        return;
                    }

                    // Use the FIRST selected kingdom to determine available dates (assuming they scan same dates)
                    const kId = selectedOptions[0];

                    if (dateContainer && dateSelect) {
                        dateContainer.classList.remove('hidden');
                        dateSelect.innerHTML = '<option value="">Loading Dates...</option>';
                        confirmBtn.disabled = true;

                        try {
                            const dates = await window.uiMyAlliance.rosterService.getAvailableScanDates(kId);

                            // Also inject a "Live Roster" fake date to grab the current `/rosters` node
                            dateSelect.innerHTML = '<option value="live">⚡ Live Tracking Rosters</option>';

                            if (dates.length > 0) {
                                dates.forEach(d => {
                                    dateSelect.innerHTML += `<option value="${d}">📅 Historical: ${d}</option>`;
                                });
                                // Auto-select the most recent historical scan
                                dateSelect.value = dates[0];
                            } else {
                                // Auto-select "live" so button activates
                                dateSelect.value = "live";
                            }
                            
                            confirmBtn.disabled = false;

                        } catch (err) {
                            console.error("Date fetch error:", err);
                            dateSelect.innerHTML = '<option value="">Error Loading Dates</option>';
                        }
                    } else {
                        // Fallback to old behavior if no date select exists in DOM
                        confirmBtn.disabled = false;
                    }
                }
            });

            confirmBtn.onclick = async () => {
                const targetKIds = getSelectedKingdoms();
                const targetDate = (dateSelect && dateSelect.value) ? dateSelect.value : "live";

                if (targetKIds.length === 0) return;

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Syncing...';

                try {
                    let combinedMappedData = [];
                    let successfulKingdoms = [];

                    for (const targetKId of targetKIds) {
                        let rawData = [];
                        if (targetDate === "live") {
                            rawData = await window.uiMyAlliance.rosterService.getKingdomDataOnce(targetKId);
                        } else {
                            rawData = await window.uiMyAlliance.rosterService.loadScanDetails(targetKId, targetDate);
                        }

                        // Normalize Cloud Response (AWS returns {data:[], headers}, Firebase returns [])
                        let actualDataArray = Array.isArray(rawData) ? rawData : (rawData.data || []);

                        if (!actualDataArray || actualDataArray.length === 0) {
                            console.warn(`No valid array data found in Cloud for Kingdom ${targetKId} on ${targetDate}`);
                            continue;
                        }

                        // For historical array blocks, they are already mapped if pushed by the new pushFullScan.
                        // For live rosters, we map them back to CSV keys.
                        let mappedData = [];
                        if (targetDate === "live") {
                            mappedData = actualDataArray.map(p => ({
                                'Governor ID': p.id,
                                'Governor Name': p.name,
                                'Alliance Tag': p.alliance,
                                'Power': p.power,
                                'Kill Points': p.killPoints,
                                'Deads': p.dead,
                                'T1 Kills': p.t1Kills,
                                'T2 Kills': p.t2Kills,
                                'T3 Kills': p.t3Kills,
                                'T4 Kills': p.t4Kills,
                                'T5 Kills': p.t5Kills,
                                'Resources Gathered': p.rssGathered,
                                'Assistance': p.rssAssistance,
                                'Troop Power': p.troopPower,
                                'Tech Power': p.techPower,
                                'Building Power': p.buildingPower,
                                'Commander Power': p.commanderPower,
                                '_kingdom': targetKId
                            }));
                        } else {
                            // It's a full JSON dump from pushFullScan
                            // Automatically inject _kingdom just in case it wasn't embedded
                            let headers = Array.isArray(rawData) ? null : rawData.headers;

                            mappedData = actualDataArray.map(p => {
                                if (headers && headers.length > 0) {
                                    let orderedP = {};
                                    // 1. Force the original column order
                                    headers.forEach(h => {
                                        if (p[h] !== undefined) orderedP[h] = p[h];
                                    });
                                    // 2. Add anything extra DynamoDB might have attached or calculated keys
                                    Object.keys(p).forEach(k => {
                                        if (orderedP[k] === undefined) orderedP[k] = p[k];
                                    });
                                    orderedP['_kingdom'] = targetKId;
                                    return orderedP;
                                } else {
                                    p['_kingdom'] = targetKId;
                                    return p;
                                }
                            });
                        }

                        combinedMappedData.push(...mappedData);
                        successfulKingdoms.push(targetKId);
                    }

                    if (combinedMappedData.length === 0) {
                        alert(`No data found in ${cloudName} for the selected Kingdom(s) on ${targetDate}`);
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Sync Data';
                        return;
                    }

                    // Bundle it into a virtual JSON upload
                    const content = JSON.stringify({
                        date: targetDate === "live" ? new Date().toISOString().split('T')[0] : targetDate,
                        kingdoms: successfulKingdoms,
                        data: combinedMappedData
                    });

                    const blob = new Blob([content], { type: 'application/json' });
                    const file = new File([blob], `Cloud_Sync_MultiKDs_${targetDate}.json`, { type: 'application/json' });

                    if (window.handleFilesGlobal) {
                        await window.handleFilesGlobal([file], type, `Synced from ${cloudName}: Kingdoms ${successfulKingdoms.join(', ')} (${targetDate})`);
                    } else {
                        alert("Error: Global file handler not linked.");
                    }

                    cleanup();
                } catch (err) {
                    console.error(`${cloudName} Sync Error:`, err);
                    alert("Error syncing data: " + err.message);
                }
            };

        } catch (e) {
            console.error('Cloud Import Error:', e);
            alert(`Failed to initialize ${cloudName} Sync: ` + e.message);
        }
    },

    async handleFirebaseExport(type) {
        const cloudName = localStorage.getItem('active_cloud_provider') === 'aws' ? 'AWS DynamoDB' : 'Firebase';

        if (!window.uiMyAlliance || !window.uiMyAlliance.rosterService || !window.uiMyAlliance.rosterService.connected) {
            alert(`Please configure your ${cloudName} Settings in the Settings Tab to sync to Cloud.`);
            return;
        }

        const dataState = this.data.state;
        let data = [];
        let date, label;

        if (type === 'start') {
            date = dataState.startScanDate;
            label = 'Start Scan';
            dataState.loadedKingdoms.forEach(kId => {
                if (dataState.kingdoms[kId] && dataState.kingdoms[kId].startData) {
                    data.push(...dataState.kingdoms[kId].startData);
                }
            });
        } else if (type === 'mid') {
            date = dataState.midScanDate;
            label = 'Mid/Healing Scan';
            dataState.loadedKingdoms.forEach(kId => {
                if (dataState.kingdoms[kId] && dataState.kingdoms[kId].midData) {
                    data.push(...dataState.kingdoms[kId].midData);
                }
            });
        } else {
            date = dataState.endScanDate;
            label = 'End Scan';
            dataState.loadedKingdoms.forEach(kId => {
                if (dataState.kingdoms[kId] && dataState.kingdoms[kId].endData) {
                    data.push(...dataState.kingdoms[kId].endData);
                }
            });
        }

        if (!data || data.length === 0) {
            alert(`No data loaded in the ${label} to push! Please select a file first.`);
            return;
        }

        if (!date) {
            alert(`Missing Date for ${label}. Please make sure your uploaded file indicates a date or the CSV metadata was parsed correctly.`);
            return;
        }

        // We need to group the data by Kingdom in case a user uploads a multi-kingdom CSV
        const kingdomGroups = {};
        data.forEach(p => {
            const kId = p['_kingdom'];
            if (!kId) return;
            if (!kingdomGroups[kId]) kingdomGroups[kId] = [];
            kingdomGroups[kId].push(p);
        });

        const kingdomsStr = Object.keys(kingdomGroups).join(", ");
        if (!confirm(`Are you sure you want to push ${data.length} governor profiles to ${cloudName} for Kingdom(s) ${kingdomsStr} on Date: ${date}?`)) {
            return;
        }

        try {
            const btn = document.querySelector(`.firebase-export-btn[data-type="${type}"]`);
            const originalText = btn ? btn.textContent : `Push to ${cloudName}`;
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Pushing... ⏳';
            }

            // Push each kingdom's slice array to the atomic cloud updater
            for (const [kId, records] of Object.entries(kingdomGroups)) {
                await window.uiMyAlliance.rosterService.pushFullScan(kId, date, records);
            }

            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Pushed Successfully! ✅';
                setTimeout(() => btn.textContent = originalText, 3000);
            }

            alert(`Cloud Sync Complete! Data is now safely archived in ${cloudName}.`);

        } catch (e) {
            console.error(e);
            alert("Failed to push data to Cloud: " + e.message);
            const btn = document.querySelector(`.firebase-export-btn[data-type="${type}"]`);
            if (btn) {
                btn.disabled = false;
                const cloudIcon = cloudName === 'AWS DynamoDB' ? '☁️' : '🔥';
                btn.textContent = `${cloudIcon} Push to ${cloudName}`;
            }
        }
    },

    async handleMainCloudSave(type) {
        try {
            const dataState = this.data.state;
            let data = [];
            let date, fileNamePrefix;

            if (type === 'start') {
                date = dataState.startScanDate;
                fileNamePrefix = 'start_scan';
                dataState.loadedKingdoms.forEach(kId => {
                    if (dataState.kingdoms[kId] && dataState.kingdoms[kId].startData) {
                        data.push(...dataState.kingdoms[kId].startData);
                    }
                });
            } else if (type === 'mid') {
                date = dataState.midScanDate;
                fileNamePrefix = 'mid_scan';
                dataState.loadedKingdoms.forEach(kId => {
                    if (dataState.kingdoms[kId] && dataState.kingdoms[kId].midData) {
                        data.push(...dataState.kingdoms[kId].midData);
                    }
                });
            } else {
                date = dataState.endScanDate;
                fileNamePrefix = 'end_scan';
                dataState.loadedKingdoms.forEach(kId => {
                    if (dataState.kingdoms[kId] && dataState.kingdoms[kId].endData) {
                        data.push(...dataState.kingdoms[kId].endData);
                    }
                });
            }

            if (!data || data.length === 0) {
                alert("No data loaded to save!");
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `scans/${fileNamePrefix}_${timestamp}.json`;
            const payload = {
                date: date || null,
                kingdoms: Object.keys(dataState.kingdoms),
                data: data
            };

            const gh = new GitHubService();
            await gh.uploadFile(fileName, payload, `Save ${type} scan via Unity App`);
            alert(`File saved to GitHub: ${fileName}`);
        } catch (e) {
            console.error(e);
            alert("Save failed: " + e.message);
        }
    }
});
