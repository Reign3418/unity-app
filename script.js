document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        mainTabs: document.getElementById('mainTabs'),
        kingdomsContainer: document.getElementById('kingdomsContainer'),
        kingdomContentTemplate: document.getElementById('kingdomContentTemplate'),
        startFile: document.getElementById('startFile'),
        endFile: document.getElementById('endFile'),
        startScanDetails: document.getElementById('startScanDetails'),
        endScanDetails: document.getElementById('endScanDetails'),
        resetDataBtn: document.getElementById('resetDataBtn'),
        prekvkKingdomSelect: document.getElementById('prekvkKingdomSelect'),
        prekvkGovCountSelect: document.getElementById('prekvkGovCountSelect'),
        kingdomAnalysisContainer: document.getElementById('kingdomAnalysisContainer'),
        allianceAnalysisContainer: document.getElementById('allianceAnalysisContainer'),
        governorAnalysisContainer: document.getElementById('governorAnalysisContainer'),
        townHallFilter: document.getElementById('townHallFilter')
    };

    // --- App State ---
    const AppState = {
        kingdoms: {},
        activeKingdomId: null,
        startScanDate: null,
        endScanDate: null,
        loadedKingdoms: new Set(),
        filterTownHall25: false
    };

    // --- Utilities ---
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const parseNumber = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.replace(/,/g, '')) || 0;
    };

    const safeQuerySelector = (selector, parent = document) => {
        return parent.querySelector(selector);
    };

    const getFilteredData = (data) => {
        if (!data) return [];
        if (!AppState.filterTownHall25) return data;
        return data.filter(row => {
            const th = parseNumber(row['Town Hall']);
            return th === 25;
        });
    };

    const activateTab = (container, tabSelector, contentSelector, activeId, datasetKey = 'tab') => {
        if (!container) return;

        // Update Buttons
        container.querySelectorAll(tabSelector).forEach(btn => {
            btn.classList.toggle('active', btn.dataset[datasetKey] === activeId);
        });

        // Update Content
        if (datasetKey === 'tab') {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(activeId);
            if (content) content.classList.add('active');
        } else {
            container.querySelectorAll(contentSelector).forEach(content => {
                content.classList.toggle('active', content.dataset.content === activeId);
            });
        }
    };

    // --- Event Listeners ---

    // Filter Listener
    if (elements.townHallFilter) {
        elements.townHallFilter.addEventListener('change', (e) => {
            AppState.filterTownHall25 = e.target.checked;

            // Re-render active view
            const activeMainTab = document.querySelector('.tab-btn.active');
            if (activeMainTab) {
                const tabId = activeMainTab.dataset.tab;
                if (tabId === 'prekvk-analysis') {
                    const activeSubTab = document.querySelector('.prekvk-subtabs .subtab-btn.active');
                    if (activeSubTab) switchPrekvkSubTab(activeSubTab.dataset.subtab);
                } else if (tabId === 'all-kingdom-results') {
                    renderKingdomComparison();
                } else if (tabId.startsWith('kingdom-')) {
                    const kId = tabId.replace('kingdom-', '');
                    // Re-calculate if needed or just update overview
                    if (AppState.kingdoms[kId].calculatedData.length > 0) calculateKingdom(kId);
                    updateOverview(kId);
                }
            }
        });
    }

    // Main Tab Switching
    if (elements.mainTabs) {
        elements.mainTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                const tabId = e.target.dataset.tab;
                if (tabId.startsWith('kingdom-')) {
                    const kingdomId = tabId.replace('kingdom-', '');
                    switchKingdom(kingdomId);
                } else {
                    switchMainTab(tabId);
                }
            }
        });
    }

    // File Inputs
    const handleFileUpload = async (file, type) => {
        if (!file) return;
        try {
            const result = await parseFile(file);

            if (type === 'start') {
                AppState.startScanDate = result.date;
                updateScanDetails('start', result.date, result.kingdoms);
            } else {
                AppState.endScanDate = result.date;
                updateScanDetails('end', result.date, result.kingdoms);
            }

            // Distribute data
            result.data.forEach(row => {
                const kId = row['_kingdom'];
                if (!kId) return;

                if (!AppState.kingdoms[kId]) {
                    AppState.kingdoms[kId] = createKingdomState();
                    AppState.loadedKingdoms.add(kId);
                }

                if (type === 'start') AppState.kingdoms[kId].startData.push(row);
                else AppState.kingdoms[kId].endData.push(row);
            });

            saveState();
            renderKingdomTabs();

            if (type === 'end') {
                AppState.loadedKingdoms.forEach(kId => {
                    calculateKingdom(kId);
                });
            }

            alert(`${type === 'start' ? 'Start' : 'End'} scan loaded successfully!`);
        } catch (error) {
            console.error(error);
            alert(`Error parsing ${type} file: ${error.message}`);
        }
    };

    if (elements.startFile) elements.startFile.addEventListener('change', (e) => handleFileUpload(e.target.files[0], 'start'));
    if (elements.endFile) elements.endFile.addEventListener('change', (e) => handleFileUpload(e.target.files[0], 'end'));

    if (elements.resetDataBtn) {
        elements.resetDataBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data and start fresh? This action cannot be undone.')) {
                localStorage.removeItem('dkp_kingdoms');
                localStorage.removeItem('dkp_loadedKingdoms');
                localStorage.removeItem('dkp_scanDates');
                location.reload();
            }
        });
    }

    // --- Drag & Drop ---
    function setupDropZone(dropZoneId, inputId) {
        const dropZone = document.getElementById(dropZoneId);
        const input = document.getElementById(inputId);
        if (!dropZone || !input) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    setupDropZone('startDropZone', 'startFile');
    setupDropZone('endDropZone', 'endFile');

    // --- Core Functions ---

    function createKingdomState() {
        return {
            startData: [],
            endData: [],
            calculatedData: [],
            currentOverviewData: [],
            config: {
                deadsMultiplier: 0.02,
                deadsWeight: 50,
                kpPowerDivisor: 3,
                t5MixRatio: 0.7,
                kpMultiplier: 1.25,
                t4Points: 10,
                t5Points: 20
            },
            sortDirection: 1,
            lastSortCol: '',
            scatterChart: null,
            efficiencyChart: null,
            rosterScatterChart: null
        };
    }

    function switchMainTab(tabId) {
        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');
        activateTab(elements.mainTabs, '.tab-btn', null, tabId, 'tab');

        if (tabId === 'prekvk-analysis') {
            const activeSubTabBtn = document.querySelector('.prekvk-subtabs .subtab-btn.active');
            const subTabId = activeSubTabBtn ? activeSubTabBtn.dataset.subtab : 'kingdom-analysis';
            switchPrekvkSubTab(subTabId);
        } else if (tabId === 'all-kingdom-results') {
            renderKingdomComparison();
        }

        AppState.activeKingdomId = null;
    }

    function switchKingdom(kingdomId) {
        AppState.activeKingdomId = kingdomId;
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');

        const btn = elements.mainTabs.querySelector(`[data-tab="kingdom-${kingdomId}"]`);
        if (btn) btn.classList.add('active');

        const content = document.getElementById(`kingdom-${kingdomId}`);
        if (content) {
            content.style.display = 'block';
            if (!content.querySelector('.subtab-content.active')) {
                switchSubTab(kingdomId, 'overview');
            }
            updateOverview(kingdomId);
        }
    }

    function switchSubTab(kingdomId, subTabId) {
        const kingdomContainer = document.getElementById(`kingdom-${kingdomId}`);
        if (!kingdomContainer) return;

        activateTab(kingdomContainer, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        if (subTabId === 'overview') syncOverviewScroll(kingdomId);
        else if (subTabId === 'scatter') {
            const kState = AppState.kingdoms[kingdomId];
            const data = kState.calculatedData.length > 0 ? kState.calculatedData : kState.currentOverviewData;
            // Filter applied in calculation or overview update, so data here is already processed or raw
            // Note: Scatter uses calculatedData or overviewData. If calculatedData exists, it was filtered during calc.
            // If overviewData, it was filtered during updateOverview.
            if (data.length > 0) renderScatterChart(kingdomId, data);
        } else if (subTabId === 'efficiency') {
            const kState = AppState.kingdoms[kingdomId];
            if (kState.calculatedData.length > 0) renderPowerEfficiencyChart(kingdomId, kState.calculatedData);
        } else if (subTabId === 'roster-analysis') {
            const kState = AppState.kingdoms[kingdomId];
            if (kState.startData.length > 0) renderRosterAnalysis(kingdomId, kState.startData);
        }
    }

    function switchPrekvkSubTab(subTabId) {
        const container = document.getElementById('prekvk-analysis');
        if (!container) return;

        activateTab(container, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        const select = elements.prekvkKingdomSelect;
        const govCountSelect = elements.prekvkGovCountSelect;

        if (subTabId === 'kingdom-analysis') {
            if (select) select.classList.add('hidden');
            if (govCountSelect) govCountSelect.classList.remove('hidden');
            renderKingdomAnalysis();
        } else {
            if (select) select.classList.remove('hidden');
            if (govCountSelect) govCountSelect.classList.add('hidden');
            if (select && select.value) {
                if (subTabId === 'alliance-analysis') renderAllianceAnalysis(select.value);
                if (subTabId === 'governor-analysis') renderGovernorAnalysis(select.value);
            }
        }
    }

    // --- Rendering Functions ---

    function renderKingdomAnalysis() {
        const data = [];
        const govCountLimit = elements.prekvkGovCountSelect ? elements.prekvkGovCountSelect.value : 'all';

        AppState.loadedKingdoms.forEach(kId => {
            const kState = AppState.kingdoms[kId];
            if (!kState.endData || kState.endData.length === 0) return;

            let processedData = getFilteredData([...kState.endData]);

            if (govCountLimit !== 'all') {
                const limit = parseInt(govCountLimit);
                processedData.sort((a, b) => parseNumber(b['Power']) - parseNumber(a['Power']));
                processedData = processedData.slice(0, limit);
            }

            const totalPower = processedData.reduce((sum, r) => sum + parseNumber(r['Power']), 0);
            const totalDeads = processedData.reduce((sum, r) => sum + parseNumber(r['Deads']), 0);
            const totalT4 = processedData.reduce((sum, r) => sum + parseNumber(r['T4 Kills']), 0);
            const totalT5 = processedData.reduce((sum, r) => sum + parseNumber(r['T5 Kills']), 0);
            const totalKP = processedData.reduce((sum, r) => sum + parseNumber(r['Kill Points']), 0);

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
        renderAnalysisTable(data, elements.kingdomAnalysisContainer);
    }

    function renderAllianceAnalysis(kingdomId) {
        if (!kingdomId) {
            if (elements.allianceAnalysisContainer) elements.allianceAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = AppState.kingdoms[kingdomId];
        if (!kState || !kState.endData || kState.endData.length === 0) {
            if (elements.allianceAnalysisContainer) elements.allianceAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = getFilteredData(kState.endData);
        const allianceMap = {};
        filteredData.forEach(row => {
            const tag = row['Alliance Tag'] || 'No Tag';
            if (!allianceMap[tag]) {
                allianceMap[tag] = { 'Alliance': tag, 'Count': 0, 'Power': 0, 'Deads': 0, 'T4 Kills': 0, 'T5 Kills': 0, 'Kill Points': 0 };
            }
            allianceMap[tag]['Count']++;
            allianceMap[tag]['Power'] += parseNumber(row['Power']);
            allianceMap[tag]['Deads'] += parseNumber(row['Deads']);
            allianceMap[tag]['T4 Kills'] += parseNumber(row['T4 Kills']);
            allianceMap[tag]['T5 Kills'] += parseNumber(row['T5 Kills']);
            allianceMap[tag]['Kill Points'] += parseNumber(row['Kill Points']);
        });

        const data = Object.values(allianceMap).sort((a, b) => b['Power'] - a['Power']);
        renderAnalysisTable(data, elements.allianceAnalysisContainer);
    }

    function renderGovernorAnalysis(kingdomId) {
        if (!kingdomId) {
            if (elements.governorAnalysisContainer) elements.governorAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = AppState.kingdoms[kingdomId];
        if (!kState || !kState.endData || kState.endData.length === 0) {
            if (elements.governorAnalysisContainer) elements.governorAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = getFilteredData(kState.endData);
        const sorted = [...filteredData].sort((a, b) => parseNumber(b['Power']) - parseNumber(a['Power'])).slice(0, 100);
        const data = sorted.map(row => ({
            'Name': row['Governor Name'],
            'ID': row['Governor ID'],
            'Alliance': row['Alliance Tag'],
            'Power': parseNumber(row['Power']),
            'Deads': parseNumber(row['Deads']),
            'T4 Kills': parseNumber(row['T4 Kills']),
            'T5 Kills': parseNumber(row['T5 Kills']),
            'Kill Points': parseNumber(row['Kill Points'])
        }));

        renderAnalysisTable(data, elements.governorAnalysisContainer);
    }

    function renderAnalysisTable(data, container) {
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
                    style = `style="background-color: rgba(59, 130, 246, ${alpha}); color: ${intensity > 0.6 ? 'white' : 'var(--text-primary)'}"`;
                }
                html += `<td ${style}>${typeof val === 'number' ? val.toLocaleString() : val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function updatePrekvkDropdown() {
        const select = elements.prekvkKingdomSelect;
        if (!select) return;
        while (select.options.length > 1) select.remove(1);
        Array.from(AppState.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });
        if (AppState.loadedKingdoms.size > 0 && select.value === '') {
            select.value = Array.from(AppState.loadedKingdoms)[0];
            select.dispatchEvent(new Event('change'));
        }
    }

    // --- Prekvk Event Listeners ---
    const prekvkSubTabs = document.querySelector('.prekvk-subtabs');
    if (prekvkSubTabs) {
        prekvkSubTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('subtab-btn')) {
                switchPrekvkSubTab(e.target.dataset.subtab);
            }
        });
    }

    if (elements.prekvkKingdomSelect) {
        elements.prekvkKingdomSelect.addEventListener('change', (e) => {
            const kingdomId = e.target.value;
            const activeBtn = document.querySelector('.prekvk-subtabs .subtab-btn.active');
            if (activeBtn) {
                const activeSubTab = activeBtn.dataset.subtab;
                if (activeSubTab === 'alliance-analysis') renderAllianceAnalysis(kingdomId);
                if (activeSubTab === 'governor-analysis') renderGovernorAnalysis(kingdomId);
            }
        });
    }

    if (elements.prekvkGovCountSelect) {
        elements.prekvkGovCountSelect.addEventListener('change', () => renderKingdomAnalysis());
    }

    // --- Other Render Functions (Comparison, Overview, Charts) ---

    function renderKingdomComparison() {
        const tbody = document.querySelector('#kingdomComparisonTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        AppState.loadedKingdoms.forEach(kingdomId => {
            const kState = AppState.kingdoms[kingdomId];
            if (!kState || !kState.calculatedData || kState.calculatedData.length === 0) return;

            // Note: calculatedData is already filtered if calculateKingdom was called with filter on.
            // But if we are just viewing results, we rely on calculateKingdom having been run.
            // If the user toggles filter, we re-run calculateKingdom.

            let stats = { startPower: 0, powerDiff: 0, troopPower: 0, t4: 0, t5: 0, deads: 0, kp: 0, dkp: 0 };
            kState.calculatedData.forEach(p => {
                stats.startPower += p.startPower || 0;
                stats.powerDiff += p.powerDiff || 0;
                stats.troopPower += p.troopPowerDiff || 0;
                stats.t4 += p.t4 || 0;
                stats.t5 += p.t5 || 0;
                stats.deads += p.deads || 0;
                stats.kp += p.kvkKP || 0;
            });

            const deadsWeight = kState.config.deadsWeight || 50;
            stats.dkp = stats.kp + (stats.deads * deadsWeight);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${kingdomId}</td>
                <td>${stats.startPower.toLocaleString()}</td>
                <td class="${stats.powerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.powerDiff.toLocaleString()}</td>
                <td class="${stats.troopPower >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.troopPower.toLocaleString()}</td>
                <td>${stats.t4.toLocaleString()}</td>
                <td>${stats.t5.toLocaleString()}</td>
                <td>${stats.deads.toLocaleString()}</td>
                <td>${stats.kp.toLocaleString()}</td>
                <td>${Math.round(stats.dkp).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderKingdomTabs() {
        if (!elements.mainTabs) return;
        elements.mainTabs.querySelectorAll('[data-tab^="kingdom-"]').forEach(t => t.remove());

        AppState.loadedKingdoms.forEach(kId => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = `kingdom-${kId}`;
            btn.textContent = `Kingdom ${kId}`;
            elements.mainTabs.appendChild(btn);

            if (!document.getElementById(`kingdom-${kId}`)) createKingdomContent(kId);
        });
        updatePrekvkDropdown();
    }

    function createKingdomContent(kingdomId) {
        const clone = elements.kingdomContentTemplate.cloneNode(true);
        clone.id = `kingdom-${kingdomId}`;
        clone.style.display = 'none';
        clone.classList.add('kingdom-content');

        const subTabs = clone.querySelector('.kingdom-subtabs');
        if (subTabs) {
            subTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('subtab-btn')) switchSubTab(kingdomId, e.target.dataset.subtab);
            });
        }

        clone.querySelectorAll('.config-input').forEach(input => {
            input.addEventListener('change', (e) => AppState.kingdoms[kingdomId].config[e.target.name] = parseFloat(e.target.value));
        });

        const nextBtn = clone.querySelector('.next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => switchSubTab(kingdomId, 'results'));

        const calcBtn = clone.querySelector('.calculate-btn');
        if (calcBtn) calcBtn.addEventListener('click', () => calculateKingdom(kingdomId));

        const exportBtn = clone.querySelector('.export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => exportToCSV(kingdomId));

        const attachSearch = (selector, handler) => {
            const el = clone.querySelector(selector);
            if (el) el.addEventListener('input', debounce((e) => handler(kingdomId, e.target.value.toLowerCase().trim()), 300));
        };

        attachSearch('.scatter-search', updateScatterHighlight);
        attachSearch('.overview-search', filterOverviewTable);
        attachSearch('.efficiency-search', updateEfficiencyHighlight);
        attachSearch('.results-search', filterResultsTable);

        const logToggle = clone.querySelector('.roster-log-toggle');
        const limitSelect = clone.querySelector('.roster-limit-select');

        if (logToggle && limitSelect) {
            const updateRoster = () => {
                const kState = AppState.kingdoms[kingdomId];
                if (kState.startData.length > 0) {
                    renderRosterAnalysis(kingdomId, kState.startData, logToggle.checked, parseInt(limitSelect.value));
                }
            };
            logToggle.addEventListener('change', updateRoster);
            limitSelect.addEventListener('change', updateRoster);
        }

        clone.querySelectorAll('.dkp-table th').forEach(th => {
            th.addEventListener('click', () => {
                const sortKey = th.dataset.sort;
                const kState = AppState.kingdoms[kingdomId];
                if (kState.lastSortCol === sortKey) kState.sortDirection *= -1;
                else { kState.sortDirection = 1; kState.lastSortCol = sortKey; }

                kState.calculatedData.sort((a, b) => {
                    let valA = a[sortKey];
                    let valB = b[sortKey];
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                    if (valA < valB) return -1 * kState.sortDirection;
                    if (valA > valB) return 1 * kState.sortDirection;
                    return 0;
                });
                renderResultsTable(kingdomId, kState.calculatedData);
            });
        });

        elements.kingdomsContainer.appendChild(clone);
    }

    function updateScanDetails(type, date, kingdoms) {
        const detailsEl = type === 'start' ? elements.startScanDetails : elements.endScanDetails;
        if (!detailsEl) return;
        let html = '';
        if (date) html += `<div class="scan-date">Date: <strong>${date}</strong></div>`;
        if (kingdoms && kingdoms.length > 0) html += `<div class="scan-kingdoms">Kingdoms: <strong>${kingdoms.join(', ')}</strong></div>`;
        detailsEl.innerHTML = html;
        detailsEl.style.display = 'block';
    }

    function updateOverview(kingdomId) {
        const kState = AppState.kingdoms[kingdomId];
        // Use filtered data for overview
        const startFiltered = getFilteredData(kState.startData);
        const endFiltered = getFilteredData(kState.endData);

        if (startFiltered.length > 0 && endFiltered.length > 0) {
            const diffData = calculateOverviewDiff(startFiltered, endFiltered);
            kState.currentOverviewData = diffData;
            renderOverviewTable(kingdomId, diffData);
        } else if (startFiltered.length > 0) {
            kState.currentOverviewData = startFiltered;
            renderOverviewTable(kingdomId, startFiltered);
        } else {
            kState.currentOverviewData = [];
            renderOverviewTable(kingdomId, []);
        }
    }

    function renderOverviewTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const table = container.querySelector('.overview-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!data || data.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td>No data available matching filter.</td></tr>';
            return;
        }

        const headers = Object.keys(data[0]);
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        const fragment = document.createDocumentFragment();
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = headers.map(h => `<td>${row[h]}</td>`).join('');
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        syncOverviewScroll(kingdomId);
    }

    function syncOverviewScroll(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const table = container.querySelector('.overview-table');
        const topScroll = container.querySelector('.top-scroll-wrapper');
        const content = topScroll.querySelector('.top-scroll-content');

        if (table && content) {
            content.style.width = table.offsetWidth + 'px';
            topScroll.onscroll = () => {
                container.querySelector('.table-container').scrollLeft = topScroll.scrollLeft;
            };
            container.querySelector('.table-container').onscroll = () => {
                topScroll.scrollLeft = container.querySelector('.table-container').scrollLeft;
            };
        }
    }

    function calculateOverviewDiff(startData, endData) {
        const startMap = new Map(startData.map(row => [row['Governor ID'], row]));
        const endMap = new Map(endData.map(row => [row['Governor ID'], row]));
        const allIds = new Set([...startMap.keys(), ...endMap.keys()]);
        const headers = Object.keys(startData[0] || endData[0] || {});

        const staticColumns = new Set([
            'governor id', 'governor name', 'alliance tag', 'kingdom', 'domain id',
            'lost kingdom count', 'lk most killed', 'lk most lost', 'lk most healed',
            'current league', 'highest league', 'olympia battles', 'olympia wins', 'olympia likes',
            'ark battles', 'ark wins', 'ark kills/battle', 'ark sevs/battle', 'ark healed/battle',
            'ark osiris count', 'ark championship count', 'town hall', 'utc offset', 'autarch count',
            '_kingdom'
        ]);

        const diffData = [];
        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};
            const newRow = {};

            headers.forEach(header => {
                if (header === '_kingdom') {
                    newRow[header] = endRow[header] || startRow[header] || '';
                    return;
                }
                const startVal = parseNumber(startRow[header]);
                const endVal = parseNumber(endRow[header]);
                const lowerHeader = header.toLowerCase();
                const isNumeric = !isNaN(parseFloat(startRow[header]?.toString().replace(/,/g, ''))) || !isNaN(parseFloat(endRow[header]?.toString().replace(/,/g, '')));

                if (staticColumns.has(lowerHeader)) {
                    newRow[header] = endRow[header] || startRow[header] || '';
                } else if (isNumeric) {
                    let diff = endVal - startVal;
                    if (['t1', 't2', 't3', 't4', 't5'].some(k => lowerHeader.includes(k))) diff = Math.max(0, diff);
                    newRow[header] = diff > 0 ? `+ ${diff.toLocaleString()}` : diff.toLocaleString();
                } else {
                    newRow[header] = endRow[header] || startRow[header] || '';
                }
            });
            diffData.push(newRow);
        });
        return diffData;
    }

    function calculateKingdom(kingdomId) {
        const kState = AppState.kingdoms[kingdomId];
        if (kState.startData.length === 0 || kState.endData.length === 0) {
            alert('Missing Start or End data for this Kingdom.');
            return;
        }

        const config = kState.config;
        // Use filtered data for calculation
        const startFiltered = getFilteredData(kState.startData);
        const endFiltered = getFilteredData(kState.endData);

        const startMap = new Map(startFiltered.map(row => [row['Governor ID'], row]));
        const endMap = new Map(endFiltered.map(row => [row['Governor ID'], row]));
        const allIds = new Set([...startMap.keys(), ...endMap.keys()]);

        kState.calculatedData = [];

        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};

            const name = endRow['Governor Name'] || startRow['Governor Name'] || 'Unknown';
            const kingdom = endRow['_kingdom'] || startRow['_kingdom'] || kingdomId;

            const deadsDiff = Math.max(0, parseNumber(endRow['Deads']) - parseNumber(startRow['Deads']));
            const startPower = parseNumber(startRow['Power']);
            const powerDiff = parseNumber(endRow['Power']) - startPower;
            const troopPowerDiff = parseNumber(endRow['Troop Power']) - parseNumber(startRow['Troop Power']);

            const startRawKP = parseNumber(startRow['Kill Points']);
            const endRawKP = parseNumber(endRow['Kill Points']);
            const rawKPDiff = Math.max(0, endRawKP - startRawKP);

            const t4Diff = Math.max(0, parseNumber(endRow['T4 Kills']) - parseNumber(startRow['T4 Kills']));
            const t5Diff = Math.max(0, parseNumber(endRow['T5 Kills']) - parseNumber(startRow['T5 Kills']));
            const t4t5Combined = t4Diff + t5Diff;

            const kvkKP = (t4Diff * config.t4Points) + (t5Diff * config.t5Points);
            const t4MixRatio = 1 - config.t5MixRatio;
            const targetKP = ((startPower / config.kpPowerDivisor) * ((config.t5MixRatio * config.t5Points) + (t4MixRatio * config.t4Points))) * config.kpMultiplier;
            const targetDeads = startPower * config.deadsMultiplier;

            const kpPercent = targetKP > 0 ? (kvkKP / targetKP) * 100 : 0;
            const deadPercent = targetDeads > 0 ? (deadsDiff / targetDeads) * 100 : 0;

            let totalDKPPercent = 0;
            if (targetKP > 0 && targetDeads > 0) totalDKPPercent = (kpPercent + deadPercent) / 2;
            else if (targetKP > 0) totalDKPPercent = kpPercent;
            else if (targetDeads > 0) totalDKPPercent = deadPercent;

            kState.calculatedData.push({
                id, name, kingdom, startPower, powerDiff, troopPowerDiff, rawKP: rawKPDiff,
                t1: Math.max(0, parseNumber(endRow['T1 Kills']) - parseNumber(startRow['T1 Kills'])),
                t2: Math.max(0, parseNumber(endRow['T2 Kills']) - parseNumber(startRow['T2 Kills'])),
                t3: Math.max(0, parseNumber(endRow['T3 Kills']) - parseNumber(startRow['T3 Kills'])),
                t4: t4Diff, t5: t5Diff, t4t5: t4t5Combined,
                deads: deadsDiff, kvkKP, targetKP,
                kpPercent: parseFloat(kpPercent.toFixed(2)),
                targetDeads,
                deadPercent: parseFloat(deadPercent.toFixed(2)),
                totalDKPPercent: parseFloat(totalDKPPercent.toFixed(2)),
                bonus: 0
            });
        });

        renderResultsTable(kingdomId, kState.calculatedData);
        const container = document.getElementById(`kingdom-${kingdomId}`);
        container.querySelector('.results-section').classList.remove('hidden');
        switchSubTab(kingdomId, 'results');
    }

    function renderResultsTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const tbody = container.querySelector('.dkp-table tbody');
        const fragment = document.createDocumentFragment();
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.startPower.toLocaleString()}</td>
                <td class="${row.powerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${row.powerDiff.toLocaleString()}</td>
                <td class="${row.troopPowerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${row.troopPowerDiff.toLocaleString()}</td>
                <td>${row.t1.toLocaleString()}</td>
                <td>${row.t2.toLocaleString()}</td>
                <td>${row.t3.toLocaleString()}</td>
                <td>${row.t4.toLocaleString()}</td>
                <td>${row.t5.toLocaleString()}</td>
                <td>${row.t4t5.toLocaleString()}</td>
                <td>${row.deads.toLocaleString()}</td>
                <td>${row.kvkKP.toLocaleString()}</td>
                <td>${Math.round(row.targetKP).toLocaleString()}</td>
                <td class="${row.kpPercent >= 100 ? 'status-complete' : 'status-incomplete'}">${row.kpPercent}%</td>
                <td>${Math.round(row.targetDeads).toLocaleString()}</td>
                <td class="${row.deadPercent >= 100 ? 'status-complete' : 'status-incomplete'}">${row.deadPercent}%</td>
                <td class="${row.totalDKPPercent >= 100 ? 'status-complete' : 'status-incomplete'}"><span class="total-dkp">${row.totalDKPPercent}%</span></td>
                <td><input type="number" class="bonus-input" data-id="${row.id}" value="${row.bonus}" step="1"></td>
            `;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        attachBonusListeners(kingdomId);
    }

    function attachBonusListeners(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        container.querySelectorAll('.bonus-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.dataset.id;
                const newBonus = parseFloat(e.target.value) || 0;
                const row = AppState.kingdoms[kingdomId].calculatedData.find(r => r.id === id);

                if (row) {
                    row.bonus = newBonus;
                    let baseScore = 0;
                    if (row.targetKP > 0 && row.targetDeads > 0) baseScore = (row.kpPercent + row.deadPercent) / 2;
                    else if (row.targetKP > 0) baseScore = row.kpPercent;
                    else if (row.targetDeads > 0) baseScore = row.deadPercent;

                    row.totalDKPPercent = parseFloat((baseScore + newBonus).toFixed(2));

                    const tr = e.target.closest('tr');
                    const totalCell = tr.querySelector('.total-dkp');
                    const totalTd = totalCell.parentElement;

                    totalCell.textContent = row.totalDKPPercent + '%';
                    totalTd.className = row.totalDKPPercent >= 100 ? 'status-complete' : 'status-incomplete';
                }
            });
        });
    }

    function renderScatterChart(kingdomId, overviewData) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.scatter-chart').getContext('2d');
        const kState = AppState.kingdoms[kingdomId];

        const validRows = overviewData.filter(row => {
            const kp = row.rawKP !== undefined ? row.rawKP : parseNumber(row['Kill Points']);
            const deads = row.deads !== undefined ? row.deads : parseNumber(row['Deads']);
            return kp > 0 || deads > 0;
        });

        if (validRows.length < 2) return;

        const dataMatrix = validRows.map(row => {
            if (row.rawKP !== undefined) {
                return [row.powerDiff, row.troopPowerDiff, row.t4, row.t5, row.deads, row.rawKP];
            } else {
                return [
                    parseNumber(row['Power']), parseNumber(row['Troop Power']),
                    parseNumber(row['T4 Kills']), parseNumber(row['T5 Kills']),
                    parseNumber(row['Deads']), parseNumber(row['Kill Points'])
                ];
            }
        });

        const normalizedData = normalizeData(dataMatrix);
        let vectors;
        try {
            vectors = PCA.getEigenVectors(normalizedData);
        } catch (e) { return; }

        let pc1 = vectors[0];
        let pc2 = vectors[1];

        if (pc1.vector[5] < 0) pc1.vector = pc1.vector.map(v => -v);
        if (pc2.vector[4] < 0) pc2.vector = pc2.vector.map(v => -v);

        const projectedData = normalizedData.map(row => ({
            x: dotProduct(row, pc1.vector),
            y: dotProduct(row, pc2.vector)
        }));

        const totalKP = validRows.reduce((sum, row) => sum + (row.rawKP !== undefined ? row.rawKP : parseNumber(row['Kill Points'])), 0);
        const totalDeads = validRows.reduce((sum, row) => sum + (row.deads !== undefined ? row.deads : parseNumber(row['Deads'])), 0);
        const avgKP = validRows.length > 0 ? totalKP / validRows.length : 0;
        const avgDeads = validRows.length > 0 ? totalDeads / validRows.length : 0;

        const points = validRows.map((row, index) => {
            const kp = row.rawKP !== undefined ? row.rawKP : parseNumber(row['Kill Points']);
            const deads = row.deads !== undefined ? row.deads : parseNumber(row['Deads']);
            const name = row.name || row['Governor Name'];
            const id = row.id || row['Governor ID'];

            let color = '#94a3b8';
            if (kp >= avgKP && deads < avgDeads) color = '#3b82f6';
            else if (kp >= avgKP && deads >= avgDeads) color = '#10b981';
            else if (kp < avgKP && deads >= avgDeads) color = '#ef4444';

            return {
                x: projectedData[index].x,
                y: projectedData[index].y,
                r: 5,
                backgroundColor: color,
                borderColor: 'transparent',
                borderWidth: 0,
                name, id, rawKP: kp, deads
            };
        });

        if (kState.scatterChart) kState.scatterChart.destroy();

        kState.scatterChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Player Clusters',
                    data: points,
                    backgroundColor: points.map(p => p.backgroundColor),
                    borderColor: points.map(p => p.borderColor),
                    borderWidth: points.map(p => p.borderWidth)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    zoom: {
                        pan: { enabled: true, mode: 'xy' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const p = context.raw;
                                return `${p.name}(ID: ${p.id}) | Raw KP: ${p.rawKP.toLocaleString()} | Deads: ${p.deads.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Activity Volume (PC1)' } },
                    y: { title: { display: true, text: 'Efficiency (PC2)' } }
                }
            }
        });
    }

    function updateScatterHighlight(kingdomId, searchTerm) {
        const kState = AppState.kingdoms[kingdomId];
        if (!kState.scatterChart) return;
        const chart = kState.scatterChart;
        const datasets = chart.data.datasets;

        datasets.forEach(dataset => {
            if (!dataset.data[0].originalColor) dataset.data.forEach(p => p.originalColor = p.backgroundColor);
            const newColors = dataset.data.map(p => {
                if (!searchTerm) return p.originalColor;
                const match = p.name.toLowerCase().includes(searchTerm) || p.id.toString().includes(searchTerm);
                return match ? p.originalColor : '#e5e7eb';
            });
            dataset.backgroundColor = newColors;
            dataset.borderColor = newColors;
        });
        chart.update();
    }

    function renderPowerEfficiencyChart(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.efficiency-chart').getContext('2d');
        const kState = AppState.kingdoms[kingdomId];

        const validPoints = data.filter(r => r.startPower > 0 && r.totalDKPPercent > 0);
        if (validPoints.length === 0) return;

        const maxDeads = Math.max(...validPoints.map(p => p.deads));
        const points = validPoints.map(p => {
            let color = '#facc15';
            if (p.totalDKPPercent >= 100) color = '#10b981';
            else if (p.totalDKPPercent < 80) color = '#ef4444';
            const r = maxDeads > 0 ? 3 + (p.deads / maxDeads) * 17 : 5;
            return { x: p.startPower, y: p.totalDKPPercent, r, backgroundColor: color, name: p.name, id: p.id, deads: p.deads };
        });

        if (kState.efficiencyChart) kState.efficiencyChart.destroy();

        kState.efficiencyChart = new Chart(ctx, {
            type: 'bubble',
            data: { datasets: [{ label: 'Player Efficiency', data: points, backgroundColor: points.map(p => p.backgroundColor) }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                    tooltip: { callbacks: { label: (c) => `${c.raw.name} | Power: ${c.raw.x.toLocaleString()} | DKP: ${c.raw.y}%` } },
                    annotation: { annotations: { line1: { type: 'line', yMin: 100, yMax: 100, borderColor: 'rgba(255,255,255,0.5)', borderWidth: 2, borderDash: [6, 6] } } }
                },
                scales: {
                    x: { title: { display: true, text: 'Starting Power' }, ticks: { callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v.toLocaleString() } },
                    y: { title: { display: true, text: 'DKP Score %' }, suggestedMin: 0, suggestedMax: 150 }
                }
            }
        });
    }

    function updateEfficiencyHighlight(kingdomId, searchTerm) {
        const kState = AppState.kingdoms[kingdomId];
        if (!kState.efficiencyChart) return;
        const chart = kState.efficiencyChart;
        chart.data.datasets.forEach(dataset => {
            if (!dataset.data[0].originalColor) dataset.data.forEach(p => p.originalColor = p.backgroundColor);
            dataset.backgroundColor = dataset.data.map(p => {
                if (!searchTerm) return p.originalColor;
                return (p.name.toLowerCase().includes(searchTerm) || p.id.toString().includes(searchTerm)) ? p.originalColor : '#e5e7eb';
            });
        });
        chart.update();
    }

    function renderRosterAnalysis(kingdomId, data, useLogScale = false, limit = 300) {
        const kState = AppState.kingdoms[kingdomId];
        const container = document.getElementById(`kingdom-${kingdomId}`);

        // Use filtered data
        let validPlayers = getFilteredData(data).filter(p => parseNumber(p.Power) > 1000000);

        if (validPlayers.length === 0) return;

        validPlayers.sort((a, b) => parseNumber(b.Power) - parseNumber(a.Power));
        if (limit > 0) validPlayers = validPlayers.slice(0, limit);

        const warriors = [], farmers = [], casuals = [];
        validPlayers.forEach(p => {
            const t4 = parseNumber(p['T4 Kills']), t5 = parseNumber(p['T5 Kills']);
            const kp = p['Kill Points'] ? parseNumber(p['Kill Points']) : (t4 * 10 + t5 * 20);
            const power = parseNumber(p.Power), deads = parseNumber(p['Deads'] || p['Dead']);
            const gathered = parseNumber(p['Resources Gathered'] || 0);
            const kpRatio = power > 0 ? kp / power : 0;
            const point = { x: power, y: kp, r: Math.min(Math.max(2, Math.sqrt(deads) / 100), 15), name: p['Governor Name'] || p.Name || 'Unknown', id: p['Governor ID'], deads, gathered, type: 'Unknown' };

            if (kpRatio > 5) { point.type = 'Warrior'; warriors.push(point); }
            else if (kpRatio < 1) { point.type = 'Farmer'; farmers.push(point); }
            else { point.type = 'Casual'; casuals.push(point); }
        });

        const scatterCtx = container.querySelector('.roster-scatter-chart');
        if (scatterCtx) {
            if (kState.rosterScatterChart) kState.rosterScatterChart.destroy();
            kState.rosterScatterChart = new Chart(scatterCtx, {
                type: 'bubble',
                data: {
                    datasets: [
                        { label: 'Warriors (>5 KP/P)', data: warriors, backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: '#ef4444' },
                        { label: 'Casuals (1-5 KP/P)', data: casuals, backgroundColor: 'rgba(250, 204, 21, 0.6)', borderColor: '#facc15' },
                        { label: 'Farmers (<1 KP/P)', data: farmers, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                        tooltip: { callbacks: { label: (c) => `${c.raw.name} (${c.raw.type}) | KP: ${c.raw.y.toLocaleString()}` } },
                        title: { display: true, text: `Lifetime KP vs Power (Top ${limit > 0 ? limit : 'All'})` }
                    },
                    scales: {
                        x: { type: useLogScale ? 'logarithmic' : 'linear', title: { display: true, text: 'Power' }, ticks: { callback: v => (v / 1000000).toFixed(1) + 'M' } },
                        y: { type: useLogScale ? 'logarithmic' : 'linear', title: { display: true, text: 'Kill Points' }, ticks: { callback: v => (v / 1000000).toFixed(1) + 'M' } }
                    }
                }
            });
        }

        const insightsEl = container.querySelector('#rosterInsights');
        if (insightsEl) {
            const total = validPlayers.length;
            insightsEl.innerHTML = `
                <p><strong>Analysis of Top ${total} Governors:</strong></p>
                <ul>
                    <li><span style="color:#ef4444">■</span> <strong>Warriors:</strong> ${warriors.length} (${((warriors.length / total) * 100).toFixed(1)}%)</li>
                    <li><span style="color:#10b981">■</span> <strong>Farmers:</strong> ${farmers.length} (${((farmers.length / total) * 100).toFixed(1)}%)</li>
                    <li><span style="color:#facc15">■</span> <strong>Casuals:</strong> ${casuals.length} (${((casuals.length / total) * 100).toFixed(1)}%)</li>
                </ul>
            `;
        }
    }

    function filterOverviewTable(kingdomId, searchTerm) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const rows = container.querySelector('.overview-table tbody').querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const id = row.cells[0].textContent.toLowerCase();
            row.style.display = (name.includes(searchTerm) || id.includes(searchTerm)) ? '' : 'none';
        });
    }

    function filterResultsTable(kingdomId, searchTerm) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const rows = container.querySelector('.dkp-table tbody').querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const id = row.cells[0].textContent.toLowerCase();
            row.style.display = (name.includes(searchTerm) || id.includes(searchTerm)) ? '' : 'none';
        });
    }

    function normalizeData(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const normalized = [];
        for (let j = 0; j < cols; j++) {
            let sum = 0, sumSq = 0;
            for (let i = 0; i < rows; i++) { sum += matrix[i][j]; sumSq += matrix[i][j] * matrix[i][j]; }
            const mean = sum / rows;
            const stdDev = Math.sqrt((sumSq / rows) - (mean * mean)) || 1;
            for (let i = 0; i < rows; i++) {
                if (!normalized[i]) normalized[i] = [];
                normalized[i][j] = (matrix[i][j] - mean) / stdDev;
            }
        }
        return normalized;
    }

    function dotProduct(vecA, vecB) { return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0); }

    function exportToCSV(kingdomId) {
        const data = AppState.kingdoms[kingdomId].calculatedData;
        if (!data || data.length === 0) return;
        const headers = ['Governor ID', 'Governor Name', 'Kingdom', 'Starting Power', 'Power +/-', 'Troop Power', 'T1 Kills', 'T2 Kills', 'T3 Kills', 'T4 Kills', 'T5 Kills', 'T4+T5 Combined', 'Kvk Deads', 'KVK KP', 'Target KP', 'KP % Complete', 'Target Deads', 'Dead% Complete', 'Total DKP %', 'Bonus/Punishment'];
        const csvContent = [headers.join(','), ...data.map(row => [row.id, `"${row.name}"`, row.kingdom, row.startPower, row.powerDiff, row.troopPowerDiff, row.t1, row.t2, row.t3, row.t4, row.t5, row.t4t5, row.deads, row.kvkKP, row.targetKP, row.kpPercent, row.targetDeads, row.deadPercent, row.totalDKPPercent, row.bonus].join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `dkp_results_kingdom_${kingdomId}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    const COLUMN_MAPPING = {
        'Governor ID': ['governor id', 'gov id', 'id', 'user id', 'uid'],
        'Governor Name': ['governor name', 'gov name', 'name', 'player', 'governor'],
        'Power': ['power', 'total power', 'pwr'],
        'Troop Power': ['troop power', 'troops', 'troop'],
        'Kill Points': ['kill points', 'kp', 'killpoints', 'kills'],
        'Deads': ['deads', 'dead', 'deaths', 'dead troops'],
        'T1 Kills': ['t1 kills', 'tier 1 kills', 't1'],
        'T2 Kills': ['t2 kills', 'tier 2 kills', 't2'],
        'T3 Kills': ['t3 kills', 'tier 3 kills', 't3'],
        'T4 Kills': ['t4 kills', 'tier 4 kills', 't4'],
        'T5 Kills': ['t5 kills', 'tier 5 kills', 't5'],
        'Town Hall': ['town hall', 'th', 'al', 'city hall', 'ch'],
        'Alliance Tag': ['alliance', 'tag', 'alliance tag', 'abbr']
    };

    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let extractedDate = null, allData = [], kingdoms = [];
                    const firstSheetCSV = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
                    const dateMatch = firstSheetCSV.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)/);
                    if (dateMatch) extractedDate = dateMatch[1];

                    workbook.SheetNames.forEach(sheetName => {
                        if (['summary', 'top 10s'].includes(sheetName.toLowerCase())) return;
                        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                        const normalize = (str) => str ? str.toString().trim().toLowerCase() : '';
                        let headerRowIndex = -1;
                        for (let i = 0; i < Math.min(json.length, 20); i++) {
                            if (json[i] && json[i].some(cell => COLUMN_MAPPING['Governor ID'].includes(normalize(cell)))) { headerRowIndex = i; break; }
                        }

                        if (headerRowIndex !== -1) {
                            kingdoms.push(sheetName);
                            const headerMap = {};
                            json[headerRowIndex].forEach((h, i) => {
                                const norm = normalize(h);
                                for (const [key, vars] of Object.entries(COLUMN_MAPPING)) { if (vars.includes(norm)) { headerMap[i] = key; break; } }
                            });
                            json.slice(headerRowIndex + 1).forEach(row => {
                                const rowObj = {};
                                let hasData = false;
                                row.forEach((cell, i) => { if (headerMap[i]) { rowObj[headerMap[i]] = cell; if (cell) hasData = true; } });
                                if (hasData && rowObj['Governor ID']) { rowObj['_kingdom'] = sheetName; allData.push(rowObj); }
                            });
                        }
                    });

                    if (allData.length === 0) reject(new Error('No valid Governor data found.'));
                    else resolve({ data: allData, date: extractedDate, kingdoms });
                } catch (error) { reject(error); }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    function saveState() {
        try {
            localStorage.setItem('dkp_kingdoms', JSON.stringify(AppState.kingdoms));
            localStorage.setItem('dkp_loadedKingdoms', JSON.stringify(Array.from(AppState.loadedKingdoms)));
            localStorage.setItem('dkp_scanDates', JSON.stringify({ start: AppState.startScanDate, end: AppState.endScanDate }));
        } catch (e) { console.error('Failed to save state:', e); }
    }

    function loadState() {
        try {
            const savedKingdoms = localStorage.getItem('dkp_kingdoms');
            const savedLoaded = localStorage.getItem('dkp_loadedKingdoms');
            const savedDates = localStorage.getItem('dkp_scanDates');
            if (savedKingdoms) AppState.kingdoms = JSON.parse(savedKingdoms);
            if (savedLoaded) AppState.loadedKingdoms = new Set(JSON.parse(savedLoaded));
            if (savedDates) { const dates = JSON.parse(savedDates); AppState.startScanDate = dates.start; AppState.endScanDate = dates.end; }
            if (AppState.loadedKingdoms.size > 0) {
                renderKingdomTabs();
                const firstK = AppState.kingdoms[Array.from(AppState.loadedKingdoms)[0]];
                if (firstK) {
                    if (firstK.startData.length > 0) updateScanDetails('start', AppState.startScanDate, Array.from(AppState.loadedKingdoms));
                    if (firstK.endData.length > 0) updateScanDetails('end', AppState.endScanDate, Array.from(AppState.loadedKingdoms));
                }
            }
        } catch (e) { console.error('Failed to load state:', e); }
    }

    loadState();
});
