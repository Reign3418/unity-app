
// ==========================================
// UI GROWTH SERVICE
// Handles Growth Analysis, Scoring, and Grading
// ==========================================

class UIGrowth {
    constructor(dataService) {
        this.data = dataService;
        this.currentFilter = null; // Track active grade filter
        this.searchTerm = ''; // Track active search term
        this.allianceFilter = ''; // Track active alliance filter
        this.sortConfig = { key: 'finalScore', dir: 'desc' }; // Default sort
    }

    // Main entry point for rendering the tab
    renderGrowthTab(kingdomId) {
        const kState = this.data.state.kingdoms[kingdomId];
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;

        // Render Date Range
        const startDate = this.data.state.startScanDate ? new Date(this.data.state.startScanDate) : null;
        const endDate = this.data.state.endScanDate ? new Date(this.data.state.endScanDate) : null;
        this.renderDateRange(container, startDate, endDate);

        // Store formatted date range for report
        const fmt = (d) => d ? d.toLocaleDateString() : 'N/A';
        this.reportDateRange = `(${fmt(startDate)} - ${fmt(endDate)})`;

        if (!kState || !kState.currentOverviewData) {
            const tbody = container.querySelector('.growth-table tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No data available. Please upload Start and End scans.</td></tr>';
            return;
        }

        // Calculate Scores
        const growthData = this.calculateGrowthScores(kState.startData, kState.endData);
        this.currentGrowthData = growthData; // Store for filtering

        // Render Search Control (Now safe to call)
        this.renderSearchControl(container, kingdomId);

        // Render Leaderboard Summary
        this.renderSummary(kingdomId, growthData);

        // Render Detailed Table (Initial render with no filter)
        this.applyFilters(kingdomId);
    }

    renderSearchControl(container, kingdomId) {
        let searchContainer = container.querySelector('.growth-search-container');

        // Extract Alliances for Dropdown (Safe check)
        const alliances = this.currentGrowthData ? [...new Set(this.currentGrowthData.map(p => p.alliance))].sort() : [];

        // If container doesn't exist, create it
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.className = 'growth-search-container';

            // Insert before the summary grid
            const grid = container.querySelector('.growth-summary-grid');
            if (grid) grid.before(searchContainer);
            else {
                const dateInfo = container.querySelector('.growth-date-info');
                if (dateInfo) dateInfo.after(searchContainer);
            }
        }

        // Always update innerHTML to ensure dropdown options are current or added if missing
        const existingInput = searchContainer.querySelector('input');
        const currentSearch = existingInput ? existingInput.value : '';

        // Add Report Button
        // Add Report Button
        searchContainer.innerHTML = `
            <div class="search-row" style="display:flex; gap:1rem; align-items:center; width:100%;">
                <div class="search-input-wrapper">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="growth-search-${kingdomId}" placeholder="Search Governor..." autocomplete="off" value="${currentSearch}">
                    <button id="growth-search-clear-${kingdomId}" class="search-clear-btn" style="display:${currentSearch ? 'block' : 'none'};">✕</button>
                </div>
                </div>
                <div class="alliance-select-wrapper">
                    <select id="growth-alliance-${kingdomId}">
                        <option value="">All Alliances</option>
                        ${alliances.map(a => `<option value="${a}" ${this.allianceFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button id="growth-report-combat-${kingdomId}" class="primary-btn" style="white-space:nowrap;">
                        Combat Report ⚔️
                    </button>
                    <button id="growth-report-growth-${kingdomId}" class="primary-btn" style="white-space:nowrap;">
                        Growth Report 📈
                    </button>
                </div>
            </div>
        `;

        const input = searchContainer.querySelector('input');
        const clearBtn = searchContainer.querySelector('.search-clear-btn');
        const select = searchContainer.querySelector('select');
        const combatBtn = searchContainer.querySelector(`#growth-report-combat-${kingdomId}`);
        const growthBtn = searchContainer.querySelector(`#growth-report-growth-${kingdomId}`);

        input.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            clearBtn.style.display = this.searchTerm ? 'block' : 'none';
            this.applyFilters(kingdomId);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            this.searchTerm = '';
            clearBtn.style.display = 'none';
            this.applyFilters(kingdomId);
        });

        select.addEventListener('change', (e) => {
            this.allianceFilter = e.target.value;
            this.applyFilters(kingdomId);
        });

        if (combatBtn) {
            combatBtn.addEventListener('click', () => {
                this.generateStackRankingReport(kingdomId, 'combat');
            });
        }

        if (growthBtn) {
            growthBtn.addEventListener('click', () => {
                this.generateStackRankingReport(kingdomId, 'growth');
            });
        }
    }

    generateStackRankingReport(kingdomId, type = 'combat') {
        if (!this.currentGrowthData) return;

        // 1. Get filtered data (Top/Bottom logic applies to current view context)
        let data = this.currentGrowthData;
        if (this.allianceFilter) {
            data = data.filter(p => p.alliance === this.allianceFilter);
        }

        // 2. Sort by Final Score (Descending)
        // Ensure we clone to avoid mutating the original array order if it matters elsewhere
        const sorted = [...data].sort((a, b) => b.finalScore - a.finalScore);

        // 3. Top 3 Movers
        const top3 = sorted.slice(0, 3);

        // 4. Bottom 10 (Kick Candidates - Lowest Score)
        // Reverse needed since sorted is Descending
        const bottom10 = sorted.slice(-10).reverse();

        // 5. Format Mail
        const allianceName = this.allianceFilter || "All Alliances";
        const reportTitle = type === 'growth' ? "Growth Report 📈" : "Combat Report ⚔️";
        let report = `${reportTitle}: <color=#000000><b>${allianceName}</b></color> ${this.reportDateRange || ''}\n\n`;

        const formatRow = (p) => {
            const fmt = Utils.formatCompactNumber;
            if (type === 'growth') {
                return `(Tech:+${fmt(p.techDelta)} Cdr:+${fmt(p.cmdDelta)} Bld:+${fmt(p.bldDelta)} RSS:+${fmt(p.gatheredDelta)} Asst:+${fmt(p.rssDelta)})`;
            } else {
                return `(Pwr:${p.powerDelta > 0 ? '+' : ''}${fmt(p.powerDelta)} KP:+${fmt(p.kpDelta)} Dds:+${fmt(p.deadsDelta)})`;
            }
        };

        const showTag = !this.allianceFilter; // Only show [Tag] if viewing ALL alliances

        report += `<color=#32CD32><b>🏆 TOP 3 MOVERS</b></color>\n`;
        top3.forEach((p, i) => {
            report += `${i + 1}. <b>${p.name}</b>${showTag ? ` [${p.alliance}]` : ''} Sc:<color=#32CD32>${p.finalScore.toFixed(1)}</color> ${formatRow(p)}\n`;
        });

        report += `\n<color=#FF4500><b>⚠️ BOTTOM 10 (Review)</b></color>\n`;
        bottom10.forEach((p, i) => {
            report += `${i + 1}. <b>${p.name}</b>${showTag ? ` [${p.alliance}]` : ''} Sc:<color=#FF4500>${p.finalScore.toFixed(1)}</color> ${formatRow(p)}\n`;
        });

        report += `\nGenerated by Unity`;

        // 6. Show Popup
        this.showReportModal(report);
    }

    showReportModal(content) {
        // Simple reusable modal injection
        let modal = document.getElementById('stack-report-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'stack-report-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content glass-panel" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Stack Ranking Report</h2>
                    </div>
                    <div class="modal-body" style="padding: 1rem;">
                        <textarea id="stack-report-text" style="width:100%; height:300px; background:#1e1e1e; color:#ddd; border:1px solid #444; padding:10px; font-family:monospace; resize:vertical;"></textarea>
                        <div style="margin-top:1rem; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                            <button id="open-mail-gen-btn" class="primary-btn">Mail Generator ✉️</button>
                            <button id="copy-report-btn" class="primary-btn">Copy to Clipboard 📋</button>
                            <button class="close-modal-btn secondary-btn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close events
            const close = () => modal.classList.add('hidden');
            modal.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = close);
            // Click outside
            modal.onclick = (e) => {
                if (e.target === modal) close();
            };

            // Copy event
            modal.querySelector('#copy-report-btn').onclick = () => {
                const txt = document.getElementById('stack-report-text');
                txt.select();
                navigator.clipboard.writeText(txt.value).then(() => {
                    const btn = modal.querySelector('#copy-report-btn');
                    const originalText = btn.textContent;
                    btn.textContent = "Copied! ✅";
                    setTimeout(() => btn.textContent = originalText, 2000);
                });
            };

            // Open in Mail Generator event
            modal.querySelector('#open-mail-gen-btn').onclick = () => {
                const content = document.getElementById('stack-report-text').value;
                const mailInput = document.getElementById('mail-input');
                const mailTabBtn = document.querySelector('.tab-btn[data-tab="mail"]');

                if (mailInput && mailTabBtn) {
                    mailInput.value = content;
                    // Trigger input event to update preview
                    mailInput.dispatchEvent(new Event('input', { bubbles: true }));

                    // Switch Tab
                    mailTabBtn.click();

                    // Close Modal
                    close();
                } else {
                    alert('Mail Generator not found!');
                }
            };
        }

        const txtArea = modal.querySelector('#stack-report-text');
        txtArea.value = content;
        modal.classList.remove('hidden');
    }

    handleSort(key, kingdomId) {
        if (this.sortConfig.key === key) {
            this.sortConfig.dir = this.sortConfig.dir === 'desc' ? 'asc' : 'desc';
        } else {
            this.sortConfig.key = key;
            this.sortConfig.dir = 'desc'; // Default new sort to desc (usually better for stats)
            if (key === 'name' || key === 'alliance' || key === 'grade' || key === 'archetype') {
                this.sortConfig.dir = 'asc'; // Text defaults to asc
            }
        }
        this.applyFilters(kingdomId);
    }

    applyFilters(kingdomId) {
        if (!this.currentGrowthData) return;

        let filtered = this.currentGrowthData;

        // 1. Apply Search Filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term)
            );
        }

        // 2. Apply Alliance Filter
        if (this.allianceFilter) {
            filtered = filtered.filter(p => p.alliance === this.allianceFilter);
        }

        // 3. Update Summary with BASE data (contextual stats)
        this.renderSummary(kingdomId, filtered);

        // 4. Apply Grade Filter (for Table)
        if (this.currentFilter) {
            filtered = filtered.filter(p => {
                if (this.currentFilter === 'C') return p.grade === 'C' || p.grade === 'D';
                return p.grade === this.currentFilter;
            });
        }

        // 5. Apply Sorting
        if (this.sortConfig.key) {
            filtered.sort((a, b) => {
                let valA = a[this.sortConfig.key];
                let valB = b[this.sortConfig.key];

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return this.sortConfig.dir === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortConfig.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        this.renderTable(kingdomId, filtered);
    }

    renderTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        const tbody = container.querySelector('.growth-table tbody');
        if (!tbody) return;

        // Add Tooltip to Header if not present
        const table = container.querySelector('.growth-table');
        const headerRow = table.querySelector('thead tr');

        if (headerRow) {
            const getSortIcon = (key) => {
                if (this.sortConfig.key !== key) return '<span style="opacity:0.2">⇅</span>';
                return this.sortConfig.dir === 'asc' ? '↑' : '↓';
            };

            headerRow.innerHTML = `
                <th style="cursor:pointer;" data-sort="name">Governor ${getSortIcon('name')}</th>
                <th style="cursor:pointer;" data-sort="alliance">Alliance ${getSortIcon('alliance')}</th>
                <th style="cursor:pointer;" data-sort="finalScore" data-tooltip="Composite Signal (0-100+)\nEvaluation of account progression.">
                    Growth Score <span style="cursor:help;">ℹ️</span> ${getSortIcon('finalScore')}
                </th>
                <th style="cursor:pointer;" data-sort="grade" data-tooltip="Performance Tier">
                    Grade ${getSortIcon('grade')}
                </th>
                <th style="cursor:pointer;" data-sort="archetype" data-tooltip="Playstyle Classification">
                    Archetype ${getSortIcon('archetype')}
                </th>
                <th style="cursor:pointer;" data-sort="powerDelta" data-tooltip="Net Power Change">
                    Power Δ <span style="font-size:0.8em; opacity:0.7;">(Troop)</span> ${getSortIcon('powerDelta')}
                </th>
                <th style="cursor:pointer;" data-sort="kpDelta" data-tooltip="Kill Points Gained">
                    KP Δ <span style="font-size:0.8em; opacity:0.7;">(Tech)</span> ${getSortIcon('kpDelta')}
                </th>
                <th style="cursor:pointer;" data-sort="deadsDelta" data-tooltip="Troops Dead">
                    Deads <span style="font-size:0.8em; opacity:0.7;">(Cmd)</span> ${getSortIcon('deadsDelta')}
                </th>
                <th style="cursor:pointer;" data-sort="gatheredDelta" data-tooltip="Resources Gathered">
                    Gathered <span style="font-size:0.8em; opacity:0.7;">(Asst)</span> ${getSortIcon('gatheredDelta')}
                </th>
             `;

            // Attach Sort Listeners
            headerRow.onclick = (e) => {
                const th = e.target.closest('th');
                if (!th || !th.dataset.sort) return;
                this.handleSort(th.dataset.sort, kingdomId);
            };
        }

        tbody.innerHTML = '';

        const fmt = (n) => n ? parseInt(n).toLocaleString() : '0';

        data.forEach(p => {
            const tr = document.createElement('tr');

            let gradeClass = 'bg-grade-c';
            if (p.grade === 'S') gradeClass = 'bg-grade-s';
            if (p.grade === 'A') gradeClass = 'bg-grade-a';
            if (p.grade === 'B') gradeClass = 'bg-grade-b';
            if (p.grade === 'D') gradeClass = 'bg-grade-d';

            tr.innerHTML = `
                <td>${p.name}</td>
                <td><span class="alliance-tag">${p.alliance}</span></td>
                <td style="font-weight:bold;">${p.finalScore.toFixed(2)}</td>
                <td><span class="grade-badge ${gradeClass}">${p.grade}</span></td>
                <td><span class="archetype-badge">${p.archetype}</span></td>
                
                <td class="${p.powerDelta >= 0 ? 'diff-pos' : 'diff-neg'}">
                    <div style="font-weight:bold;">${p.powerDelta > 0 ? '+' : ''}${fmt(p.powerDelta)}</div>
                    <div style="font-size:0.75em; opacity:0.7; color:var(--text-secondary);">Troop: ${fmt(p.troopDelta)}</div>
                </td>
                
                <td class="diff-pos">
                     <div style="font-weight:bold;">+${fmt(p.kpDelta)}</div>
                     <div style="font-size:0.75em; opacity:0.7; color:var(--text-secondary);">Tech: ${fmt(p.techDelta)}</div>
                </td>
                
                <td class="diff-neg">
                    <div style="font-weight:bold;">+${fmt(p.deadsDelta)}</div>
                    <div style="font-size:0.75em; opacity:0.7; color:var(--text-secondary);">Cmd: ${fmt(p.cmdDelta)}</div>
                </td>
                
                <td class="diff-neutral">
                    <div style="font-weight:bold; color:#facc15;">${fmt(p.gatheredDelta)}</div>
                    <div style="font-size:0.75em; opacity:0.7; color:var(--text-secondary);">Asst: ${fmt(p.rssDelta)}</div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderDateRange(container, startDate, endDate) {
        let dateInfo = container.querySelector('.growth-date-info');
        if (!dateInfo) {
            dateInfo = document.createElement('div');
            dateInfo.className = 'growth-date-info';
            dateInfo.style.textAlign = 'center';
            dateInfo.style.marginBottom = '1rem';
            dateInfo.style.color = 'var(--text-secondary)';
            dateInfo.style.fontSize = '0.9rem';
            const h2 = container.querySelector('h2');
            if (h2) h2.after(dateInfo);
        }

        const fmt = (d) => d ? d.toLocaleDateString() : 'N/A';
        dateInfo.innerHTML = `
            <span>📅 Start: <strong>${fmt(startDate)}</strong></span>
            <span style="margin:0 10px">→</span>
            <span>📅 End: <strong>${fmt(endDate)}</strong></span>
            <div style="font-size:0.8em; margin-top:5px; opacity:0.7;">
                (Growth = End Scan - Start Scan)
            </div>
        `;
    }

    calculateGrowthScores(startData, endData) {
        if (!startData || !endData) return [];

        const startMap = new Map(startData.map(p => [p['Governor ID'], p]));
        const endMap = new Map(endData.map(p => [p['Governor ID'], p]));

        const allIds = new Set([...endMap.keys()]);

        let processed = [];
        const getVal = (row, key) => Utils.parseNumber(row[key]);

        allIds.forEach(id => {
            const start = startMap.get(id) || {};
            const end = endMap.get(id);

            if (!end) return;

            // --- 1. Combat Deltas ---
            const kpStart = getVal(start, 'Kill Points');
            const kpEnd = getVal(end, 'Kill Points');
            const kpDelta = Math.max(0, kpEnd - kpStart);

            const deadsStart = getVal(start, 'Deads');
            const deadsEnd = getVal(end, 'Deads');
            const deadsDelta = Math.max(0, deadsEnd - deadsStart);

            // --- 2. Growth Deltas ---
            const techStart = getVal(start, 'Tech Power');
            const techEnd = getVal(end, 'Tech Power');
            const techDelta = Math.max(0, techEnd - techStart);

            const cmdStart = getVal(start, 'Commander Power');
            const cmdEnd = getVal(end, 'Commander Power');
            const cmdDelta = Math.max(0, cmdEnd - cmdStart);

            const bldStart = getVal(start, 'Building Power');
            const bldEnd = getVal(end, 'Building Power');
            const bldDelta = Math.max(0, bldEnd - bldStart);

            const troopStart = getVal(start, 'Troop Power');
            const troopEnd = getVal(end, 'Troop Power');
            const troopDelta = troopEnd - troopStart;
            const troopGrowth = Math.max(0, troopDelta);

            const powerStart = getVal(start, 'Power');
            const powerEnd = getVal(end, 'Power');
            const powerDelta = powerEnd - powerStart;

            // --- 3. Activity Deltas ---
            const rssStart = getVal(start, 'Resources Gathered') || getVal(start, 'RSS Gathered');
            const rssEnd = getVal(end, 'Resources Gathered') || getVal(end, 'RSS Gathered');
            const gatheredDelta = Math.max(0, rssEnd - rssStart);

            const assistStart = getVal(start, 'Assistance');
            const assistEnd = getVal(end, 'Assistance');
            const assistDelta = Math.max(0, assistEnd - assistStart);

            const t4Start = getVal(start, 'T4 Kills');
            const t4End = getVal(end, 'T4 Kills');
            const t4Delta = Math.max(0, t4End - t4Start);

            const t5Start = getVal(start, 'T5 Kills');
            const t5End = getVal(end, 'T5 Kills');
            const t5Delta = Math.max(0, t5End - t5Start);

            processed.push({
                id,
                name: end['Governor Name'],
                alliance: end['Alliance Tag'] || '-',
                kpDelta, deadsDelta,
                techDelta, bldDelta, troopDelta, troopGrowth,
                gatheredDelta, rssDelta: assistDelta, powerDelta,
                t4Delta, t5Delta,
                troopDeltaDisplay: troopDelta,
                techDeltaDisplay: techDelta,
                cmdDelta: cmdDelta,
                raw: { power: powerEnd, kp: kpEnd, deads: deadsEnd }
            });
        });

        // --- Normalization Baselines (95th Percentile) ---
        // Prevents outliers from skewing the curve.
        const getPercentile = (arr, valFn, p = 0.95) => {
            const values = arr.map(valFn).sort((a, b) => a - b);
            if (values.length === 0) return 1;
            const index = Math.floor(values.length * p);
            return values[index] || values[values.length - 1] || 1;
        };

        const maxKP = getPercentile(processed, p => p.kpDelta);
        const maxDeads = getPercentile(processed, p => p.deadsDelta);
        const maxTech = getPercentile(processed, p => p.techDelta);
        const maxBld = getPercentile(processed, p => p.bldDelta);
        const maxTroop = getPercentile(processed, p => p.troopGrowth);
        const maxGathered = getPercentile(processed, p => p.gatheredDelta);

        processed.forEach(p => {
            // Weights: Growth 75%, Combat 20%, Activity 5%
            // Capped at 1.25x (allowing slight over-performance bonus up to 125% of weight if beating percentile)
            // But let's stick to simple Math.min(1, ...) for now to keep grades 0-100.

            const sTech = Math.min(1.2, p.techDelta / maxTech) * 25;
            const sBld = Math.min(1.2, p.bldDelta / maxBld) * 25;
            const sTroop = Math.min(1.2, p.troopGrowth / maxTroop) * 25;

            const sKP = Math.min(1.2, p.kpDelta / maxKP) * 12;
            const sDeads = Math.min(1.2, p.deadsDelta / maxDeads) * 8;

            const sGathered = Math.min(1.2, p.gatheredDelta / maxGathered) * 5;

            let score = sKP + sDeads + sTech + sBld + sTroop + sGathered;

            p.finalScore = Math.max(0, Math.min(100, score));
            p.grade = this.determineGrade(p.finalScore);
            p.archetype = this.determineArchetype(p, maxKP * 1.5, maxDeads * 1.5, maxGathered * 1.5);
        });

        return processed.sort((a, b) => b.finalScore - a.finalScore);
    }

    determineGrade(score) {
        if (score >= 80) return 'S';
        if (score >= 60) return 'A';
        if (score >= 40) return 'B';
        if (score >= 20) return 'C';
        return 'D';
    }

    determineArchetype(p, maxKP, maxDeads, maxGathered) {
        // Simple heuristic
        const isHighKP = p.kpDelta > (maxKP * 0.4);
        const isHighDeads = p.deadsDelta > (maxDeads * 0.4);
        const isHighFarm = p.gatheredDelta > (maxGathered * 0.5);

        if (isHighKP && isHighDeads) return 'Warrior';
        if (isHighKP) return 'Brawler';
        if (isHighDeads) return 'Meatshield';
        if (isHighFarm) return 'Harvester';
        if (p.powerDelta > 0) return 'Grower';
        return 'Casual';
    }

    renderSummary(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;

        // Count Grades
        const counts = { S: 0, A: 0, B: 0, C: 0 };
        data.forEach(p => {
            if (counts[p.grade] !== undefined) counts[p.grade]++;
            else counts['C']++; // D/F -> C bucket
        });

        // Update UI
        const setTxt = (sel, val) => {
            const el = container.querySelector(sel);
            if (el) el.textContent = val;
        };

        setTxt('.count-s', counts.S);
        setTxt('.count-a', counts.A);
        setTxt('.count-b', counts.B);
        setTxt('.count-c', counts.C);
    }
}
