// ==========================================
// SERVICE: UI CHARTS
// ==========================================
Object.assign(UIService.prototype, {
    renderScatterChart(kingdomId, overviewData) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.scatter-chart').getContext('2d');
        const kState = this.data.state.kingdoms[kingdomId];
        const config = kState.config;

        const getAdjustedKP = (row) => {
            if (row.kvkKP !== undefined) return row.kvkKP;
            const t4 = Utils.parseNumber(row['T4 Kills']);
            const t5 = Utils.parseNumber(row['T5 Kills']);
            return (t4 * config.t4Points) + (t5 * config.t5Points);
        };

        const validRows = overviewData.filter(row => {
            const kp = getAdjustedKP(row);
            const deads = row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads']);
            return kp > 0 || deads > 0;
        });

        if (validRows.length < 2) return;

        const dataMatrix = validRows.map(row => {
            const kp = getAdjustedKP(row);
            if (row.rawKP !== undefined) {
                return [row.powerDiff, row.troopPowerDiff, row.t4, row.t5, row.deads, kp];
            } else {
                return [
                    Utils.parseNumber(row['Power']), Utils.parseNumber(row['Troop Power']),
                    Utils.parseNumber(row['T4 Kills']), Utils.parseNumber(row['T5 Kills']),
                    Utils.parseNumber(row['Deads']), kp
                ];
            }
        });

        const normalizedData = Utils.normalizeData(dataMatrix);
        let vectors;
        // Check if PCA is available, otherwise skip
        if (typeof PCA === 'undefined') {
            console.warn("PCA library not loaded. Skipping scatter chart.");
            return;
        }
        try { vectors = PCA.getEigenVectors(normalizedData); } catch (e) { return; }

        let pc1 = vectors[0];
        let pc2 = vectors[1];

        if (pc1.vector[5] < 0) pc1.vector = pc1.vector.map(v => -v);
        if (pc2.vector[4] < 0) pc2.vector = pc2.vector.map(v => -v);

        const projectedData = normalizedData.map(row => ({
            x: Utils.dotProduct(row, pc1.vector),
            y: Utils.dotProduct(row, pc2.vector)
        }));

        const totalKP = validRows.reduce((sum, row) => sum + getAdjustedKP(row), 0);
        const totalDeads = validRows.reduce((sum, row) => sum + (row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads'])), 0);
        const avgKP = validRows.length > 0 ? totalKP / validRows.length : 0;
        const avgDeads = validRows.length > 0 ? totalDeads / validRows.length : 0;

        const points = validRows.map((row, index) => {
            const kp = getAdjustedKP(row);
            const deads = row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads']);
            const id = row['Governor ID'] || row.id;
            const name = row['Governor Name'] || row.name || 'Unknown';

            let color = '#9ca3af'; // Slacker
            if (kp >= avgKP) color = '#10b981'; // Warrior
            else if (kp < avgKP && deads >= avgDeads) color = '#ef4444'; // Feeder

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
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                    tooltip: { callbacks: { label: (context) => `${context.raw.name} (ID: ${context.raw.id}) | T4 / T5 KP: ${context.raw.rawKP.toLocaleString()} | Deads: ${context.raw.deads.toLocaleString()}` } }
                },
                scales: {
                    x: { title: { display: true, text: 'Activity Volume (PC1)' } },
                    y: { title: { display: true, text: 'Efficiency (PC2)' } }
                }
            }
        });
    },

    updateScatterHighlight(kingdomId, searchTerm) {
        const kState = this.data.state.kingdoms[kingdomId];
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
    },

    renderPowerEfficiencyChart(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.efficiency-chart').getContext('2d');
        const kState = this.data.state.kingdoms[kingdomId];

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
    },

    updateEfficiencyHighlight(kingdomId, searchTerm) {
        const kState = this.data.state.kingdoms[kingdomId];
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
    },

    renderRosterAnalysis(kingdomId, data, useLogScale = false, limit = 300) {
        const kState = this.data.state.kingdoms[kingdomId];
        const container = document.getElementById(`kingdom-${kingdomId}`);

        const validPlayers = Utils.getFilteredData(data, this.data.state.filterTownHall25).filter(p => Utils.parseNumber(p.Power) > 1000000);

        if (validPlayers.length === 0) return;

        validPlayers.sort((a, b) => Utils.parseNumber(b.Power) - Utils.parseNumber(a.Power));
        const limitedPlayers = limit > 0 ? validPlayers.slice(0, limit) : validPlayers;

        const warriors = [], farmers = [], casuals = [];
        const config = kState.config;

        limitedPlayers.forEach(p => {
            const t4 = Utils.parseNumber(p['T4 Kills']);
            const t5 = Utils.parseNumber(p['T5 Kills']);
            const kp = (t4 * config.t4Points) + (t5 * config.t5Points);

            const power = Utils.parseNumber(p.Power), deads = Utils.parseNumber(p['Deads'] || p['Dead']);
            const gathered = Utils.parseNumber(p['Resources Gathered'] || 0);
            const kpRatio = power > 0 ? kp / power : 0;
            const point = { x: power, y: kp, r: Math.min(Math.max(2, Math.sqrt(deads) / 100), 15), name: p['Governor Name'] || p.Name || 'Unknown', id: p['Governor ID'], deads, gathered, type: 'Unknown' };

            if (kpRatio > 5) { point.type = 'Warrior'; warriors.push(point); }
            else if (kpRatio < 1) { point.type = 'Farmer'; farmers.push(point); }
            else { point.type = 'Casual'; casuals.push(point); }
        });

        const scatterCtx = container.querySelector('.roster-scatter-chart');
        if (scatterCtx) {
            const existingChart = Chart.getChart(scatterCtx);
            if (existingChart) existingChart.destroy();
            else if (kState.rosterScatterChart) kState.rosterScatterChart.destroy();

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
            insightsEl.innerHTML = `<p><strong>Analysis of Top ${total} Governors:</strong></p><ul><li><span style="color:#ef4444">■</span> <strong>Warriors:</strong> ${warriors.length} (${((warriors.length / total) * 100).toFixed(1)}%)</li><li><span style="color:#10b981">■</span> <strong>Farmers:</strong> ${farmers.length} (${((farmers.length / total) * 100).toFixed(1)}%)</li><li><span style="color:#facc15">■</span> <strong>Casuals:</strong> ${casuals.length} (${((casuals.length / total) * 100).toFixed(1)}%)</li></ul>`;
        }
    }
});
