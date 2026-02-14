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

    async handleMainCloudSave(type) {
        try {
            const dataState = this.data.state;
            let data, date, fileNamePrefix;

            if (type === 'start') {
                data = dataState.startData;
                date = dataState.startScanDate;
                fileNamePrefix = 'start_scan';
            } else if (type === 'mid') {
                data = dataState.midData;
                date = dataState.midScanDate;
                fileNamePrefix = 'mid_scan';
            } else {
                data = dataState.endData;
                date = dataState.endScanDate;
                fileNamePrefix = 'end_scan';
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
