// ==========================================
// SOC TIMELINE DATA
// ==========================================
const SOC_PHASES = [
    { name: "Registration Phase", duration: 72, type: "pre-kvk" },
    { name: "Team Up Phase", duration: 24, type: "pre-kvk" },
    { name: "Matchmaking Phase", duration: 120, type: "pre-kvk" },
    { name: "Preparation Phase", duration: 48, type: "pre-kvk" },
    { name: "First Steps", duration: 3, type: "chronicle", events: [{ name: "Crusader Camp Opens", delay: 12, type: "minor-event" }] },
    { name: "Eye for an Eye", duration: 48, type: "chronicle", events: [{ name: "Crusader Fortress Opens", delay: 12, type: "minor-event" }] },
    { name: "Turf Wars", duration: 24, type: "chronicle" },
    { name: "Hand in Hand", duration: 48, type: "chronicle", events: [{ name: "Ancient Ruins Opens", delay: 12, type: "minor-event" }] },
    { name: "Retribution", duration: 24, type: "chronicle" },
    { name: "Revenge", duration: 48, type: "chronicle", events: [{ name: "PASS 4 OPENING 🚧", delay: 12, type: "major-event-red" }] },
    { name: "Storm Clouds", duration: 24, type: "chronicle", reward: "Coalition Recruiter" },
    { name: "Wolves and Lambs", duration: 24, type: "chronicle", events: [{ name: "Hierons Opens", delay: 12, type: "minor-event" }] },
    { name: "Pilgrimage", duration: 48, type: "chronicle", events: [{ name: "PASS 5 OPENING 🚧", delay: 12, type: "major-event-red" }] },
    { name: "Pushing Forward", duration: 24, type: "chronicle", events: [{ name: "Sanctuaries Opens", delay: 12, type: "minor-event" }] },
    { name: "Seize the Sanctuaries", duration: 24, type: "chronicle", events: [{ name: "PASS 6 OPENING 🚧", delay: 12, type: "major-event-red" }] },
    { name: "Access Granted", duration: 48, type: "chronicle", events: [{ name: "Altar of Darkness Opens", delay: 12, type: "minor-event" }] },
    { name: "Sacrificial Offering", duration: 24, type: "chronicle" },
    { name: "Strife and Conflict", duration: 48, type: "chronicle" },
    { name: "Hall of Unity", duration: 48, type: "chronicle" },
    { name: "Siege the Land (Pass 7 Opens)", duration: 24, type: "chronicle", events: [{ name: "PASS 7 OPENING 🚧", delay: 0, type: "major-event-gold" }] },
    { name: "Arrows Nocked", duration: 24, type: "chronicle" },
    { name: "Proven in Battle", duration: 48, type: "chronicle" },
    { name: "Drums of War", duration: 48, type: "chronicle", events: [{ name: "Circle Opens", delay: 12, type: "minor-event" }] },
    { name: "Indomitable Contender", duration: 72, type: "chronicle" },
    { name: "Brink of Annihilation", duration: 72, type: "chronicle", events: [{ name: "PASS 8 (KINGSLAND) OPENS 👑", delay: 12, type: "major-event-gold" }] },
    { name: "Clarity in Hindsight", duration: 72, type: "chronicle", events: [{ name: "Pass 9 & 7 Re-Open", delay: 12, type: "major-event-red" }] },
    { name: "The Final Door", duration: 24, type: "chronicle", reward: "Pass 9" },
    { name: "Face Off", duration: 48, type: "chronicle", reward: "The Great Ziggurat" },
    { name: "In My Name", duration: 24, type: "chronicle" },
    { name: "Suppression", duration: 72, type: "chronicle" },
    { name: "The Way Ahead", duration: 72, type: "chronicle" },
    { name: "Ebullient", duration: 72, type: "chronicle" }
];

Object.assign(UIService.prototype, {
    initSOC() {
        // Setup SOC Side Nav
        const sidebar = document.querySelector('.soc-sidebar');
        if (sidebar) {
            sidebar.addEventListener('click', (e) => {
                const btn = e.target.closest('.soc-nav-btn');
                if (btn) {
                    sidebar.querySelectorAll('.soc-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.switchSOCSubTab(btn.dataset.subtab);
                }
            });
        }

        // Timeline Date Input Listener
        const startDateInput = document.getElementById('socStartDateInput');
        const generateTimelineBtn = document.getElementById('generateTimelineBtn');

        if (startDateInput) {
            // Keep change listener for convenience
            startDateInput.addEventListener('change', (e) => {
                if (e.target.value) this.renderTimeline(e.target.value);
            });
        }

        if (generateTimelineBtn) {
            generateTimelineBtn.addEventListener('click', () => {
                const dateVal = document.getElementById('socStartDateInput').value;
                if (dateVal) {
                    this.renderTimeline(dateVal);
                } else {
                    alert("Please select a Season Start Date first! 📅");
                }
            });
        }

        document.querySelectorAll('.cloud-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling to upload zone click

                const type = btn.dataset.type;
                if (!type) return;

                if (type.startsWith('soc')) {
                    this.handleSOCCloudImport(type);
                } else {
                    this.handleMainCloudImport(type);
                }
            });
        });

        // Setup Zone Uploads
        // Note: Zones are already initialized in main.js via setupUpload(), so we don't need to add duplicate listeners here.
        // We can keep specific specific SOC UI logic here if needed in the future.

        const calcBtn = document.getElementById('calcStratagemsBtn');
        if (calcBtn) calcBtn.addEventListener('click', () => this.calculateStratagemsStats());

        // Restore State from Memory
        const socState = this.data.state.soc?.stratagems;
        if (socState) {
            Object.keys(socState).forEach(key => {
                const data = socState[key];
                if (data && data.length > 0) {
                    const zone = document.getElementById(`${key}Zone`);
                    if (zone) {
                        zone.classList.add('loaded');
                        const status = document.getElementById(`${key}Status`);
                        if (status) status.innerHTML = `✅ Loaded<br><small>(${data.length} records)</small>`;
                    }
                }
            });
            // Auto-calculate if data exists
            this.calculateStratagemsStats();
        }
    },

    renderTimeline(startDateStr) {
        const container = document.getElementById('socTimelineList');
        if (!container) return;

        if (!startDateStr) {
            container.innerHTML = '<p class="text-muted">Please select a Start Date.</p>';
            return;
        }

        let currentDate = new Date(startDateStr);
        let html = '';
        const format = (d) => d.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        SOC_PHASES.forEach(phase => {
            const phaseStart = new Date(currentDate);
            // Calculate End Date: Start + Duration (hours)
            const phaseEnd = new Date(currentDate.getTime() + (phase.duration * 60 * 60 * 1000));

            // 1. Render Phase Card
            html += `
                <div class="timeline-item ${phase.type}">
                    <div class="timeline-time">
                        <div class="time-start">${format(phaseStart)}</div>
                        <div class="time-duration">${phase.duration}h</div>
                    </div>
                    <div class="timeline-content">
                        <h4>${phase.name}</h4>
                        ${phase.reward ? `<div class="timeline-reward">🏆 ${phase.reward}</div>` : ''}
                        ${phase.note ? `<div class="timeline-note">📝 ${phase.note}</div>` : ''}
                    </div>
                </div>
            `;

            // 2. Render Events (if any)
            if (phase.events) {
                phase.events.forEach(evt => {
                    const eventTime = new Date(phaseEnd.getTime() + (evt.delay * 60 * 60 * 1000));
                    html += `
                        <div class="timeline-item event-item ${evt.type}">
                            <div class="timeline-time">
                                <div class="time-event">${format(eventTime)}</div>
                            </div>
                            <div class="timeline-content event-card">
                                <h4>${evt.name}</h4>
                                <div class="event-tag">${evt.delay > 0 ? `+${evt.delay}h after phase` : 'Starts immediately'}</div>
                            </div>
                        </div>
                    `;
                });
            }

            // Update current date for next phase
            currentDate = phaseEnd;
        });

        container.innerHTML = html;
    },

    switchSOCSubTab(subtabId) {
        // 1. Sidebar Buttons - Visual "active" class
        const sidebar = document.querySelector('.soc-sidebar');
        if (sidebar) {
            sidebar.querySelectorAll('.soc-nav-btn').forEach(btn => {
                if (btn.dataset.subtab === subtabId) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        // 2. Content Sections - Force Visibility via Inline Style
        document.querySelectorAll('.soc-section').forEach(el => {
            el.style.display = 'none'; // Hide all first
        });

        const target = document.getElementById(`${subtabId}-ui`);
        if (target) {
            target.style.display = 'block'; // Force Show
        }
    },

    async handleSOCUpload(file, type) {
        if (!file) return;
        try {
            let result;
            result = await this.data.parseFile(file);

            // Store in specific SOC state
            if (!this.data.state.soc) this.data.state.soc = { stratagems: {} };
            if (!this.data.state.soc.stratagems) this.data.state.soc.stratagems = {};

            // Extract relevant data
            this.data.state.soc.stratagems[type] = result.data;

            // Update UI
            const zone = document.getElementById(`${type}Zone`);
            const status = document.getElementById(`${type}Status`);
            if (zone) zone.classList.add('loaded');
            if (status) status.textContent = `Loaded (${result.data.length} records)`;

            this.data.saveState();

        } catch (e) {
            console.error(e);
            alert("Error parsing file: " + e.message);
        }
    },

    async handleSOCCloudImport(type) {
        const modal = document.getElementById('cloudFileModal');
        const browser = document.getElementById('cloudBrowser');
        const closeBtn = document.querySelector('.close-modal');

        const onFileSelect = async (file, itemPath) => {
            // This is the callback when a file is selected from the cloud browser
            // SOC Import
            await this.handleSOCUpload(file, type);
        };

        // Use the global/exported renderCloudFileBrowser if accessible, or assume it's on this service?
        // UIExports.js assigns renderCloudFileBrowser to UIService.prototype.
        if (this.renderCloudFileBrowser) {
            this.renderCloudFileBrowser(modal, browser, closeBtn, onFileSelect, ''); // Start from root for SOC
        } else {
            console.error("Cloud Browser not available");
        }
    },

    calculateStratagemsStats() {
        const soc = this.data.state.soc?.stratagems;
        if (!soc) return;

        const summaryContainer = document.getElementById('socSummaryTable');
        const detailContainer = document.getElementById('socDetailTable');
        if (!summaryContainer || !detailContainer) return;

        // Get Data Arrays
        const start = soc.socStart || [];
        const pass4 = soc.socPass4 || [];
        const pass5 = soc.socPass5 || [];
        const pass6 = soc.socPass6 || [];
        const pass7 = soc.socPass7 || [];
        const pass8 = soc.socPass8 || [];
        const end = soc.socEnd || [];

        // Identify all unique IDs based on Union
        const allIds = new Set([
            ...start.map(r => r['Governor ID']),
            ...pass4.map(r => r['Governor ID']),
            ...pass5.map(r => r['Governor ID']),
            ...pass6.map(r => r['Governor ID']),
            ...pass7.map(r => r['Governor ID']),
            ...pass8.map(r => r['Governor ID']),
            ...end.map(r => r['Governor ID'])
        ]);

        const governorData = [];
        const kingdomStats = {}; // { kId: { z4: 0, z5: 0... } }

        // Helper to get KP
        const getKP = (arr, id) => {
            const r = arr.find(x => x['Governor ID'] === id);
            return r ? Utils.parseNumber(r['Kill Points']) : 0;
        };
        const getRow = (arr, id) => arr.find(x => x['Governor ID'] === id) || {};

        allIds.forEach(id => {
            const snapshots = [end, pass8, pass7, pass6, pass5, pass4, start];

            // 1. Name Resolution: Check all snapshots for a valid name
            let name = 'Unknown';
            for (const snap of snapshots) {
                const r = getRow(snap, id);
                if (r) {
                    name = r['Governor Name'] || r['Name'] || r['name'] || r['Governor'] || name;
                    if (name !== 'Unknown') break;
                }
            }
            // Kingdom Resolution: Search all snapshots for a valid kingdom
            const getKID = (r) => (r && (r['_kingdom'] || r['Kingdom'] || r['kingdom'])) || null;
            let kId = 'Unknown';

            // Check snapshots in reverse order (End -> Start)
            for (const snap of snapshots) {
                const r = getRow(snap, id);
                const k = getKID(r);
                if (k && k !== 'Unknown' && k !== 'Unknown Kingdom' && k !== 'Sheet1') {
                    kId = k;
                    break;
                }
            }

            // KP Snapshots (Gap Filling)
            const kpStart = getKP(start, id);
            const kp4 = getKP(pass4, id) || kpStart;
            const kp5 = getKP(pass5, id) || kp4;
            const kp6 = getKP(pass6, id) || kp5;
            const kp7 = getKP(pass7, id) || kp6;
            const kp8 = getKP(pass8, id) || kp7;
            const kpEnd = getKP(end, id) || kp8;

            // Revised Logic (User Req: Zone 4 = Start -> Pass 4 Open)
            const z4 = Math.max(0, kp4 - kpStart);     // Zone 4
            const z5 = Math.max(0, kp5 - kp4);         // Zone 5
            const z6 = Math.max(0, kp6 - kp5);         // Zone 6
            const z7 = Math.max(0, kp7 - kp6);         // Zone 7
            const z8 = Math.max(0, kp8 - kp7);         // Kingsland (P8 Open - P7 Open)
            const finals = Math.max(0, kpEnd - kp8);   // Final Push (End - P8 Open)

            const total = z4 + z5 + z6 + z7 + z8 + finals;

            governorData.push({ id, name, kingdom: kId, z4, z5, z6, z7, z8, finals, total });

            // Aggregate Kingdom Stats
            if (!kingdomStats[kId]) kingdomStats[kId] = { name: kId, count: 0, z4: 0, z5: 0, z6: 0, z7: 0, z8: 0, finals: 0, total: 0 };
            kingdomStats[kId].count++;
            kingdomStats[kId].z4 += z4;
            kingdomStats[kId].z5 += z5;
            kingdomStats[kId].z6 += z6;
            kingdomStats[kId].z7 += z7;
            kingdomStats[kId].z8 += z8;
            kingdomStats[kId].finals += finals;
            kingdomStats[kId].total += total;
        });

        // --- 3. Render Summary Table ---
        const summaryHtml = `
                <h3>Kingdom Summary</h3>
                    <table class="zone-table">
                        <thead>
                            <tr>
                                <th>Kingdom</th>
                                <th>Governors</th>
                                <th>Zone 4 DKP</th>
                                <th>Zone 5 DKP</th>
                                <th>Zone 6 DKP</th>
                                <th>Zone 7 DKP</th>
                                <th>Zone 8 (KL) DKP</th>
                                <th>Finals DKP</th>
                                <th>Total DKP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.values(kingdomStats).sort((a, b) => b.total - a.total).map(k => `
                            <tr>
                                <td><strong>${k.name}</strong></td>
                                <td>${k.count}</td>
                                <td>${CalculationService.formatNumber(k.z4)}</td>
                                <td>${CalculationService.formatNumber(k.z5)}</td>
                                <td>${CalculationService.formatNumber(k.z6)}</td>
                                <td>${CalculationService.formatNumber(k.z7)}</td>
                                <td>${CalculationService.formatNumber(k.z8)}</td>
                                <td>${CalculationService.formatNumber(k.finals)}</td>
                                <td><strong>${CalculationService.formatNumber(k.total)}</strong></td>
                            </tr>
                        `).join('')}
                        </tbody>
                    </table>
            `;
        summaryContainer.innerHTML = summaryHtml;

        // --- 4. Render Detail Table ---
        let players = Object.values(governorData).sort((a, b) => b.total - a.total);

        // Apply Filter
        const limitStr = document.getElementById('socFilterSelect')?.value || 'all';
        if (limitStr !== 'all') {
            const limit = parseInt(limitStr.replace('top', ''));
            if (!isNaN(limit)) players = players.slice(0, limit);
        }

        const detailHtml = `
                <h3>All Governors</h3>
                    <table class="zone-table">
                        <thead>
                            <tr>
                                <th>Governor</th>
                                <th>Kingdom</th>
                                <th>Zone 4</th>
                                <th>Zone 5</th>
                                <th>Zone 6</th>
                                <th>Zone 7</th>
                                <th>Zone 8 (KL)</th>
                                <th>Finals</th>
                                <th>Total DKP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map(p => `
                            <tr>
                                <td>${p.name} <small>(${p.id})</small></td>
                                <td>${p.kingdom}</td>
                                <td class="${p.z4 > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.z4)}</td>
                                <td class="${p.z5 > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.z5)}</td>
                                <td class="${p.z6 > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.z6)}</td>
                                <td class="${p.z7 > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.z7)}</td>
                                <td class="${p.z8 > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.z8)}</td>
                                <td class="${p.finals > 0 ? 'zone-gain' : ''}">${CalculationService.formatNumber(p.finals)}</td>
                                <td><strong>${CalculationService.formatNumber(p.total)}</strong></td>
                            </tr>
                        `).join('')}
                        </tbody>
                    </table>
            `;
        detailContainer.innerHTML = detailHtml;

        // Switch to summary by default - check if we are already seeing details?
        // Just trigger visual update if needed, but maybe not click blindly.
        // The original code clicked it.
        const summaryBtn = document.getElementById('btnSocSummary');
        if (summaryBtn && !summaryBtn.classList.contains('active')) summaryBtn.click();
    }
});
