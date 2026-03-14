class UIActivityTracker {
    constructor() {
        this.containerId = 'activity-tracker';
        this.isInitialized = false;
        this.activeKingdoms = [];
    }

    init(data) {
        this.data = data; // the global state manager
        this.isInitialized = true;
        
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="header-actions">
                <h1>Activity & Inactivity Tracker</h1>
                <p>Analyze historical scans to find governors who have gone inactive or migrated away.</p>
            </div>
            
            <div class="control-panel">
                <div class="control-group">
                    <label>Target Kingdom:</label>
                    <select id="activity-kingdom-select">
                        <option value="">(Select a Kingdom)</option>
                    </select>
                </div>
                <div class="control-group" style="display: flex; gap: 12px; align-items: center; width: 100%;">
                    <button id="btn-run-activity" class="action-btn" style="flex: 1;">Run Analysis</button>
                    <button id="btn-export-activity" class="action-btn" style="display: none; flex: 1; background: var(--card-bg); border: 1px solid var(--border-hover);">Export Excel</button>
                </div>
            </div>

            <div id="activity-progress" class="status-message hidden" style="margin-top: 15px; color: var(--accent-primary);"></div>

            <div id="activity-results" class="table-container hidden" style="margin-top: 20px;">
                <table id="activity-table" class="data-table">
                    <thead>
                        <tr>
                            <th>Governor ID</th>
                            <th>Name</th>
                            <th>Last Seen Date</th>
                            <th>Last Known Power</th>
                            <th>Total Scans Present</th>
                            <th>Status Note</th>
                        </tr>
                    </thead>
                    <tbody id="activity-table-body">
                        <!-- Results injected here -->
                    </tbody>
                </table>
            </div>
        `;

        this.bindEvents();
        // Dropdown is populated externally via main.js once AWS connects
    }

    async populateDropdown() {
        const select = document.getElementById('activity-kingdom-select');
        if (!select) return;

        // Fetch active kingdoms from AWS
        if (window.awsRosterService) {
            try {
                const kingdoms = await window.awsRosterService.getActiveKingdoms();
                this.activeKingdoms = kingdoms;
                
                select.innerHTML = '<option value="">(Select a Kingdom)</option>';
                kingdoms.sort().forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.textContent = `Kingdom ${k}`;
                    select.appendChild(opt);
                });
            } catch (e) {
                console.error("Failed to load kingdoms for activity tracker", e);
            }
        }
    }

    bindEvents() {
        const btn = document.getElementById('btn-run-activity');
        if (btn) {
            btn.addEventListener('click', () => this.runAnalysis());
        }

        const btnExport = document.getElementById('btn-export-activity');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportExcel());
        }
    }

    async runAnalysis() {
        const kingdomId = document.getElementById('activity-kingdom-select').value;
        if (!kingdomId) {
            alert('Please select a Kingdom first.');
            return;
        }

        if (!window.awsRosterService) {
            alert('AWS Connection is required for historical analysis.');
            return;
        }

        const progressEl = document.getElementById('activity-progress');
        const resultsEl = document.getElementById('activity-results');
        const tbody = document.getElementById('activity-table-body');
        
        progressEl.classList.remove('hidden');
        resultsEl.classList.add('hidden');
        tbody.innerHTML = '';

        try {
            // 1. Fetch data
            progressEl.textContent = 'Fetching scan dates...';
            const { dates, scans } = await window.awsRosterService.getHistoricalKingdomScans(kingdomId, (msg) => {
                progressEl.textContent = msg;
            });

            if (!dates || dates.length === 0) {
                progressEl.textContent = `No historical scans found for Kingdom ${kingdomId}.`;
                return;
            }

            if (dates.length === 1) {
                progressEl.textContent = `Only 1 scan found for Kingdom ${kingdomId}. Historical comparison requires at least 2 scans.`;
                return;
            }

            progressEl.textContent = `Crunching data for ${dates.length} historical scans...`;

            // 2. Process data
            const mostRecentDate = dates[0]; // Assuming getAvailableScanDates sorts by descending
            const results = this.processActivity(dates, scans, mostRecentDate);

            // 3. Render
            const datesListHtml = `<div style="font-size: 0.85em; color: var(--text-secondary); opacity: 0.8; margin-top: 5px;">Scans Analyzed (${dates.length}): ${dates.join(', ')}</div>`;
            
            if (results.length === 0) {
                progressEl.innerHTML = `Analysis complete. All governors are present and showing active growth.${datesListHtml}`;
                document.getElementById('btn-export-activity').style.display = 'none';
                return;
            }

            progressEl.innerHTML = `Analysis complete. Found ${results.length} inactive or missing governors.${datesListHtml}`;
            resultsEl.classList.remove('hidden');
            document.getElementById('btn-export-activity').style.display = 'inline-block';
            this.lastResults = results;

            const thead = document.querySelector('#activity-table thead tr');
            thead.innerHTML = `
                <th>Governor ID</th>
                <th>Name</th>
                <th>Status Reason</th>
                <th>Notable Date</th>
                <th>Latest Power</th>
                <th>Troop Growth</th>
                <th>Cmdr / Gather Growth</th>
            `;

            // Sort natively by Latest Power descending as a fallback
            results.sort((a, b) => b.lastPower - a.lastPower);

            results.forEach(gov => {
                const tr = document.createElement('tr');
                tr.id = `gov-row-${gov.id}`; // Add ID for async updates
                const safeId = Utils.escapeHtml ? Utils.escapeHtml(gov.id) : gov.id;
                
                if (gov.reason === 'Zero Growth') {
                    tr.innerHTML = `
                        <td>${safeId}</td>
                        <td>${gov.name}</td>
                        <td><span style="color: #64748b; font-weight: 500;">Asleep</span></td>
                        <td><span style="opacity: 0.8;">${gov.statusNote}</span></td>
                        <td>${gov.lastPower.toLocaleString()}</td>
                        <td>
                            <div style="color: var(--text-secondary)">0</div>
                            <div style="font-size: 0.8em; opacity: 0.6; margin-top: 4px;">${gov.baselineDate}: ${gov.baselineTroopPower.toLocaleString()}</div>
                            <div style="font-size: 0.8em; opacity: 0.6;">${gov.lastSeen}: ${gov.lastTroopPower.toLocaleString()}</div>
                        </td>
                        <td>
                            <div style="color: var(--text-secondary)">C: 0 | G: 0</div>
                            <div style="font-size: 0.8em; opacity: 0.6; margin-top: 4px;">${gov.baselineDate} - C: ${gov.baselineCmdPower.toLocaleString()} | G: ${Utils.formatCompactNumber(gov.baselineGathered)}</div>
                            <div style="font-size: 0.8em; opacity: 0.6;">${gov.lastSeen} - C: ${gov.lastCmdPower.toLocaleString()} | G: ${Utils.formatCompactNumber(gov.lastGathered)}</div>
                        </td>
                    `;
                } else if (gov.reason === 'Low Activity') {
                    tr.innerHTML = `
                        <td>${safeId}</td>
                        <td>${gov.name}</td>
                        <td><span style="color: #f59e0b; font-weight: 500;">Low Activity</span></td>
                        <td><span style="opacity: 0.8;">${gov.statusNote}</span></td>
                        <td>${gov.lastPower.toLocaleString()}</td>
                        <td>
                            <div style="color: ${gov.troopDelta > 0 ? 'var(--accent-primary)' : (gov.troopDelta < 0 ? '#ef4444' : 'var(--text-secondary)')}">${gov.troopDelta.toLocaleString()}</div>
                            <div style="font-size: 0.8em; opacity: 0.6; margin-top: 4px;">${gov.baselineDate}: ${gov.baselineTroopPower.toLocaleString()}</div>
                            <div style="font-size: 0.8em; opacity: 0.6;">${gov.lastSeen}: ${gov.lastTroopPower.toLocaleString()}</div>
                        </td>
                        <td>
                            <div style="color: ${gov.cmdDelta > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'}">C: ${gov.cmdDelta.toLocaleString()} | G: ${Utils.formatCompactNumber(gov.gatherDelta)}</div>
                            <div style="font-size: 0.8em; opacity: 0.6; margin-top: 4px;">${gov.baselineDate} - C: ${gov.baselineCmdPower.toLocaleString()} | G: ${Utils.formatCompactNumber(gov.baselineGathered)}</div>
                            <div style="font-size: 0.8em; opacity: 0.6;">${gov.lastSeen} - C: ${gov.lastCmdPower.toLocaleString()} | G: ${Utils.formatCompactNumber(gov.lastGathered)}</div>
                        </td>
                    `;
                } else if (gov.reason === 'New') {
                    tr.innerHTML = `
                        <td>${safeId}</td>
                        <td>${gov.name}</td>
                        <td><span style="color: #10b981; font-weight: 500;">New</span></td>
                        <td id="gov-note-${safeId}"><span style="opacity: 0.8;">${gov.statusNote}<br><span style="font-size:0.8em; color:var(--accent-primary)">Searching global timeline...</span></span></td>
                        <td>${gov.lastPower.toLocaleString()}</td>
                        <td>-</td>
                        <td>-</td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td>${safeId}</td>
                        <td>${gov.name}</td>
                        <td><span style="color: #ef4444; font-weight: 500;">Missing</span></td>
                        <td id="gov-note-${safeId}"><span style="opacity: 0.8;">${gov.statusNote}<br><span style="font-size:0.8em; color:var(--accent-primary)">Searching global timeline...</span></span></td>
                        <td>${gov.lastPower.toLocaleString()}</td>
                        <td>-</td>
                        <td>-</td>
                    `;
                }
                tbody.appendChild(tr);

                // Async cross-kingdom lookup for Missing or New players
                if (gov.reason === 'Missing' || gov.reason === 'New') {
                    window.awsRosterService.getGovernorTimeline(gov.id).then(data => {
                        const noteCell = document.getElementById(`gov-note-${safeId}`);
                        if (!noteCell) return;
                        
                        if (!data || !data.history) {
                            noteCell.innerHTML = `<span style="opacity: 0.8;">${gov.statusNote}</span>`;
                            return;
                        }
                        
                        // Sort history to find exactly where they came from or went
                        const historyEntries = Object.entries(data.history).sort((a, b) => {
                            const dateA = a[0].includes('_') ? a[0].split('_')[1] : a[0];
                            const dateB = b[0].includes('_') ? b[0].split('_')[1] : b[0];
                            return new Date(dateA) - new Date(dateB);
                        });

                        if (historyEntries.length === 0) {
                            noteCell.innerHTML = `<span style="opacity: 0.8;">${gov.statusNote}</span>`;
                            return;
                        }

                        // Global Name Extraction
                        const allNames = new Set(gov.historicalNamesArr || []);
                        historyEntries.forEach(e => {
                            const n = e[1]['Governor Name'] || e[1]['Name'] || e[1]['name'];
                            if (n && n !== 'Unknown' && n !== gov.name) {
                                allNames.add(n);
                            }
                        });
                        
                        let akaString = '';
                        if (allNames.size > 0) {
                            akaString = `<br><span style="font-size: 0.85em; opacity: 0.7; color: var(--accent-hover);">AKA: ${Array.from(allNames).join(', ')}</span>`;
                        }
                        
                        let migrationNote = '';

                        if (gov.reason === 'Missing') {
                            // Find the LAST known location anywhere in the world
                            const lastEntry = historyEntries[historyEntries.length - 1];
                            const parts = lastEntry[0].split('_');
                            const globalKid = parts[0].match(/\d+/) ? parts[0].match(/\d+/)[0] : parts[0];
                            const localKidNum = kingdomId.match(/\d+/) ? kingdomId.match(/\d+/)[0] : kingdomId;
                            const globalDate = parts.slice(1).join('_');
                            
                            // If their global last seen is NEWER than when they went missing here, AND it's a different kingdom, they migrated!
                            if (globalDate > gov.lastSeen && globalKid !== localKidNum) {
                                migrationNote = `<br><span style="font-size: 0.85em; color: var(--warning-color); font-weight: 600;">Migrated to KD ${globalKid}</span>`;
                            }
                            gov.statusNote = gov.baseNote + akaString + migrationNote;
                            noteCell.innerHTML = `<span style="opacity: 0.8;">${gov.baseNote}</span>${akaString}${migrationNote}`;
                            
                        } else if (gov.reason === 'New') {
                            // Find the chronologically FIRST scan before they appeared here
                            let originKid = null;
                            const localKidNum = kingdomId.match(/\d+/) ? kingdomId.match(/\d+/)[0] : kingdomId;
                            
                            for (let i = historyEntries.length - 1; i >= 0; i--) {
                                const parts = historyEntries[i][0].split('_');
                                const k = parts[0].match(/\d+/) ? parts[0].match(/\d+/)[0] : parts[0];
                                const d = parts.slice(1).join('_');
                                if (d < gov.firstSeen && k !== localKidNum) {
                                    originKid = k;
                                    break;
                                }
                            }
                            
                            if (originKid) {
                                migrationNote = `<br><span style="font-size: 0.85em; color: var(--success-color); font-weight: 600;">Migrated from KD ${originKid}</span>`;
                            }
                            gov.statusNote = gov.baseNote + akaString + migrationNote;
                            noteCell.innerHTML = `<span style="opacity: 0.8;">${gov.baseNote}</span>${akaString}${migrationNote}`;
                        }
                    }).catch(err => {
                        const noteCell = document.getElementById(`gov-note-${safeId}`);
                        if (noteCell) noteCell.innerHTML = `<span style="opacity: 0.8;">${gov.statusNote}</span>`;
                    });
                }
            });

            // Re-init DataTable if we use DataTables.js globally
            if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
                if ($.fn.DataTable.isDataTable('#activity-table')) {
                    $('#activity-table').DataTable().destroy();
                }
                $('#activity-table').DataTable({
                    pageLength: 50,
                    order: [[4, 'desc']] // Sort by last known power descending (index 4)
                });
            }

        } catch (e) {
            console.error(e);
            progressEl.textContent = `Error during analysis: ${e.message}`;
        }
    }

    processActivity(dates, scans, mostRecentDate) {
        const govTracker = new Map();

        // Loop through all dates, from oldest to newest (to correctly track latest power/name)
        // dates array is descending, so we reverse for processing
        const ascendingDates = [...dates].reverse();

        ascendingDates.forEach(date => {
            const scanData = scans[date];
            if (!scanData) return;

            let loggedSample = false;
            scanData.forEach(player => {
                if (!loggedSample) {
                    loggedSample = true;
                }
                const id = player['Governor ID'] || player['ID'] || player['id'];
                const name = player['Governor Name'] || player['Name'] || player['name'] || "Unknown";
                
                // Use robust Utils.parseNumber to prevent NaN from poisoning the calculation
                const power = Utils.parseNumber(player['Power']);
                const troopPower = Utils.parseNumber(player['Troop Power']);
                const cmdPower = Utils.parseNumber(player['Commander Power']);
                const gathered = Utils.parseNumber(player['Resources Gathered']);
                
                if (!id) return;

                if (!govTracker.has(id)) {
                    govTracker.set(id, {
                        id: id,
                        name: name,
                        historicalNames: new Set([name]),
                        firstSeen: date,
                        lastSeen: date,
                        lastPower: power,
                        
                        lastTroopPower: troopPower,
                        lastCmdPower: cmdPower,
                        lastGathered: gathered,
                        
                        // Baselines for growth tracking
                        baselineDate: date,
                        baselineTroopPower: troopPower,
                        baselineCmdPower: cmdPower,
                        baselineGathered: gathered,
                        
                        // Deltas since baseline
                        troopDelta: 0,
                        cmdDelta: 0,
                        gatherDelta: 0,

                        scansPresent: 1,
                        seenDates: new Set([date])
                    });
                } else {
                    const rec = govTracker.get(id);
                    rec.historicalNames.add(name);
                    rec.name = name; // Update to latest known name
                    rec.lastSeen = date;
                    rec.lastPower = power;
                    
                    rec.lastTroopPower = troopPower;
                    rec.lastCmdPower = cmdPower;
                    rec.lastGathered = gathered;
                    
                    rec.scansPresent++;
                    rec.seenDates.add(date);

                    // Check growth against baseline
                    const tDelta = troopPower - rec.baselineTroopPower;
                    const cDelta = cmdPower - rec.baselineCmdPower;
                    const gDelta = gathered - rec.baselineGathered;

                    // Did they change significantly since their baseline?
                    // Use Math.abs for troops/cmdrs since getting zeroed/attacked implies kingdom activity
                    if (Math.abs(tDelta) > 10000 || Math.abs(cDelta) > 10000 || gDelta > 1000000) {
                        // Yes! They are active up to this scan. Reset baseline to NOW.
                        rec.baselineDate = date;
                        rec.baselineTroopPower = troopPower;
                        rec.baselineCmdPower = cmdPower;
                        rec.baselineGathered = gathered;
                        rec.troopDelta = 0;
                        rec.cmdDelta = 0;
                        rec.gatherDelta = 0;
                    } else {
                        // Not significant growth. They are "asleep" relative to their baseline.
                        rec.troopDelta = tDelta;
                        rec.cmdDelta = cDelta;
                        rec.gatherDelta = gDelta;
                    }
                }
            });
        });

        const results = [];
        govTracker.forEach(rec => {
            // Build local AKA string
            let localAka = '';
            rec.historicalNames.delete(rec.name); // Remove latest name from AKA list
            rec.historicalNamesArr = Array.from(rec.historicalNames);
            if (rec.historicalNamesArr.length > 0) {
                localAka = `<br><span style="font-size: 0.85em; opacity: 0.7; color: var(--accent-hover);">AKA: ${rec.historicalNamesArr.join(', ')}</span>`;
            }

            // Parse dates to calculate exact hours alive in the kingdom
            const firstDate = new Date(rec.firstSeen.replace('_', ' '));
            const lastDate = new Date(rec.lastSeen.replace('_', ' '));
            const hoursAlive = (lastDate - firstDate) / (1000 * 60 * 60);

            // Check 1: Missing Players
            if (rec.lastSeen !== mostRecentDate) {
                rec.reason = 'Missing';
                rec.baseNote = `Last seen ${rec.lastSeen}`;
                rec.statusNote = rec.baseNote + localAka;
                results.push(rec);
            } 
            // Check 2: New Players (Less than 96 hours old in this KD)
            else if (rec.lastSeen === mostRecentDate && hoursAlive <= 96) {
                rec.reason = 'New';
                rec.baseNote = `Joined ${rec.firstSeen}`;
                rec.statusNote = rec.baseNote + localAka;
                results.push(rec);
            }
            // Check 3: True Inactivity (Zero Growth or Low Activity)
            else if (rec.lastSeen === mostRecentDate && hoursAlive > 96) {
                // If their baseline date is older than the most recent scan, they have slept through at least 1 scan interval
                if (rec.baselineDate !== mostRecentDate) {
                    if (rec.troopDelta === 0 && rec.cmdDelta === 0 && rec.gatherDelta === 0) {
                        rec.reason = 'Zero Growth';
                        rec.baseNote = `Asleep since ${rec.baselineDate}`;
                        rec.statusNote = rec.baseNote + localAka;
                        results.push(rec);
                    } else {
                        rec.reason = 'Low Activity';
                        rec.baseNote = `Minimal gains since ${rec.baselineDate}`;
                        rec.statusNote = rec.baseNote + localAka;
                        results.push(rec);
                    }
                }
            }
        });

        // Sort by power descending
        results.sort((a, b) => b.lastPower - a.lastPower);
        return results;
    }

    exportExcel() {
        if (!this.lastResults || this.lastResults.length === 0) {
            alert("No results to export. Run analysis first.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert("Excel library is not loaded. Please ensure you are connected to the internet.");
            return;
        }

        const kingdomId = document.getElementById('activity-kingdom-select').value;
        const headers = [
            'Governor ID', 'Name', 'Status Reason', 'Status Note', 
            'Latest Power', 'Baseline Troop Power', 'Latest Troop Power', 'Troop Growth',
            'Baseline Cmdr Power', 'Latest Cmdr Power', 'Cmdr Growth',
            'Baseline Gathered', 'Latest Gathered', 'Gather Growth'
        ];
        
        const rows = this.lastResults.map(gov => {
            // Remove HTML from status notes using regex
            const cleanNote = gov.statusNote ? gov.statusNote.replace(/<[^>]*>?/gm, ' - ') : '';

            // Return numbers as actual Numbers so Excel formats them correctly
            return [
                parseInt(gov.id),
                gov.name,
                gov.reason,
                cleanNote,
                parseInt(gov.lastPower || 0),
                parseInt(gov.baselineTroopPower || 0),
                parseInt(gov.lastTroopPower || 0),
                parseInt(gov.troopDelta || 0),
                parseInt(gov.baselineCmdPower || 0),
                parseInt(gov.lastCmdPower || 0),
                parseInt(gov.cmdDelta || 0),
                parseInt(gov.baselineGathered || 0),
                parseInt(gov.lastGathered || 0),
                parseInt(gov.gatherDelta || 0)
            ];
        });

        const worksheetData = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Auto-size columns slightly
        worksheet['!cols'] = [
            {wch: 12}, // ID
            {wch: 20}, // Name
            {wch: 15}, // Reason
            {wch: 35}, // Note
            {wch: 15}, // Power
            {wch: 15}, {wch: 15}, {wch: 15}, // Troops
            {wch: 15}, {wch: 15}, {wch: 15}, // Cmdr
            {wch: 15}, {wch: 15}, {wch: 15}  // Gather
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inactivity Report");
        XLSX.writeFile(workbook, `activity_tracker_kd${kingdomId}.xlsx`);
    }
}

// Make it globally available like the other controllers
window.uiActivityTracker = new UIActivityTracker();
