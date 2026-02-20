// ==========================================
// SERVICE: UI ALLIANCE DUEL
// ==========================================
Object.assign(UIService.prototype, {
    renderAllianceDuel(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const vsContainer = container.querySelector('.alliance-vs-container');
        if (!vsContainer) return;

        const kState = this.data.state.kingdoms[kingdomId];
        // Use Overview Data (Delta between Start and End)
        const data = kState.currentOverviewData;

        if (!data || data.length === 0) {
            vsContainer.querySelector('.vs-stats-grid').innerHTML = '<div style="text-align:center; padding:2rem;">No overview data available. Ensure both Start and End scans are loaded.</div>';
            return;
        }

        const distinctAlliances = [...new Set(data.map(r => r['Alliance Tag']))].filter(a => a).sort();

        // Populate Date Range
        const datesEl = vsContainer.querySelector('.vs-dates');
        if (datesEl) {
            const start = this.data.state.startScanDate || 'N/A';
            const end = this.data.state.endScanDate || 'N/A';
            datesEl.textContent = `${start} - ${end}`;
        }

        const selectA = vsContainer.querySelector('.vs-select-a');
        const selectB = vsContainer.querySelector('.vs-select-b');

        const populate = (select) => {
            select.innerHTML = '<option value="">Select Alliance</option>';
            distinctAlliances.forEach(tag => {
                select.innerHTML += `<option value="${tag}">${tag}</option>`;
            });
        };

        populate(selectA);
        populate(selectB);

        const handleSelection = () => {
            const valA = selectA.value;
            const valB = selectB.value;
            if (valA && valB && valA !== valB) {
                this.updateAllianceVsStats(kingdomId, valA, valB, data);
            }
        };

        // Remove old listeners to avoid duplicates (cloneNode typically handles this by stripping, but safer)
        selectA.onchange = handleSelection;
        selectB.onchange = handleSelection;
    },

    updateAllianceVsStats(kingdomId, tagA, tagB, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const grid = container.querySelector('.vs-stats-grid');
        const arena = container.querySelector('.vs-arena');

        const getStats = (tag) => {
            const rows = data.filter(r => r['Alliance Tag'] === tag);
            return {
                name: rows.length > 0 ? (rows[0]['Alliance Name'] || tag) : tag,
                tag: tag,
                startPower: rows.reduce((sum, r) => sum + (r['_raw_Power_Start'] || 0), 0),
                troopStart: rows.reduce((sum, r) => sum + (r['_raw_Troop Power_Start'] || 0), 0),
                techStart: rows.reduce((sum, r) => sum + (r['_raw_Tech Power_Start'] || 0), 0),
                buildingStart: rows.reduce((sum, r) => sum + (r['_raw_Building Power_Start'] || 0), 0),
                commanderStart: rows.reduce((sum, r) => sum + (r['_raw_Commander Power_Start'] || 0), 0),

                power: rows.reduce((sum, r) => sum + (r['_raw_Power_Delta'] || 0), 0),
                troop: rows.reduce((sum, r) => sum + (r['_raw_Troop Power_Delta'] || 0), 0),
                tech: rows.reduce((sum, r) => sum + (r['_raw_Tech Power_Delta'] || 0), 0),
                building: rows.reduce((sum, r) => sum + (r['_raw_Building Power_Delta'] || 0), 0),
                commander: rows.reduce((sum, r) => sum + (r['_raw_Commander Power_Delta'] || 0), 0),
                kp: rows.reduce((sum, r) => sum + (r['_raw_Kill Points_Delta'] || 0), 0),
                deads: rows.reduce((sum, r) => {
                    const val = r['Deads (End)'];
                    if (!val || val === '-') return sum;
                    return sum + parseFloat(String(val).replace(/,/g, ''));
                }, 0),
                members: rows.length
            };
        };

        const statsA = getStats(tagA);
        const statsB = getStats(tagB);

        // Render Cards
        const createCard = (stats, color) => `
            <div class="vs-card ${color}-card">
                <div class="vs-card-header">
                    <div class="vs-alliance-tag">[${stats.tag}]</div>
                    <div class="vs-alliance-name">${stats.tag}</div> <!-- Using tag as name if full name unavailable -->
                </div>
                <div class="vs-avatar">${stats.tag.substring(0, 2)}</div>
                
                <div class="vs-main-stat">
                    <div class="vs-stat-label">Total Power</div>
                    <div class="vs-stat-value-main">${CalculationService.formatNumber(stats.startPower)}</div>
                </div>

                <!-- Detailed Starting Stats -->
                <div class="vs-detailed-stats">
                    <div class="vs-detail-row">
                        <span>Troops</span>
                        <strong>${CalculationService.formatNumber(stats.troopStart)}</strong>
                    </div>
                    <div class="vs-detail-row">
                        <span>Tech</span>
                        <strong>${CalculationService.formatNumber(stats.techStart)}</strong>
                    </div>
                    <div class="vs-detail-row">
                        <span>Building</span>
                        <strong>${CalculationService.formatNumber(stats.buildingStart)}</strong>
                    </div>
                    <div class="vs-detail-row">
                        <span>Commander</span>
                        <strong>${CalculationService.formatNumber(stats.commanderStart)}</strong>
                    </div>
                </div>

                <div class="vs-sub-stats">
                    <div class="vs-sub-stat-box">
                        <div class="vs-stat-label">Members</div>
                        <div style="font-weight:bold; color:white;">${stats.members}</div>
                    </div>
                     <div class="vs-sub-stat-box">
                        <div class="vs-stat-label">Kill Points</div>
                        <div style="font-weight:bold; color:#f59e0b;">${CalculationService.formatNumber(stats.kp)}</div>
                    </div>
                     <div class="vs-sub-stat-box">
                        <div class="vs-stat-label">Deads</div>
                        <div style="font-weight:bold; color:#ef4444;">${CalculationService.formatNumber(stats.deads)}</div>
                    </div>
                </div>
            </div>
        `;

        if (arena) {
            arena.innerHTML = `
                ${createCard(statsA, 'blue')}
                 <!-- Center VS is handled by parent or CSS, here just cards -->
                ${createCard(statsB, 'red')}
            `;
        }

        const createCompactBar = (label, valA, valB, format = true) => {
            const total = Math.abs(valA) + Math.abs(valB);
            const perA = total === 0 ? 50 : (Math.abs(valA) / total) * 100;
            const perB = total === 0 ? 50 : (Math.abs(valB) / total) * 100;

            const displayA = format ? CalculationService.formatNumber(valA) : valA;
            const displayB = format ? CalculationService.formatNumber(valB) : valB;

            return `
                <div class="vs-compact-stat">
                    <div class="vs-compact-header">${label}</div>
                    <div class="vs-compact-row">
                        <span class="val-blue">${displayA}</span>
                        <div class="vs-compact-bar-bg">
                            <div class="vs-compact-bar-fill" style="width: ${perA}%; background: #3b82f6;"></div>
                            <div class="vs-compact-bar-fill" style="width: ${perB}%; background: #ef4444;"></div>
                        </div>
                        <span class="val-red">${displayB}</span>
                    </div>
                </div>
            `;
        };

        grid.innerHTML = `
            ${createCompactBar('Total Power Growth', statsA.power, statsB.power)}
            ${createCompactBar('Troop Power Growth', statsA.troop, statsB.troop)}
            ${createCompactBar('Kill Points Gained', statsA.kp, statsB.kp)}
            ${createCompactBar('Dead Troops', statsA.deads, statsB.deads)}
            ${createCompactBar('Tech Power Growth', statsA.tech, statsB.tech)}
            ${createCompactBar('Commander Power Growth', statsA.commander, statsB.commander)}
            ${createCompactBar('Building Power Growth', statsA.building, statsB.building)}
            ${createCompactBar('Active Members', statsA.members, statsB.members, false)}
        `;
    }
});
