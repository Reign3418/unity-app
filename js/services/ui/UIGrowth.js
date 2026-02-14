
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
        this.allianceFilter = ''; // Track active alliance filter
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

        // Render Search Control
        this.renderSearchControl(container, kingdomId);

        if (!kState || !kState.currentOverviewData) {
            const tbody = container.querySelector('.growth-table tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">No data available. Please upload Start and End scans.</td></tr>';
            return;
        }

        // Calculate Scores
        const growthData = this.calculateGrowthScores(kState.startData, kState.endData);
        this.currentGrowthData = growthData; // Store for filtering

        // Render Leaderboard Summary
        this.renderSummary(kingdomId, growthData);

        // Render Detailed Table (Initial render with no filter)
        this.applyFilters(kingdomId);
    }

    renderSearchControl(container, kingdomId) {
        let searchContainer = container.querySelector('.growth-search-container');
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

            searchContainer.innerHTML = `
                <div class="search-input-wrapper">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="growth-search-${kingdomId}" placeholder="Search Governor or Alliance..." autocomplete="off">
                    <button id="growth-search-clear-${kingdomId}" class="search-clear-btn" style="display:none;">✕</button>
                </div>
            `;

            const input = searchContainer.querySelector('input');
            const clearBtn = searchContainer.querySelector('.search-clear-btn');

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
        }
    }

    applyFilters(kingdomId) {
        if (!this.currentGrowthData) return;

        let filtered = this.currentGrowthData;

        // 1. Apply Grade Filter
        if (this.currentFilter) {
            filtered = filtered.filter(p => {
                if (this.currentFilter === 'C') return p.grade === 'C' || p.grade === 'D';
                return p.grade === this.currentFilter;
            });
        }

        // 2. Apply Search Filter
        if (this.searchTerm) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(this.searchTerm) ||
                p.alliance.toLowerCase().includes(this.searchTerm)
            );
        }

        this.renderTable(kingdomId, filtered);
    }

    renderDateRange(container, start, end) {
        let dateContainer = container.querySelector('.growth-date-info');

        // Create if doesn't exist
        if (!dateContainer) {
            dateContainer = document.createElement('div');
            dateContainer.className = 'growth-date-info';

            // Insert after the description paragraph (.text-secondary)
            const desc = container.querySelector('.text-secondary');
            if (desc) {
                desc.after(dateContainer);
            } else {
                // Fallback: Prepend to summary grid if desc not found
                const grid = container.querySelector('.growth-summary-grid');
                if (grid) grid.before(dateContainer);
            }
        }

        if (!start || !end) {
            dateContainer.innerHTML = '<span>waiting for <strong>Start</strong> and <strong>End</strong> scans to calculate duration...</span>';
            return;
        }

        // Calculate Duration
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Format Dates
        const opts = { month: 'short', day: 'numeric', year: 'numeric' };
        const dateStr = `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}`;

        dateContainer.innerHTML = `
            <span>📅 Period: <strong>${dateStr}</strong></span>
            <span class="duration-badge">⏱️ ${diffDays} Days</span>
        `;
    }

    calculateGrowthScores(startData, endData) {
        // 1. Map Data by ID for easy delta calc
        const startMap = new Map(startData.map(r => [r['Governor ID'], r]));
        const endMap = new Map(endData.map(r => [r['Governor ID'], r]));
        const allIds = new Set([...startMap.keys(), ...endMap.keys()]);

        const governorScores = [];

        // 2. Calculate Raw Deltas
        allIds.forEach(id => {
            const start = startMap.get(id) || {};
            const end = endMap.get(id);

            // Ignore players who don't exist in End Scan (Dropped/Migrated)
            if (!end) return;

            const safeParse = (val) => Utils.parseNumber(val);

            // Main Power Delta
            const powerStart = safeParse(start['Power']);
            const powerEnd = safeParse(end['Power']);
            const powerDelta = powerEnd - powerStart;

            // Sub-Power Deltas (New Metrics)
            const techDelta = safeParse(end['Tech Power']) - safeParse(start['Tech Power']);
            const cmdDelta = safeParse(end['Commander Power']) - safeParse(start['Commander Power']);
            const bldDelta = safeParse(end['Building Power']) - safeParse(start['Building Power']);
            const troopDelta = safeParse(end['Troop Power']) - safeParse(start['Troop Power']);

            // Kill Points
            const kpStart = safeParse(start['Kill Points']);
            const kpEnd = safeParse(end['Kill Points']);
            const kpDelta = kpEnd - kpStart;

            // Deads
            const deadsStart = safeParse(start['Deads']);
            const deadsEnd = safeParse(end['Deads']);
            const deadsDelta = deadsEnd - deadsStart;

            // Assistance
            const rssStart = safeParse(start['Assistance']);
            const rssEnd = safeParse(end['Assistance']);
            const rssDelta = rssEnd - rssStart;

            governorScores.push({
                id: id,
                name: end['Governor Name'] || 'Unknown',
                alliance: end['Alliance Tag'] || '-',
                powerDelta: powerDelta, // Keep negative for truth
                powerStart: powerStart,
                powerEnd: powerEnd,
                techDelta: Math.max(0, techDelta),
                cmdDelta: Math.max(0, cmdDelta),
                bldDelta: Math.max(0, bldDelta),
                troopDelta: Math.max(0, troopDelta), // Can be neg if hospital overflow/dead
                kpDelta: Math.max(0, kpDelta),
                deadsDelta: Math.max(0, deadsDelta),
                rssDelta: Math.max(0, rssDelta)
            });
        });

        if (governorScores.length === 0) return [];

        // 3. Normalize Metrics (Z-Score)
        const getZScores = (arr, key) => {
            const values = arr.map(item => item[key]);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length) || 1;
            return arr.map(item => ({ ...item, [key + 'Z']: (item[key] - mean) / stdDev }));
        };

        let scored = getZScores(governorScores, 'kpDelta');
        scored = getZScores(scored, 'deadsDelta');
        scored = getZScores(scored, 'techDelta');
        scored = getZScores(scored, 'cmdDelta');
        scored = getZScores(scored, 'bldDelta');
        scored = getZScores(scored, 'troopDelta');
        scored = getZScores(scored, 'rssDelta');

        // 4. Calculate Final Score & Grade
        // Updated Weights:
        // KP: 35%
        // Troop Power: 20%
        // Tech Power: 15%
        // Cmd Power: 15%
        // Bld Power: 10%
        // Deads: 5% (User said 'way less')
        scored.forEach(player => {
            const score =
                (player.kpDeltaZ * 0.35) +
                (player.troopDeltaZ * 0.20) +
                (player.techDeltaZ * 0.15) +
                (player.cmdDeltaZ * 0.15) +
                (player.bldDeltaZ * 0.10) +
                (player.deadsDeltaZ * 0.05);

            player.finalScore = score;

            // Assign Grade
            if (score >= 1.5) player.grade = 'S';
            else if (score >= 0.5) player.grade = 'A';
            else if (score >= -0.5) player.grade = 'B';
            else if (score >= -1.5) player.grade = 'C';
            else player.grade = 'D';

            // Assign Archetype
            player.archetype = this.determineArchetype(player);
        });

        return scored.sort((a, b) => b.finalScore - a.finalScore);
    }

    determineArchetype(player) {
        // Berserker: High KP gain, but Low/Negative Power Gain (Wasting resources?)
        if (player.kpDeltaZ > 1.0 && player.powerDelta < 0) return '🔥 Berserker';

        // Whale: High Growth across the board
        if (player.techDeltaZ > 1.5 && player.cmdDeltaZ > 1.5) return '🐋 Whale';

        // War Machine: High KP + Deads
        if (player.kpDeltaZ > 1.0 && player.deadsDeltaZ > 1.0) return '⚔️ War Machine';

        // Bank: High RSS
        if (player.rssDeltaZ > 2.0) return '🏦 Bank';

        // Farmer: High Power (Building/Tech) but Low KP
        if ((player.techDeltaZ > 0.5 || player.bldDeltaZ > 0.5) && player.kpDeltaZ < -0.5) return '🌾 Farmer';

        // Slacker
        if (player.finalScore < -1.5) return '💤 Slacker';

        return '🛡️ Balanced';
    }

    renderSummary(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;

        const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
        data.forEach(p => {
            if (counts[p.grade] !== undefined) counts[p.grade]++;
            else counts.C++;
        });

        const c_plus = (counts.C || 0) + (counts.D || 0);

        const setValAndClick = (cls, val, gradeFilter) => {
            const el = container.querySelector(`.${cls}`);
            // Also find parent card to attach click
            const card = container.querySelector(`.grade-${gradeFilter.toLowerCase().charAt(0)}-u`);

            if (el) el.textContent = val;

            if (card) {
                card.style.cursor = 'pointer';
                card.onclick = () => {
                    // Reset all cards border
                    const cards = container.querySelectorAll('.growth-card');
                    cards.forEach(c => c.style.border = '1px solid var(--border-color)');

                    if (this.currentFilter === gradeFilter) {
                        this.currentFilter = null; // Clear filter
                        this.applyFilters(kingdomId);
                    } else {
                        this.currentFilter = gradeFilter;
                        // Determine border color based on grade
                        let borderColor = '#64748b';
                        if (gradeFilter === 'S') borderColor = '#fbbf24';
                        if (gradeFilter === 'A') borderColor = '#34d399';
                        if (gradeFilter === 'B') borderColor = '#60a5fa';
                        if (gradeFilter === 'C') borderColor = '#f87171';

                        card.style.border = `2px solid ${borderColor}`;
                        this.applyFilters(kingdomId);
                    }
                };
            }
        };

        setValAndClick('count-s', counts.S, 'S');
        setValAndClick('count-a', counts.A, 'A');
        setValAndClick('count-b', counts.B, 'B');
        setValAndClick('count-c', c_plus, 'C'); // Covers C & D
    }

    renderTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        const tbody = container.querySelector('.growth-table tbody');
        if (!tbody) return;

        // Add Tooltip to Header if not present
        const table = container.querySelector('.growth-table');
        const headerRow = table.querySelector('thead tr');

        // We need to make sure the header matches our new data columns structure
        // If we are injecting rows with new columns, the header needs to match
        // The HTML header currently has: Gov, Alliance, Score, Grade, Arch, Pwr, KP, Deads, Asst (9 cols)

        // Update header HTML dynamically or user needs to update index.html? 
        // Let's check index.html. It has 9 columns.
        // My new renderTable row has: Name, Alliance, Score, Grade, Arch, Power(Troop), KP(Tech), Deads(Cmd), RSS(Bld)
        // So 9 columns. The headers should be updated to reflect the sub-metrics or just be generic "Power", "KP", etc.
        // I will update the header innerHTML here to be safe and include the tooltip.

        if (headerRow) {
            headerRow.innerHTML = `
                <th>Governor</th>
                <th>Alliance</th>
                <th data-tooltip="Composite Signal (0-100+)\nEvaluation of account progression.\n\nWeights:\n• Kill Points: 35%\n• Troop Power: 20%\n• Tech Power: 15%\n• Commander Power: 15%\n• Building Power: 10%\n• Deads: 5%">
                    Growth Score <span style="cursor:help;">ℹ️</span>
                </th>
                <th data-tooltip="Performance Tier\nRelative to kingdom average.\n\n• S: Top 10% (Gods)\n• A: Next 20% (Elite)\n• B: Average (Active)\n• C/D: Below Average">
                    Grade
                </th>
                <th data-tooltip="Playstyle Classification\nBased on growth patterns.\n\n• Whale: High Tech & Cmd Growth\n• War Machine: High KP & Deads\n• Berserker: High KP, Low Power\n• Farmer: High Power, Low KP\n• Bank: High Assistance">
                    Archetype
                </th>
                <th data-tooltip="Net Power Change\nTotal power gained/lost.\n\nSub-value: Troop Power (Training)">
                    Power Δ <span style="font-size:0.8em; opacity:0.7;">(Troop)</span>
                </th>
                <th data-tooltip="Kill Points Gained\nCombat effectiveness.\n\nSub-value: Tech Power (Research)">
                    KP Δ <span style="font-size:0.8em; opacity:0.7;">(Tech)</span>
                </th>
                <th data-tooltip="Troops Dead\nUnits lost in combat.\n\nSub-value: Commander Power">
                    Deads <span style="font-size:0.8em; opacity:0.7;">(Cmd)</span>
                </th>
                <th data-tooltip="Assistance\nResources sent to allies.\n\nSub-value: Building Power">
                    RSS <span style="font-size:0.8em; opacity:0.7;">(Bld)</span>
                </th>
             `;
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
                    <div style="font-weight:bold;">${fmt(p.rssDelta)}</div>
                    <div style="font-size:0.75em; opacity:0.7; color:var(--text-secondary);">Bld: ${fmt(p.bldDelta)}</div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}
