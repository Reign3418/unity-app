const UIGovernance = {
    data: null,
    activeKingdomId: null,
    auditChart: null,

    init(dataService) {
        this.data = dataService;
        this.setupListeners();
    },

    setupListeners() {
        // Tab Navigation
        document.querySelectorAll('.subtabs-container .subtab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subtab = e.target.dataset.subtab;
                if (!subtab) return;

                // Active Class
                document.querySelectorAll('.subtabs-container .subtab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Show Content
                document.querySelectorAll('.gov-section').forEach(s => s.classList.add('hidden'));
                document.getElementById(`${subtab}-ui`).classList.remove('hidden');
            });
        });

        // Kingdom Select
        const kSelect = document.getElementById('govKingdomSelect');
        if (kSelect) {
            kSelect.addEventListener('change', (e) => {
                this.render(e.target.value);
            });
        }

        // Purge Filter
        const purgeSelect = document.getElementById('purgeThreshold');
        if (purgeSelect) {
            purgeSelect.addEventListener('change', () => this.renderPurgeList());
        }

        // Copy Button
        const copyBtn = document.getElementById('copyPurgeListBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyPurgeList());
        }
    },

    render(kingdomId) {
        this.activeKingdomId = kingdomId || Object.keys(this.data.state.kingdoms)[0];
        if (!this.activeKingdomId) return;

        // Populate Select if needed
        const kSelect = document.getElementById('govKingdomSelect');
        if (kSelect && kSelect.options.length === 0) {
            Object.keys(this.data.state.kingdoms).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.innerText = k;
                kSelect.appendChild(opt);
            });
            kSelect.value = this.activeKingdomId;
        }

        this.renderAudit();
        this.renderPurgeList();
        this.renderWarPotential();
    },

    // --- 1. The Audit (Gamified Quadrant Analysis) ---
    renderAudit() {
        const ctx = document.getElementById('auditChart');
        if (!ctx) return;

        const data = this.getUnifiedData();
        if (data.length === 0) return;

        // X: Activity Score (KP + Deads)
        // Y: Power
        const powers = data.map(p => p.power).sort((a, b) => a - b);
        const kps = data.map(p => p.score).sort((a, b) => a - b);
        const midPower = powers[Math.floor(powers.length * 0.5)];
        const midScore = kps[Math.floor(kps.length * 0.5)];

        // Assign Archetypes & Emojis
        const points = data.map(p => {
            let type = 'Potato';
            let emoji = '🥔';
            let desc = 'The Graveyard';

            if (p.power >= midPower) {
                if (p.score >= midScore) { type = 'Lion'; emoji = '🦁'; desc = 'Valhalla'; }
                else { type = 'Farmer'; emoji = '🚜'; desc = 'The Farm'; }
            } else {
                if (p.score >= midScore) { type = 'Bear'; emoji = '🐻'; desc = 'The Barracks'; }
                else { type = 'Potato'; emoji = '🥔'; desc = 'The Graveyard'; }
            }

            p.archetype = type;

            return {
                x: p.score,
                y: p.power,
                r: 15, // Hit radius
                name: p.name,
                id: p.id,
                type: type,
                emoji: emoji,
                desc: desc,
                stats: p
            };
        });

        if (this.auditChart) this.auditChart.destroy();

        // --- Custom Plugin: Draw Background Biomes ---
        const biomePlugin = {
            id: 'biomeBackground',
            beforeDraw: (chart) => {
                const { ctx, chartArea: { left, top, width, height }, scales: { x, y } } = chart;

                const xMid = x.getPixelForValue(midScore);
                const yMid = y.getPixelForValue(midPower);

                ctx.save();

                // 1. Top Right (Lion - Valhalla) - Green/Gold Tint
                ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
                ctx.fillRect(xMid, top, left + width - xMid, yMid - top);
                ctx.font = 'bold 40px Arial';
                ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
                ctx.textAlign = 'center';
                ctx.fillText('VALHALLA 🦁', xMid + (width - (xMid - left)) / 2, top + 50);

                // 2. Top Left (Farmer - The Farm) - Red Tint
                ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
                ctx.fillRect(left, top, xMid - left, yMid - top);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fillText('THE FARM 🚜', left + (xMid - left) / 2, top + 50);

                // 3. Bottom Right (Bear - The Barracks) - Orange Tint
                ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
                ctx.fillRect(xMid, yMid, left + width - xMid, top + height - yMid);
                ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
                ctx.fillText('BARRACKS 🐻', xMid + (width - (xMid - left)) / 2, top + height - 50);

                // 4. Bottom Left (Potato - Graveyard) - Grey Tint
                ctx.fillStyle = 'rgba(107, 114, 128, 0.1)';
                ctx.fillRect(left, yMid, xMid - left, top + height - yMid);
                ctx.fillStyle = 'rgba(107, 114, 128, 0.2)';
                ctx.fillText('GRAVEYARD 🥔', left + (xMid - left) / 2, top + height - 50);

                ctx.restore();
            }
        };

        // --- Custom Plugin: Draw Emojis ---
        const emojiPlugin = {
            id: 'emojiPoints',
            afterDatasetsDraw: (chart) => {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const dataPoint = dataset.data[index];
                        const { x, y } = element.tooltipPosition();

                        ctx.save();
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(dataPoint.emoji, x, y);
                        ctx.restore();
                    });
                });
            }
        };

        this.auditChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Roster',
                    data: points,
                    backgroundColor: 'rgba(0,0,0,0)', // Invisible bubbles, we draw emojis
                    borderColor: 'rgba(0,0,0,0)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => `${c.raw.emoji} ${c.raw.name} | Power: ${Utils.formatCompactNumber(c.raw.y)} | Activity: ${Utils.formatCompactNumber(c.raw.x)}`
                        }
                    },
                    annotation: {
                        annotations: {
                            line1: { type: 'line', yMin: midPower, yMax: midPower, borderColor: 'rgba(255,255,255,0.4)', borderWidth: 2, borderDash: [5, 5] },
                            line2: { type: 'line', xMin: midScore, xMax: midScore, borderColor: 'rgba(255,255,255,0.4)', borderWidth: 2, borderDash: [5, 5] }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'logarithmic',
                        title: { display: true, text: 'Period Activity Score (KP + Deads)' },
                        ticks: { callback: v => Utils.formatCompactNumber(v) },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        title: { display: true, text: 'Current Power' },
                        ticks: { callback: v => Utils.formatCompactNumber(v) },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                onClick: (e, activeEls) => {
                    if (activeEls.length > 0) {
                        const point = points[activeEls[0].index];
                        this.showAuditDetails(point);
                    }
                }
            },
            plugins: [biomePlugin, emojiPlugin]
        });
    },

    showAuditDetails(point) {
        const panel = document.getElementById('audit-details');
        if (!panel) return;

        panel.classList.remove('hidden');
        // Clear previous content
        panel.innerHTML = '';

        // RPG Hero Card Construction
        const card = document.createElement('div');
        card.className = 'rpg-hero-card';

        // Calculate RPG Stats (0-100 Scale relative to max/avg?)
        // Just using raw values for now but styled nicely

        const p = point.stats;

        card.innerHTML = `
            <div class="hero-header ${point.type.toLowerCase()}">
                <div class="hero-avatar">${point.emoji}</div>
                <div class="hero-info">
                    <h2>${point.name}</h2>
                    <div class="hero-class">${point.type} Class</div>
                    <div class="hero-id">ID: ${p.id}</div>
                </div>
                <div class="hero-badge">${point.desc}</div>
            </div>
            
            <div class="hero-stats-grid">
                <div class="stat-box str">
                    <div class="stat-label">STR (Kill Points)</div>
                    <div class="stat-val">+${Utils.formatCompactNumber(p.kpDelta)}</div>
                    <div class="stat-bar"><div style="width: ${Math.min(100, (p.kpDelta / 10000000) * 100)}%"></div></div>
                </div>
                
                <div class="stat-box vit">
                    <div class="stat-label">VIT (Deads)</div>
                    <div class="stat-val">+${Utils.formatCompactNumber(p.deadsDelta)}</div>
                     <div class="stat-bar"><div style="width: ${Math.min(100, (p.deadsDelta / 100000) * 100)}%"></div></div>
                </div>
                
                <div class="stat-box dex">
                    <div class="stat-label">DEX (Efficiency)</div>
                    <div class="stat-val">${p.ratio.toFixed(2)}</div>
                     <div class="stat-bar"><div style="width: ${Math.min(100, p.ratio * 20)}%"></div></div>
                </div>
                
                <div class="stat-box int">
                    <div class="stat-label">INT (Power)</div>
                    <div class="stat-val">${Utils.formatCompactNumber(p.power)}</div>
                </div>
            </div>
        `;

        panel.appendChild(card);
    },

    // --- 2. The Purge List ---
    renderPurgeList() {
        const tbody = document.querySelector('#purgeTable tbody');
        if (!tbody) return;

        const threshold = parseFloat(document.getElementById('purgeThreshold').value || 1.0);
        const data = this.getUnifiedData();

        // Filter: Anyone with KP/Power Ratio < Threshold is a suspect
        // BUT exclude very low power (farm accounts < 10M?) - optional
        const suspects = data.filter(p => p.ratio < threshold && p.power > 10000000).sort((a, b) => a.ratio - b.ratio);

        tbody.innerHTML = suspects.map(p => `
            <tr>
                <td>${p.name} <div style="font-size:0.8em; color:#888;">${p.id}</div></td>
                <td>${Utils.formatNumber(p.power)}</td>
                <td style="color:#10b981;">+${Utils.formatNumber(p.kpDelta)}</td>
                <td style="color: #ef4444; font-weight:bold;">${p.ratio.toFixed(2)}</td>
                <td>${p.archetype || 'Potato 🥔'}</td>
            </tr>
        `).join('');
    },

    copyPurgeList() {
        const tbody = document.querySelector('#purgeTable tbody');
        if (!tbody) return;

        // Extract text
        let text = "🚨 **THE PURGE LIST** 🚨\nPower > 10M | Low Efficiency\n\n";
        tbody.querySelectorAll('tr').forEach(tr => {
            const cols = tr.querySelectorAll('td');
            text += `${cols[0].innerText.split('\n')[0]} - Ratio: ${cols[3].innerText}\n`;
        });

        navigator.clipboard.writeText(text).then(() => alert("List Copied to Clipboard! 📋"));
    },

    // --- 3. War Potential ---
    renderWarPotential() {
        const container = document.getElementById('warStatsGrid');
        if (!container) return;

        const kState = this.data.state.kingdoms[this.activeKingdomId];
        // Use End Data for latest stats
        const data = kState.endData || kState.startData || [];

        let t4 = 0, t5 = 0, power = 0, kp = 0, deads = 0;

        data.forEach(r => {
            t4 += Utils.parseNumber(r['T4 Kills']);
            t5 += Utils.parseNumber(r['T5 Kills']);
            power += Utils.parseNumber(r['Power']);
            kp += Utils.parseNumber(r['Kill Points']);
            deads += Utils.parseNumber(r['Dead']);
        });

        // Cards
        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Power</h3>
                <div class="value">${Utils.formatNumber(power)}</div>
            </div>
            <div class="stat-card">
                <h3>T4 Kills (Total)</h3>
                <div class="value">${Utils.formatNumber(t4)}</div>
            </div>
            <div class="stat-card">
                <h3>T5 Kills (Total)</h3>
                <div class="value">${Utils.formatNumber(t5)}</div>
            </div>
             <div class="stat-card">
                <h3>Total Deads</h3>
                <div class="value">${Utils.formatNumber(deads)}</div>
            </div>
        `;
    },

    // --- Helpers ---
    getUnifiedData() {
        const kState = this.data.state.kingdoms[this.activeKingdomId];
        if (!kState) return [];

        const startData = kState.startData || [];
        const endData = kState.endData || [];

        // Map Start Data for quick lookup
        const startMap = new Map(startData.map(p => [p['Governor ID'], p]));

        // We primarily iterate over End Data (current status)
        // If End Data is missing, we fall back to Start Data (but Deltas will be 0)
        const sourceData = endData.length > 0 ? endData : startData;

        return sourceData.map(pEnd => {
            const id = pEnd['Governor ID'];
            const pStart = startMap.get(id) || {};

            // Value Helpers
            const getVal = (row, key) => Utils.parseNumber(row?.[key]);

            // 1. End Stats (Current Size)
            const powerEnd = getVal(pEnd, 'Power');
            const kpEnd = getVal(pEnd, 'Kill Points');
            const deadsEnd = getVal(pEnd, 'Dead');

            // 2. Start Stats (Baseline)
            const kpStart = getVal(pStart, 'Kill Points');
            const deadsStart = getVal(pStart, 'Dead');

            // 3. Deltas (Activity during Span)
            // If pStart is empty (new player), Delta = Total (Acceptable for "Performance during this scan period")
            const kpDelta = Math.max(0, kpEnd - kpStart);
            const deadsDelta = Math.max(0, deadsEnd - deadsStart);

            // 4. Activity Score
            // Weighted Activity: KP + (Deads * 10)
            const activityScore = kpDelta + (deadsDelta * 10);

            // 5. Efficiency Ratio
            // "KP per Power" logic, but relative to this period's activity vs current size
            // How much did you fight given your size?
            // Ratio = KP Delta / Power End
            const ratio = powerEnd > 0 ? kpDelta / powerEnd : 0;

            return {
                id: id,
                name: pEnd['Governor Name'] || pEnd['Name'],
                power: powerEnd, // Y-Axis
                kp: kpEnd,
                deads: deadsEnd,
                kpDelta,        // Display
                deadsDelta,     // Display
                score: activityScore, // X-Axis
                ratio: ratio
            };
        }).filter(p => p.power > 0);
    }
};

window.UIGovernance = UIGovernance;
