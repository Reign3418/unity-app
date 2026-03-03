class UIKingdomAnalysis {
    init(dataService, kingdomId) {
        this.data = dataService;
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;

        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState) return;

        // Ensure we have both scans to diff against
        if (!kState.startData || kState.startData.length === 0 || !kState.endData || kState.endData.length === 0) {
            this.renderEmptyState(container, kingdomId);
            return;
        }

        const report = this.calculateKingdomDeltas(kState.startData, kState.endData);
        this.renderAnalysis(container, report, kingdomId);
    }

    calculateKingdomDeltas(startData, endData) {
        const startMap = new Map(startData.map(p => [p['Governor ID'], p]));

        let kingdomTotalPower = 0;
        let kingdomTotalKP = 0;
        let kingdomTotalDeads = 0;
        let kingdomTotalStartPower = 0;
        let kingdomTotalEndPower = 0;

        const allianceMap = {}; // { "TAG": { members: 0, startPower: 0, endPower: 0, powerDelta: 0, kpDelta: 0, deadsDelta: 0 } }

        const getVal = (row, key) => {
            if (!row || row[key] === undefined || row[key] === null || row[key] === '') return 0;
            const clean = row[key].toString().replace(/,/g, '').trim();
            const num = parseInt(clean);
            return isNaN(num) ? 0 : num;
        };

        endData.forEach(endGov => {
            const id = endGov['Governor ID'];
            const startGov = startMap.get(id);

            // Fetch base values
            const pwrEnd = getVal(endGov, 'Power');
            const kpEnd = getVal(endGov, 'Kill Points');
            const deadsEnd = getVal(endGov, 'Deads');

            const pwrStart = getVal(startGov, 'Power');
            const kpStart = getVal(startGov, 'Kill Points');
            const deadsStart = getVal(startGov, 'Deads');

            // Calculate Deltas (Allow negative power delta, but KP/Deads shouldn't physically drop)
            // Even if startGov doesn't exist (new account transferring mid-scan), it acts as a +Power gain
            const pwrDelta = pwrEnd - pwrStart;
            const kpDelta = Math.max(0, kpEnd - kpStart);
            const deadsDelta = Math.max(0, deadsEnd - deadsStart);

            // Add to Kingdom Totals
            kingdomTotalPower += pwrDelta;
            kingdomTotalKP += kpDelta;
            kingdomTotalDeads += deadsDelta;
            kingdomTotalStartPower += pwrStart;
            kingdomTotalEndPower += pwrEnd;

            // Sort into Alliance Buckets based on their End-Scan Alliance Tag
            const tag = endGov['Alliance Tag'] && endGov['Alliance Tag'].trim() !== "" ? endGov['Alliance Tag'] : "Unaffiliated";

            if (!allianceMap[tag]) {
                allianceMap[tag] = {
                    tag: tag,
                    members: 0,
                    startPower: 0,
                    endPower: 0,
                    powerDelta: 0,
                    kpDelta: 0,
                    deadsDelta: 0
                };
            }

            allianceMap[tag].members += 1;
            allianceMap[tag].startPower += pwrStart;
            allianceMap[tag].endPower += pwrEnd;
            allianceMap[tag].powerDelta += pwrDelta;
            allianceMap[tag].kpDelta += kpDelta;
            allianceMap[tag].deadsDelta += deadsDelta;
        });

        // Convert Map to Array
        const allianceList = Object.values(allianceMap);

        return {
            kingdomTotalPower,
            kingdomTotalKP,
            kingdomTotalDeads,
            kingdomTotalStartPower,
            kingdomTotalEndPower,
            allianceList
        };
    }

    renderEmptyState(container, kingdomId) {
        const content = container.querySelector('[data-content="kingdom-analysis"]');
        if (!content) return;

        content.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3em; margin-bottom: 1rem; opacity: 0.5;">📊</div>
                <h3>Kingdom Analysis requires Both Scans</h3>
                <p style="color: var(--text-muted);">Please wait until both a Start Scan and an End Scan are securely loaded to view differential deltas.</p>
            </div>
        `;
    }

    renderAnalysis(container, report, kingdomId) {
        const content = container.querySelector('[data-content="kingdom-analysis"]');
        if (!content) return;

        content.innerHTML = this.generateAnalysisHTML(report, kingdomId);

        this.attachSortingListeners(content, report, false);
    }

    generateAnalysisHTML(report, kingdomId, includeTitle = false, isCompact = false) {
        const fmt = (num) => num.toLocaleString();

        let titleHtml = includeTitle ? `
            <div style="background: var(--card-hover); padding: 10px 20px; border-radius: 8px 8px 0 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 10px; font-size: 1.3em;">
                    👑 Kingdom ${kingdomId}
                </h2>
            </div>
        ` : '';

        // Compress header spacing for multi-view
        const headerPadding = isCompact ? '10px' : '20px';
        const headerMargin = isCompact ? '1rem' : '2rem';
        const gapSize = isCompact ? '1rem' : '2rem';
        const numSize = isCompact ? '1.5em' : '2em';

        // Limit the table rows to top 5 if compact is requested
        let displayList = [...report.allianceList];

        // Ensure it's sorted by powerDelta descending before slicing, to guarantee "Top 5 Growers" mapping
        displayList.sort((a, b) => b.powerDelta - a.powerDelta);
        if (isCompact) {
            displayList = displayList.slice(0, 5);
        }

        let html = `
            ${titleHtml}
            <div style="${includeTitle ? 'padding: 15px; border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 8px 8px; background: var(--card-bg);' : ''}">
                <div class="kingdom-analysis-header glass-panel" style="display: flex; gap: ${gapSize}; justify-content: center; padding: ${headerPadding}; align-items: center; margin-bottom: ${headerMargin}; text-align: center;">
                     <div style="flex: 1;">
                         <div style="font-size: 0.8em; color: var(--text-muted); text-transform: uppercase;">Kingdom Power Δ</div>
                         <div style="font-size: ${numSize}; font-weight: 800; color: ${report.kingdomTotalPower >= 0 ? 'var(--positive-color, #4ade80)' : 'var(--danger-color, #ef4444)'};">${report.kingdomTotalPower > 0 ? '+' : ''}${fmt(report.kingdomTotalPower)}</div>
                         <div style="font-size: 0.8em; color: var(--text-muted); margin-top: 5px;">
                            ${fmt(report.kingdomTotalStartPower)} ➔ ${fmt(report.kingdomTotalEndPower)}
                         </div>
                     </div>
                     <div style="width: 1px; height: 35px; background: var(--border-color, rgba(255,255,255,0.1));"></div>
                     <div style="flex: 1;">
                         <div style="font-size: 0.8em; color: var(--text-muted); text-transform: uppercase;">Kingdom KP Gained</div>
                         <div style="font-size: ${numSize}; font-weight: 800; color: var(--accent-primary, #6366f1);">+${fmt(report.kingdomTotalKP)}</div>
                     </div>
                     <div style="width: 1px; height: 35px; background: var(--border-color, rgba(255,255,255,0.1));"></div>
                     <div style="flex: 1;">
                         <div style="font-size: 0.8em; color: var(--text-muted); text-transform: uppercase;">Kingdom Troops Dead</div>
                         <div style="font-size: ${numSize}; font-weight: 800; color: #f59e0b;">+${fmt(report.kingdomTotalDeads)}</div>
                     </div>
                </div>

                <h3 style="margin-bottom: 0.5rem; font-size: 1.1em;">${isCompact ? 'Top 5 Alliances' : 'Alliance Breakdown'}</h3>
                <div class="table-container">
                    <table class="data-table analysis-table ${isCompact ? 'compact' : ''}" data-kingdom="${kingdomId}" style="${isCompact ? 'font-size: 0.9em;' : ''}">
                        <thead>
                            <tr>
                                <th data-sort="tag" style="cursor: pointer;">Alliance ⇅</th>
                                <th data-sort="members" style="cursor: pointer;">Members ⇅</th>
                                <th data-sort="startPower" style="cursor: pointer;">Start Power ⇅</th>
                                <th data-sort="endPower" style="cursor: pointer;">End Power ⇅</th>
                                <th data-sort="powerDelta" style="cursor: pointer;">Power Δ ⇅</th>
                                <th data-sort="kpDelta" style="cursor: pointer;">KP Δ ⇅</th>
                                <th data-sort="deadsDelta" style="cursor: pointer;">Deads Δ ⇅</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.generateTableRows(displayList, isCompact)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return html;
    }

    attachSortingListeners(wrapper, report, isCompact = false) {
        const table = wrapper.querySelector('.analysis-table');
        if (!table) return;

        let currentSort = { key: 'powerDelta', dir: 'desc' }; // Default load

        table.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (!key) return;

                if (currentSort.key === key) {
                    currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
                } else {
                    currentSort.key = key;
                    currentSort.dir = 'desc'; // Default text search vs num search isn't strict here since mostly numbers
                }

                // Sort the array in memory
                report.allianceList.sort((a, b) => {
                    let valA = a[key];
                    let valB = b[key];

                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();

                    if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
                    if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
                    return 0;
                });

                // Re-render rows
                let renderList = report.allianceList;
                if (isCompact) renderList = renderList.slice(0, 5);
                table.querySelector('tbody').innerHTML = this.generateTableRows(renderList, isCompact);
            });
        });

        // Initial Sort (Power Delta Descending)
        report.allianceList.sort((a, b) => b.powerDelta - a.powerDelta);
        let initialList = report.allianceList;
        if (isCompact) initialList = initialList.slice(0, 5);
        table.querySelector('tbody').innerHTML = this.generateTableRows(initialList, isCompact);
    }

    generateTableRows(allianceList, isCompact = false) {
        const fmt = (num) => num.toLocaleString();

        const padStyle = isCompact ? 'padding: 6px 10px;' : '';

        return allianceList.map(a => {
            const pwrColor = a.powerDelta >= 0 ? 'var(--positive-color, #4ade80)' : 'var(--danger-color, #ef4444)';
            const pwrSign = a.powerDelta > 0 ? '+' : '';

            return `
                <tr>
                    <td style="font-weight: bold; ${padStyle}"><span class="alliance-tag">${a.tag}</span></td>
                    <td style="${padStyle}">${a.members}</td>
                    <td style="color: var(--text-muted); ${padStyle}">${fmt(a.startPower)}</td>
                    <td style="color: var(--text-muted); ${padStyle}">${fmt(a.endPower)}</td>
                    <td style="font-weight: bold; color: ${pwrColor}; ${padStyle}">${pwrSign}${fmt(a.powerDelta)}</td>
                    <td style="font-weight: bold; color: var(--accent-primary, #6366f1); ${padStyle}">+${fmt(a.kpDelta)}</td>
                    <td style="font-weight: bold; color: #f59e0b; ${padStyle}">+${fmt(a.deadsDelta)}</td>
                </tr>
            `;
        }).join('');
    }

    renderAllKingdoms(dataService, containerId) {
        const container = document.getElementById(containerId);
        const viewToggle = document.getElementById('all-kingdom-view-toggle');
        if (!container) return;

        // Bind listener securely once
        if (viewToggle && !viewToggle.hasAttribute('data-bound')) {
            viewToggle.setAttribute('data-bound', 'true');
            viewToggle.addEventListener('change', () => {
                this.renderAllKingdoms(dataService, containerId);
            });
        }

        const viewMode = viewToggle ? viewToggle.value : 'card';

        container.innerHTML = '';
        const kingdoms = Array.from(dataService.state.loadedKingdoms || []);

        const dateHeader = document.getElementById('all-kingdom-dates');
        if (dateHeader) {
            const startD = dataService.state.startScanDate || 'Unknown Date';
            const endD = dataService.state.endScanDate || 'Unknown Date';
            dateHeader.innerHTML = `Start Scan: <strong>${startD}</strong> &nbsp;|&nbsp; End Scan: <strong>${endD}</strong>`;
        }

        if (kingdoms.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3em; margin-bottom: 1rem; opacity: 0.5;">👑</div>
                    <h3>No Kingdoms Loaded</h3>
                    <p style="color: var(--text-muted);">Please upload kingdom scans in the Welcome tab to see the All Kingdom Analysis.</p>
                </div>
             `;
            return;
        }

        let totalHtml = '';
        let reportsMap = {};
        const fmt = (num) => num.toLocaleString();

        // Calculate all reports first
        kingdoms.forEach(kId => {
            const kState = dataService.state.kingdoms[kId];
            if (kState && kState.startData && kState.startData.length > 0 && kState.endData && kState.endData.length > 0) {
                reportsMap[kId] = this.calculateKingdomDeltas(kState.startData, kState.endData);
            }
        });

        if (viewMode === 'list') {
            // ================== LIST VIEW ==================
            container.style.flexDirection = 'column';
            container.style.overflowX = 'hidden';

            let tableHtml = `
                <div class="card" style="width: 100%;">
                    <div class="table-container">
                        <table class="data-table analysis-table" id="all-kingdom-list-table">
                            <thead>
                                <tr>
                                    <th data-sort="id" style="cursor:pointer;">Kingdom ⇅</th>
                                    <th data-sort="start" style="cursor:pointer;">Total Start Power ⇅</th>
                                    <th data-sort="end" style="cursor:pointer;">Total End Power ⇅</th>
                                    <th data-sort="pwrDelta" style="cursor:pointer;">Power Δ ⇅</th>
                                    <th data-sort="kp" style="cursor:pointer;">KP Gained ⇅</th>
                                    <th data-sort="deads" style="cursor:pointer;">Dead Troops ⇅</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            const validKingdoms = Object.keys(reportsMap).map(id => ({ id: parseInt(id), report: reportsMap[id] }));

            // Default sort by Kingdom ID Ascending
            validKingdoms.sort((a, b) => a.id - b.id);

            if (validKingdoms.length === 0) {
                tableHtml += `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No valid Kingdom Scans available for analysis.</td></tr>`;
            } else {
                validKingdoms.forEach(k => {
                    const r = k.report;
                    const pwrColor = r.kingdomTotalPower >= 0 ? 'var(--positive-color, #4ade80)' : 'var(--danger-color, #ef4444)';
                    const pwrSign = r.kingdomTotalPower > 0 ? '+' : '';

                    tableHtml += `
                        <tr>
                            <td style="font-weight: bold; font-size: 1.1em; color: var(--accent-primary);">Kingdom ${k.id}</td>
                            <td style="color: var(--text-muted);">${fmt(r.kingdomTotalStartPower)}</td>
                            <td style="color: var(--text-muted);">${fmt(r.kingdomTotalEndPower)}</td>
                            <td style="font-weight: bold; color: ${pwrColor};">${pwrSign}${fmt(r.kingdomTotalPower)}</td>
                            <td style="font-weight: bold; color: var(--accent-primary, #6366f1);">+${fmt(r.kingdomTotalKP)}</td>
                            <td style="font-weight: bold; color: #f59e0b;">+${fmt(r.kingdomTotalDeads)}</td>
                        </tr>
                    `;
                });
            }

            tableHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.innerHTML = tableHtml;

            // Attach sorting to the list view table
            const listTable = document.getElementById('all-kingdom-list-table');
            if (listTable) {
                let currentSort = { key: 'id', dir: 'asc' };
                listTable.querySelectorAll('th').forEach(th => {
                    th.addEventListener('click', () => {
                        const key = th.dataset.sort;
                        if (!key) return;

                        if (currentSort.key === key) {
                            currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
                        } else {
                            currentSort.key = key;
                            currentSort.dir = 'desc';
                        }

                        validKingdoms.sort((a, b) => {
                            let valA, valB;
                            switch (key) {
                                case 'id': valA = a.id; valB = b.id; break;
                                case 'start': valA = a.report.kingdomTotalStartPower; valB = b.report.kingdomTotalStartPower; break;
                                case 'end': valA = a.report.kingdomTotalEndPower; valB = b.report.kingdomTotalEndPower; break;
                                case 'pwrDelta': valA = a.report.kingdomTotalPower; valB = b.report.kingdomTotalPower; break;
                                case 'kp': valA = a.report.kingdomTotalKP; valB = b.report.kingdomTotalKP; break;
                                case 'deads': valA = a.report.kingdomTotalDeads; valB = b.report.kingdomTotalDeads; break;
                            }
                            if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
                            if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
                            return 0;
                        });

                        // Re-render rows
                        let tbodyHtml = '';
                        validKingdoms.forEach(k => {
                            const r = k.report;
                            const pwrColor = r.kingdomTotalPower >= 0 ? 'var(--positive-color, #4ade80)' : 'var(--danger-color, #ef4444)';
                            const pwrSign = r.kingdomTotalPower > 0 ? '+' : '';
                            tbodyHtml += `
                                <tr>
                                    <td style="font-weight: bold; font-size: 1.1em; color: var(--accent-primary);">Kingdom ${k.id}</td>
                                    <td style="color: var(--text-muted);">${fmt(r.kingdomTotalStartPower)}</td>
                                    <td style="color: var(--text-muted);">${fmt(r.kingdomTotalEndPower)}</td>
                                    <td style="font-weight: bold; color: ${pwrColor};">${pwrSign}${fmt(r.kingdomTotalPower)}</td>
                                    <td style="font-weight: bold; color: var(--accent-primary, #6366f1);">+${fmt(r.kingdomTotalKP)}</td>
                                    <td style="font-weight: bold; color: #f59e0b;">+${fmt(r.kingdomTotalDeads)}</td>
                                </tr>
                            `;
                        });
                        listTable.querySelector('tbody').innerHTML = tbodyHtml;
                    });
                });
            }

        } else {
            // ================== CARD VIEW (Existing) ==================
            container.style.flexDirection = 'row';
            container.style.overflowX = 'auto';

            kingdoms.forEach(kId => {
                const kState = dataService.state.kingdoms[kId];
                if (!kState || !kState.startData || kState.startData.length === 0 || !kState.endData || kState.endData.length === 0) {
                    totalHtml += `
                        <div style="margin-bottom: 30px; border: 1px dashed var(--border-color); border-radius: 8px; padding: 20px; text-align: center; color: var(--text-muted);">
                            <span style="font-size: 1.5em; margin-right: 10px;">⚠️</span>
                            Kingdom ${kId} is missing either a Start Scan or an End Scan and cannot be analyzed.
                        </div>
                     `;
                } else {
                    const report = reportsMap[kId];
                    // Wrap the generated HTML in a recognizable div block for the listeners
                    totalHtml += `
                        <div class="all-kingdom-card" id="all-kingdom-card-${kId}" style="min-width: 520px; max-width: 650px; flex: 1 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3); background: var(--card-bg); border-radius: 8px;">
                            ${this.generateAnalysisHTML(report, kId, true, true)}
                        </div>
                     `;
                }
            });

            container.innerHTML = totalHtml;

            // Re-attach listeners explicitly to each specific table within this view
            kingdoms.forEach(kId => {
                if (reportsMap[kId]) {
                    const wrapper = document.getElementById(`all-kingdom-card-${kId}`);
                    if (wrapper) this.attachSortingListeners(wrapper, reportsMap[kId], true);
                }
            });
        }
    }
}

window.UIKingdomAnalysis = UIKingdomAnalysis;
