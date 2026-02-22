// ==========================================
// SERVICE: UI RENDERERS
// ==========================================
Object.assign(UIService.prototype, {
    renderKingdomComparison() {
        const tbody = document.querySelector('#kingdomComparisonTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const limitSelect = document.getElementById('kingdomComparisonLimit');
        const limitVal = limitSelect ? limitSelect.value : 'all';

        const t4Weight = parseFloat(document.getElementById('allKingdomT4Weight')?.value) || 10;
        const t5Weight = parseFloat(document.getElementById('allKingdomT5Weight')?.value) || 20;
        const deadWeight = parseFloat(document.getElementById('allKingdomDeadWeight')?.value) || 30;

        if (this.data.state.loadedKingdoms.size === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No kingdoms loaded. Upload scans to begin.</td></tr>';
            return;
        }

        let hasData = false;
        this.data.state.loadedKingdoms.forEach(kingdomId => {
            const kState = this.data.state.kingdoms[kingdomId];
            if (!kState) return;

            if (!kState.calculatedData || kState.calculatedData.length === 0) {
                const tr = document.createElement('tr');
                let statusMsg = 'No Data';
                if (kState.startData.length === 0 && kState.endData.length === 0) statusMsg = 'No Data';
                else if (kState.startData.length === 0) statusMsg = 'Missing Start Scan';
                else if (kState.endData.length === 0) statusMsg = 'Missing End Scan';
                else statusMsg = 'Calculation Pending';

                tr.innerHTML = `<td>${kingdomId}</td><td colspan="8" style="text-align:center; color: var(--text-secondary); font-style: italic;">${statusMsg} - Upload missing file to see results</td>`;
                tbody.appendChild(tr);
                return;
            }

            hasData = true;
            let processedData = [...kState.calculatedData];
            if (limitVal !== 'all') {
                const limit = parseInt(limitVal);
                processedData.sort((a, b) => (b.startPower || 0) - (a.startPower || 0));
                processedData = processedData.slice(0, limit);
            }

            let stats = { startPower: 0, powerDiff: 0, troopPower: 0, t4: 0, t5: 0, deads: 0, healed: 0, kp: 0, dkp: 0 };
            processedData.forEach(p => {
                stats.startPower += p.startPower || 0;
                stats.powerDiff += p.powerDiff || 0;
                stats.troopPower += p.troopPowerDiff || 0;
                stats.t4 += p.t4 || 0;
                stats.t5 += p.t5 || 0;
                stats.deads += p.deads || 0;
                stats.healed += p.healed || 0;
            });

            // Dynamically calculate KP and DKP based on input multipliers
            stats.kp = (stats.t4 * t4Weight) + (stats.t5 * t5Weight);
            stats.dkp = stats.kp + (stats.deads * deadWeight);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${kingdomId}</td>
                <td>${stats.startPower.toLocaleString()}</td>
                <td class="${stats.powerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.powerDiff.toLocaleString()}</td>
                <td class="${stats.troopPower >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.troopPower.toLocaleString()}</td>
                <td>${stats.t4.toLocaleString()}</td>
                <td>${stats.t5.toLocaleString()}</td>
                <td>${stats.deads.toLocaleString()}</td>
                <td>${stats.healed.toLocaleString()}</td>
                <td>${stats.kp.toLocaleString()}</td>
                <td>${Math.round(stats.dkp).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });

        if (!hasData && tbody.innerHTML === '') {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No valid comparisons available.</td></tr>';
        }
    },

    createKingdomContent(kingdomId) {
        const clone = this.elements.kingdomContentTemplate.cloneNode(true);
        clone.id = `kingdom-${kingdomId}`;
        clone.style.display = 'none';
        clone.classList.add('kingdom-content');

        const subTabs = clone.querySelector('.kingdom-subtabs');
        if (subTabs) {
            subTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.subtab-btn');
                if (btn) this.switchSubTab(kingdomId, btn.dataset.subtab);
            });
        }

        const kConfig = this.data.state.kingdoms[kingdomId].config;
        clone.querySelectorAll('.config-input').forEach(input => {
            if (kConfig[input.name] !== undefined) input.value = kConfig[input.name];
            input.addEventListener('change', (e) => {
                const val = e.target.value;
                this.data.state.kingdoms[kingdomId].config[e.target.name] = isNaN(val) ? val : parseFloat(val);
            });
        });

        const dkpSystemSelect = clone.querySelector('.dkp-system-select');
        const advancedInputs = clone.querySelector('.advanced-dkp-inputs');
        const basicInputs = clone.querySelector('.basic-dkp-inputs');

        if (dkpSystemSelect && advancedInputs && basicInputs) {
            const toggleInputs = () => {
                if (dkpSystemSelect.value === 'basic') {
                    advancedInputs.classList.add('hidden');
                    basicInputs.classList.remove('hidden');
                } else {
                    basicInputs.classList.add('hidden');
                    advancedInputs.classList.remove('hidden');
                }
            };
            dkpSystemSelect.addEventListener('change', toggleInputs);
            toggleInputs(); // Initial setup
        }

        const nextBtn = clone.querySelector('.next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.switchSubTab(kingdomId, 'results'));

        const calcBtn = clone.querySelector('.calculate-btn');
        if (calcBtn) calcBtn.addEventListener('click', () => {
            CalculationService.calculateKingdom(kingdomId, this.data.state);
            this.renderResultsTable(kingdomId, this.data.state.kingdoms[kingdomId].calculatedData);
        });

        const exportBtn = clone.querySelector('.export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToCSV(kingdomId));

        const attachSearch = (selector, handler) => {
            const el = clone.querySelector(selector);
            if (el) el.addEventListener('input', Utils.debounce((e) => handler.call(this, kingdomId, e.target.value.toLowerCase().trim()), 300));
        };

        attachSearch('.scatter-search', this.updateScatterHighlight);
        attachSearch('.overview-search', this.filterOverviewTable);
        attachSearch('.efficiency-search', this.updateEfficiencyHighlight);
        attachSearch('.results-search', this.filterResultsTable);

        const logToggle = clone.querySelector('.roster-log-toggle');
        const limitSelect = clone.querySelector('.roster-limit-select');

        if (logToggle && limitSelect) {
            const updateRoster = () => {
                const kState = this.data.state.kingdoms[kingdomId];
                const data = kState.startData.length > 0 ? kState.startData : kState.endData;
                if (data.length > 0) {
                    this.renderRosterAnalysis(kingdomId, data, logToggle.checked, parseInt(limitSelect.value));
                }
            };
            logToggle.addEventListener('change', updateRoster);
            limitSelect.addEventListener('change', updateRoster);
        }

        // Results Table Sort
        clone.querySelectorAll('.dkp-table th').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(kingdomId, th.dataset.sort, false);
            });
        });

        this.elements.kingdomsContainer.appendChild(clone);
    },

    handleSort(kingdomId, sortKey, isGovernance) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (kState.lastSortCol === sortKey) kState.sortDirection *= -1;
        else { kState.sortDirection = 1; kState.lastSortCol = sortKey; }

        kState.calculatedData.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            // Handle undefined/null safely
            if (valA === undefined || valA === null) valA = -Infinity;
            if (valB === undefined || valB === null) valB = -Infinity;

            if (valA < valB) return -1 * kState.sortDirection;
            if (valA > valB) return 1 * kState.sortDirection;
            return 0;
        });

        this.renderResultsTable(kingdomId, kState.calculatedData);
    },

    renderResultsTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;

        // Fix: Target specifically the results table, not the overview table (which also has .dkp-table)
        const resultsSection = container.querySelector('.results-section');
        if (!resultsSection) return;

        const tbody = resultsSection.querySelector('.dkp-table tbody');
        if (!tbody) return;

        // Ensure results section is visible if data exists
        if (data && data.length > 0) resultsSection.classList.remove('hidden');

        const kConfig = this.data.state.kingdoms[kingdomId].config;
        const isBasic = kConfig.dkpSystem === 'basic';

        // Adjust Table Headers
        const thead = resultsSection.querySelector('.dkp-table thead tr');
        if (thead) {
            const thList = Array.from(thead.querySelectorAll('th'));
            const toggleHeader = (sortKey, show) => {
                const th = thList.find(t => t.dataset.sort === sortKey);
                if (th) th.style.display = show ? '' : 'none';
            };

            toggleHeader('targetKP', !isBasic);
            toggleHeader('kpPercent', !isBasic);
            toggleHeader('targetDeads', !isBasic);
            toggleHeader('deadPercent', !isBasic);
            toggleHeader('totalDKPPercent', !isBasic);

            // If basic, we need a column for Basic Total DKP. If we don't have one, create it.
            let thBasic = thList.find(t => t.dataset.sort === 'basicTotalDKP');
            if (isBasic) {
                if (!thBasic) {
                    thBasic = document.createElement('th');
                    thBasic.dataset.sort = 'basicTotalDKP';
                    thBasic.textContent = 'Total DKP';
                    // insert before bonus
                    const thBonus = thList.find(t => t.dataset.sort === 'bonus');
                    thead.insertBefore(thBasic, thBonus);
                }
                thBasic.style.display = '';
            } else if (thBasic) {
                thBasic.style.display = 'none';
            }
        }

        try {
            const fragment = document.createDocumentFragment();
            tbody.innerHTML = '';

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="19" style="text-align:center; padding: 20px;">No matching data found. Check your filters (Top N, TH25) or uploaded files.</td></tr>`;
                return;
            }

            data.forEach(row => {
                const tr = document.createElement('tr');
                const status = row.status || 'Sleeper';
                const statusClass = `status-${status.toLowerCase()}`;

                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td>${row.name}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${(row.startPower || 0).toLocaleString()}</td>
                    <td class="${(row.powerDiff || 0) >= 0 ? 'status-complete' : 'status-incomplete'}">${(row.powerDiff || 0).toLocaleString()}</td>
                    <td class="${(row.troopPowerDiff || 0) >= 0 ? 'status-complete' : 'status-incomplete'}">${(row.troopPowerDiff || 0).toLocaleString()}</td>
                    <td>${(row.t1 || 0).toLocaleString()}</td>
                    <td>${(row.t2 || 0).toLocaleString()}</td>
                    <td>${(row.t3 || 0).toLocaleString()}</td>
                    <td>${(row.t4 || 0).toLocaleString()}</td>
                    <td>${(row.t5 || 0).toLocaleString()}</td>
                    <td>${(row.t4t5 || 0).toLocaleString()}</td>
                    <td>${(row.deads || 0).toLocaleString()}</td>
                    <td>${(row.rssGathered || 0).toLocaleString()}</td>
                    <td>${(row.kvkKP || 0).toLocaleString()}</td>
                    ${!isBasic ? `
                    <td>${Math.round(row.targetKP || 0).toLocaleString()}</td>
                    <td class="${(row.kpPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}">${(row.kpPercent || 0)}%</td>
                    <td>${Math.round(row.targetDeads || 0).toLocaleString()}</td>
                    <td class="${(row.deadPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}">${(row.deadPercent || 0)}%</td>
                    <td class="${(row.totalDKPPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}"><span class="total-dkp">${(row.totalDKPPercent || 0)}%</span></td>
                    ` : `
                    <td><span class="total-dkp">${(row.basicTotalDKP || 0).toLocaleString()}</span></td>
                    `}
                    <td><input type="number" class="bonus-input" data-id="${row.id}" value="${row.bonus || 0}" step="1"></td>
                `;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
            this.attachBonusListeners(kingdomId);
        } catch (e) {
            console.error("Render Error:", e);
            tbody.innerHTML = `<tr><td colspan="19" style="color:red">Error rendering table. Check console.</td></tr>`;
        }
    },

    attachBonusListeners(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        const config = this.data.state.kingdoms[kingdomId].config;
        const isBasic = config.dkpSystem === 'basic';

        container.querySelectorAll('.bonus-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.dataset.id;
                const newBonus = parseFloat(e.target.value) || 0;
                const row = this.data.state.kingdoms[kingdomId].calculatedData.find(r => r.id === id);

                if (row) {
                    row.bonus = newBonus;

                    const tr = e.target.closest('tr');
                    const totalCell = tr.querySelector('.total-dkp');
                    const totalTd = totalCell.parentElement;

                    if (isBasic) {
                        const baseScore = row.kvkKP + (row.deads * config.basicDeadsPoints);
                        row.basicTotalDKP = Math.round(baseScore + newBonus);
                        totalCell.textContent = row.basicTotalDKP.toLocaleString();
                        // Basic table doesn't map full/incomplete status based on 100% target
                        totalTd.className = '';
                    } else {
                        let baseScore = 0;
                        if (row.targetKP > 0 && row.targetDeads > 0) baseScore = (row.kpPercent + row.deadPercent) / 2;
                        else if (row.targetKP > 0) baseScore = row.kpPercent;
                        else if (row.targetDeads > 0) baseScore = row.deadPercent;

                        row.totalDKPPercent = parseFloat((baseScore + newBonus).toFixed(2));
                        totalCell.textContent = row.totalDKPPercent + '%';
                        totalTd.className = row.totalDKPPercent >= 100 ? 'status-complete' : 'status-incomplete';
                    }
                }
            });
        });
    },

    updateOverview(kingdomId) {
        const kState = this.data.state.kingdoms[kingdomId];
        const startFiltered = Utils.getFilteredData(kState.startData, this.data.state.filterTownHall25);
        const endFiltered = Utils.getFilteredData(kState.endData, this.data.state.filterTownHall25);

        let data = [];
        if (startFiltered.length > 0 && endFiltered.length > 0) {
            data = CalculationService.calculateOverviewDiff(startFiltered, endFiltered);
        } else if (startFiltered.length > 0) {
            data = startFiltered;
        }

        kState.currentOverviewData = data;

        // Populate Alliance Filter
        this.updateAllianceFilter(kingdomId, data);

        // Render Initial Table
        this.renderOverviewTable(kingdomId, data);

        // Setup Export Listener (once)
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const exportBtn = container.querySelector('.overview-export-btn');
        if (exportBtn && !exportBtn.dataset.hasListener) {
            exportBtn.addEventListener('click', () => {
                const currentData = this.getCurrentFilteredOverviewData(kingdomId);
                this.exportOverviewCSV(kingdomId, currentData);
            });
            exportBtn.dataset.hasListener = 'true';
        }
    },

    updateAllianceFilter(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const select = container.querySelector('.overview-alliance-filter');
        if (!select) return;

        const currentVal = select.value;
        const alliances = new Set(data.map(r => r['Alliance Tag']).filter(a => a && a !== '-'));
        const sortedAlliances = Array.from(alliances).sort();

        select.innerHTML = '<option value="">All Alliances</option>';
        sortedAlliances.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.toLowerCase(); // Normalized value
            option.textContent = tag;
            select.appendChild(option);
        });

        // Restore selection if valid
        if (currentVal && alliances.has(select.querySelector(`option[value="${currentVal}"]`)?.textContent)) {
            select.value = currentVal;
        }

        // Add Listener if needed
        if (!select.dataset.hasListener) {
            select.addEventListener('change', () => {
                const searchInput = container.querySelector('.overview-search');
                this.filterOverviewTable(kingdomId, searchInput ? searchInput.value : '');
            });
            select.dataset.hasListener = 'true';
        }
    },

    getCurrentFilteredOverviewData(kingdomId) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState.currentOverviewData) return [];

        const container = document.getElementById(`kingdom-${kingdomId}`);
        const searchInput = container.querySelector('.overview-search');
        const allianceSelect = container.querySelector('.overview-alliance-filter');

        const query = searchInput ? searchInput.value.toLowerCase() : '';
        const allianceFilter = allianceSelect ? allianceSelect.value.toLowerCase() : '';

        return kState.currentOverviewData.filter(r => {
            const name = r['Governor Name'] ? r['Governor Name'].toLowerCase() : '';
            const id = r['Governor ID'] ? r['Governor ID'].toString() : '';
            const alliance = r['Alliance Tag'] ? r['Alliance Tag'].toLowerCase() : '';

            const matchesSearch = name.includes(query) || id.includes(query);
            const matchesAlliance = allianceFilter === '' || alliance === allianceFilter;

            return matchesSearch && matchesAlliance;
        });
    },

    filterOverviewTable(kingdomId, query) {
        const filtered = this.getCurrentFilteredOverviewData(kingdomId);
        this.renderOverviewTable(kingdomId, filtered);
    },

    filterResultsTable(kingdomId, query) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState.calculatedData) return;
        // Don't modify calculatedData directly, just re-render with filter
        const filtered = kState.calculatedData.filter(r => {
            const name = r.name ? r.name.toLowerCase() : '';
            const id = r.id ? r.id.toString() : '';
            return name.includes(query) || id.includes(query);
        });
        this.renderResultsTable(kingdomId, filtered);
    },

    renderOverviewTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const table = container.querySelector('.overview-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!data || data.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td>No data available matching filter.</td></tr>';
            return;
        }

        // Filter out internal '_raw_' keys
        const headers = Object.keys(data[0]).filter(h => !h.startsWith('_') && h !== 'Kingdom');
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        const fragment = document.createDocumentFragment();

        const fmtDiff = (n) => {
            if (n === 0 || n === '-') return '<span class="diff-neutral">-</span>';
            const num = Utils.parseNumber(n);
            if (num > 0) return `<span class="diff-pos text-success">+${num.toLocaleString()}</span>`;
            if (num < 0) return `<span class="diff-neg text-danger">${num.toLocaleString()}</span>`;
            return '<span class="diff-neutral">-</span>';
        };

        const fmtVal = (n) => {
            if (n === 0 || n === '-') return '-';
            return Utils.parseNumber(n).toLocaleString();
        };

        data.forEach(row => {
            const tr = document.createElement('tr');

            const rowHTML = headers.map(h => {
                let val = row[h];

                // If it's a Delta column, format with colors
                if (h.includes('(Δ)')) {
                    val = fmtDiff(val);
                }
                // If it's a Start/End numeric column, format with commas
                else if (h.includes('(Start)') || h.includes('(End)')) {
                    val = fmtVal(val);
                }

                return `<td>${val}</td>`;
            }).join('');

            tr.innerHTML = rowHTML;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        this.syncOverviewScroll(kingdomId);
    },

    syncOverviewScroll(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        const table = container.querySelector('.overview-table');
        const topScroll = container.querySelector('.top-scroll-wrapper');
        const content = topScroll.querySelector('.top-scroll-content');
        const tableContainer = container.querySelector('.table-container');

        if (table && content && topScroll && tableContainer) {
            content.style.width = table.offsetWidth + 'px';
            topScroll.onscroll = () => { tableContainer.scrollLeft = topScroll.scrollLeft; };
            tableContainer.onscroll = () => { topScroll.scrollLeft = tableContainer.scrollLeft; };
        }
    },

    renderCommandCenter() {
        this.updateCommandKingdomDropdown();

        // Toggle Sections
        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                modeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const mode = e.target.dataset.mode;
                document.querySelectorAll('.command-section').forEach(el => el.classList.add('hidden'));
                const target = document.getElementById(`${mode}-ui`);
                if (target) target.classList.remove('hidden');
            });
        });

        // Helper: Ensure we don't attach duplicate listeners if render is called multiple times
        const genCardBtn = document.getElementById('generateCardBtn');
        if (genCardBtn && !genCardBtn.dataset.hasListener) {
            genCardBtn.addEventListener('click', () => this.handleGenerateReportCard());
            genCardBtn.dataset.hasListener = 'true';
        }

        const genSquadsBtn = document.getElementById('generateSquadsBtn');
        if (genSquadsBtn && !genSquadsBtn.dataset.hasListener) {
            genSquadsBtn.addEventListener('click', () => this.handleBalanceSquads());
            genSquadsBtn.dataset.hasListener = 'true';
        }
    },

    renderReportCard(cardData) {
        const container = document.getElementById('reportCardContainer');
        if (!container) return;

        if (!cardData) {
            container.innerHTML = '<div class="empty-state" style="color:var(--danger-color)">Governor not found!</div>';
            return;
        }

        container.innerHTML = `
            <div class="report-card">
                <div class="card-header">
                    <h2 style="margin:0">${cardData.name}</h2>
                    <div style="color:var(--text-secondary)">[${cardData.alliance}] ${cardData.id}</div>
                    <div class="card-grade ${cardData.colorClass}">${cardData.grade}</div>
                    <div style="text-transform:uppercase; letter-spacing:2px; font-size:0.8rem; opacity:0.7">Combat Rating</div>
                </div>
                <div class="card-stats">
                    <div class="stat-box">
                        <div class="stat-label">Kill Points</div>
                        <div class="stat-value" style="color:#fbbf24">${cardData.stats.kp}</div>
                    </div>
                     <div class="stat-box">
                        <div class="stat-label">Dead</div>
                        <div class="stat-value" style="color:#ef4444">${cardData.stats.dead}</div>
                    </div>
                     <div class="stat-box">
                        <div class="stat-label">T4 Kills</div>
                        <div class="stat-value">${cardData.stats.t4}</div>
                    </div>
                     <div class="stat-box">
                        <div class="stat-label">T5 Kills</div>
                        <div class="stat-value">${cardData.stats.t5}</div>
                    </div>
                </div>
                <div style="margin-top:1.5rem; text-align:center; opacity:0.5; font-size:0.7rem;">
                    Generated by Unity Command Center
                </div>
            </div>
        `;
    },

    renderSquads(squads) {
        const container = document.getElementById('squadsOutput');
        if (!container) return;
        container.innerHTML = '';

        if (!squads || !squads.length) return;

        squads.forEach(squad => {
            const div = document.createElement('div');
            div.className = 'squad-column';
            div.innerHTML = `
                <div class="squad-header">${squad.name}</div>
                <ul class="squad-list">
                    ${squad.members.map(m => `
                        <li class="squad-member">
                            <span>${m.name}</span>
                            <span style="opacity:0.7">${CalculationService.formatNumber(m.power)}</span>
                        </li>
                    `).join('')}
                </ul>
                <div class="squad-summary">
                    <div>Total Power: <strong style="color:var(--accent-primary)">${CalculationService.formatNumber(squad.totalPower)}</strong></div>
                    <div>Total KP: <strong>${CalculationService.formatNumber(squad.totalKP)}</strong></div>
                    <div>Members: ${squad.members.length}</div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    updateNPWDDropdown() {
        const select = this.elements.npwdKingdomSelect;
        if (!select) return;
        select.innerHTML = '';
        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });
        if (this.data.state.loadedKingdoms.size > 0 && select.value === '') {
            select.value = Array.from(this.data.state.loadedKingdoms)[0];
            this.renderNewPhoneWhoDis(select.value);
        }
    },

    updatePrekvkDropdown() {
        const select = this.elements.prekvkKingdomSelect;
        if (!select) return;
        select.innerHTML = '';
        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });
        if (this.data.state.loadedKingdoms.size > 0 && select.value === '') {
            select.value = Array.from(this.data.state.loadedKingdoms)[0];
            select.dispatchEvent(new Event('change'));
        }
    },

    renderPreKVKRanking() {
        const tbody = document.querySelector('#rankingTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const limitStr = this.elements.rankingGovCountSelect ? this.elements.rankingGovCountSelect.value : '300';
        const limit = limitStr === 'all' ? Infinity : parseInt(limitStr);

        if (this.data.state.loadedKingdoms.size === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No kingdoms loaded. Upload scans to begin.</td></tr>';
            return;
        }

        let rankingData = [];
        this.data.state.loadedKingdoms.forEach(kId => {
            const kState = this.data.state.kingdoms[kId];
            if (!kState.startData || kState.startData.length === 0) return;

            let validGovs = kState.startData.map(r => ({
                power: Utils.parseNumber(r['Power']),
                kp: Utils.parseNumber(r['Kill Points'])
            })).sort((a, b) => b.power - a.power);

            if (limit !== Infinity) validGovs = validGovs.slice(0, limit);

            rankingData.push({
                kingdom: kId,
                power: validGovs.reduce((sum, g) => sum + g.power, 0),
                kp: validGovs.reduce((sum, g) => sum + g.kp, 0)
            });
        });

        if (rankingData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No valid Start Scan data found.</td></tr>';
            return;
        }

        rankingData.sort((a, b) => b.power - a.power);
        rankingData.forEach((d, i) => d.powerRank = i + 1);

        const kpSorted = [...rankingData].sort((a, b) => b.kp - a.kp);
        const kpRankMap = new Map();
        kpSorted.forEach((d, i) => kpRankMap.set(d.kingdom, i + 1));
        rankingData.forEach(d => d.kpRank = kpRankMap.get(d.kingdom));

        const { key, dir } = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
        rankingData.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (key === 'rank') { valA = a.powerRank; valB = b.powerRank; }
            if (key === 'kingdom') { valA = parseInt(a.kingdom); valB = parseInt(b.kingdom); }
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        const headers = document.querySelectorAll('#rankingTable th[data-sort]');
        headers.forEach(th => {
            if (!th.dataset.hasListener) {
                th.addEventListener('click', () => {
                    const sortKey = th.dataset.sort;
                    const currentSort = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
                    if (currentSort.key === sortKey) {
                        currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
                    } else {
                        currentSort.key = sortKey;
                        currentSort.dir = 'desc';
                        if (sortKey === 'kingdom' || sortKey === 'rank' || sortKey.includes('Rank')) currentSort.dir = 'asc';
                    }
                    this.data.state.rankingSort = currentSort;
                    this.renderPreKVKRanking();
                });
                th.dataset.hasListener = 'true';
            }
            th.classList.remove('sort-asc', 'sort-desc');
            const currentSort = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
            if (th.dataset.sort === currentSort.key) th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        });

        rankingData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${index + 1}</td><td>${row.kingdom}</td><td>${row.power.toLocaleString()}</td><td>${row.kp.toLocaleString()}</td><td>${row.powerRank}</td><td>${row.kpRank}</td>`;
            tbody.appendChild(tr);
        });
    },

    renderNewPhoneWhoDis(kingdomId) {
        const newContainer = document.getElementById('newArrivalsContainer');
        const departContainer = document.getElementById('departuresContainer');
        if (!newContainer || !departContainer) return;

        if (!kingdomId) {
            newContainer.innerHTML = '<p>Please select a kingdom.</p>';
            departContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }

        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState) return;

        const startIds = new Set(kState.startData.map(r => r['Governor ID']));
        const endIds = new Set(kState.endData.map(r => r['Governor ID']));

        const newArrivals = kState.endData.filter(r => !startIds.has(r['Governor ID']));
        const departures = kState.startData.filter(r => !endIds.has(r['Governor ID']));

        const formatData = (list) => list.map(r => ({
            'Name': r['Governor Name'],
            'ID': r['Governor ID'],
            'Alliance': r['Alliance Tag'],
            'Power': Utils.parseNumber(r['Power'])
        })).sort((a, b) => b.Power - a.Power);

        this.renderAnalysisTable(formatData(newArrivals), newContainer);
        this.renderAnalysisTable(formatData(departures), departContainer);
    },

    renderKingdomAnalysis() {
        const data = [];
        const govCountLimit = this.elements.prekvkGovCountSelect ? this.elements.prekvkGovCountSelect.value : 'all';

        this.data.state.loadedKingdoms.forEach(kId => {
            const kState = this.data.state.kingdoms[kId];
            const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;
            if (!sourceData || sourceData.length === 0) return;

            let processedData = Utils.getFilteredData([...sourceData], this.data.state.filterTownHall25);
            if (govCountLimit !== 'all') {
                const limit = parseInt(govCountLimit);
                processedData.sort((a, b) => Utils.parseNumber(b['Power']) - Utils.parseNumber(a['Power']));
                processedData = processedData.slice(0, limit);
            }

            const totalPower = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Power']), 0);
            const totalDeads = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Deads']), 0);
            const totalT4 = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['T4 Kills']), 0);
            const totalT5 = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['T5 Kills']), 0);
            const totalKP = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Kill Points']), 0);

            data.push({
                'Kingdom': kId,
                'Gov Count': processedData.length,
                'Total Power': totalPower,
                'Total Deads': totalDeads,
                'Total T4 Kills': totalT4,
                'Total T5 Kills': totalT5,
                'Total KP': totalKP
            });
        });

        data.sort((a, b) => b['Total Power'] - a['Total Power']);
        this.renderAnalysisTable(data, this.elements.kingdomAnalysisContainer);
    },

    renderAllianceAnalysis(kingdomId) {
        if (!kingdomId) {
            if (this.elements.allianceAnalysisContainer) this.elements.allianceAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = this.data.state.kingdoms[kingdomId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!kState || !sourceData || sourceData.length === 0) {
            if (this.elements.allianceAnalysisContainer) this.elements.allianceAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = Utils.getFilteredData(sourceData, this.data.state.filterTownHall25);
        const allianceMap = {};
        filteredData.forEach(row => {
            const tag = row['Alliance Tag'] || 'No Tag';
            if (!allianceMap[tag]) {
                allianceMap[tag] = { 'Alliance': tag, 'Count': 0, 'Power': 0, 'Deads': 0, 'T4 Kills': 0, 'T5 Kills': 0, 'Kill Points': 0 };
            }
            allianceMap[tag]['Count']++;
            allianceMap[tag]['Power'] += Utils.parseNumber(row['Power']);
            allianceMap[tag]['Deads'] += Utils.parseNumber(row['Deads']);
            allianceMap[tag]['T4 Kills'] += Utils.parseNumber(row['T4 Kills']);
            allianceMap[tag]['T5 Kills'] += Utils.parseNumber(row['T5 Kills']);
            allianceMap[tag]['Kill Points'] += Utils.parseNumber(row['Kill Points']);
        });

        const data = Object.values(allianceMap).sort((a, b) => b['Power'] - a['Power']);
        this.renderAnalysisTable(data, this.elements.allianceAnalysisContainer);
    },

    renderGovernorAnalysis(kingdomId) {
        if (!kingdomId) {
            if (this.elements.governorAnalysisContainer) this.elements.governorAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = this.data.state.kingdoms[kingdomId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!kState || !sourceData || sourceData.length === 0) {
            if (this.elements.governorAnalysisContainer) this.elements.governorAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = Utils.getFilteredData(sourceData, this.data.state.filterTownHall25);
        const sorted = [...filteredData].sort((a, b) => Utils.parseNumber(b['Power']) - Utils.parseNumber(a['Power'])).slice(0, 100);
        const data = sorted.map(row => ({
            'Name': row['Governor Name'],
            'ID': row['Governor ID'],
            'Alliance': row['Alliance Tag'],
            'Power': Utils.parseNumber(row['Power']),
            'Deads': Utils.parseNumber(row['Deads']),
            'T4 Kills': Utils.parseNumber(row['T4 Kills']),
            'T5 Kills': Utils.parseNumber(row['T5 Kills']),
            'Kill Points': Utils.parseNumber(row['Kill Points'])
        }));

        this.renderAnalysisTable(data, this.elements.governorAnalysisContainer);
    },

    renderAnalysisTable(data, container) {
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = '<p>No data available.</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        const numericHeaders = headers.filter(h => typeof data[0][h] === 'number');
        const maxValues = {};
        numericHeaders.forEach(h => maxValues[h] = Math.max(...data.map(row => row[h])));

        let html = '<table class="prekvk-table"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                let style = '';
                const val = row[h];
                if (numericHeaders.includes(h) && maxValues[h] > 0) {
                    const intensity = (val / maxValues[h]);
                    const alpha = Math.max(0.1, intensity * 0.8);
                    style = `style="background-color: rgba(139, 92, 246, ${alpha}); color: ${intensity > 0.6 ? 'white' : 'var(--text-primary)'}"`;
                }
                html += `<td ${style}>${typeof val === 'number' ? val.toLocaleString() : val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },



});
