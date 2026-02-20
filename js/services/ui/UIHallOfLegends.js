// ==========================================
// SERVICE: UI HALL OF LEGENDS
// ==========================================
Object.assign(UIService.prototype, {
    renderHallOfLegends(kingdomId) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState) return;

        const container = document.getElementById(`kingdom-${kingdomId}`);
        const holContainer = container.querySelector('.hol-container');
        if (!holContainer) return;

        // Ensure data is generated before filtering and rendering
        if (!kState.currentOverviewData || kState.currentOverviewData.length === 0) {
            this.updateOverview(kingdomId);
        }

        const allianceSelect = holContainer.querySelector('.hol-alliance-filter');

        // Populate Filter Options
        const alliances = new Set(kState.calculatedData.map(r => r.alliance).filter(a => a && a !== '-'));
        const sortedAlliances = Array.from(alliances).sort();
        const currentFilter = allianceSelect.value;

        allianceSelect.innerHTML = '<option value="">All Alliances</option>';
        sortedAlliances.forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag.toLowerCase();
            opt.textContent = tag;
            allianceSelect.appendChild(opt);
        });

        if (currentFilter && alliances.has(Array.from(allianceSelect.options).find(o => o.value === currentFilter)?.textContent)) {
            allianceSelect.value = currentFilter;
        }

        const badgesContainer = holContainer.querySelector('.hol-badges');
        const podiumContainer = holContainer.querySelector('.hol-podium');
        const categoryTitle = holContainer.querySelector('.hol-category-title');

        if (!badgesContainer || !podiumContainer || !categoryTitle) {
            console.error("Missing Hall of Legends DOM elements in template.");
            return;
        }

        const badges = [
            { id: 'titan', title: 'The Titan', desc: 'Highest Power Growth', icon: '⛰️' },
            { id: 'butcher', title: 'The Butcher', desc: 'Highest Kill Points', icon: '⚔️' },
            { id: 'shield', title: 'The Shield', desc: 'Most Troops Dead', icon: '🛡️' },
            { id: 'healer', title: 'The Saint', desc: 'Most RSS Assistance', icon: '🕊️' },
            { id: 'broker', title: 'The Broker', desc: 'Most RSS Gathered', icon: '🌾' },
            { id: 'warlord', title: 'The Warlord', desc: 'Commander Power Growth', icon: '👑' },
            { id: 'architect', title: 'The Architect', desc: 'Building Power Growth', icon: '🏗️' },
            { id: 'scientist', title: 'The Scientist', desc: 'Tech Power Growth', icon: '🔬' }
        ];

        let achievementsData = {};

        // --- Render Function ---
        const render = () => {
            const filterVal = allianceSelect.value.toLowerCase();
            let sourceData = kState.currentOverviewData || []; // Achievements use the Raw Deltas from Overview calc

            if (filterVal) {
                sourceData = sourceData.filter(r => r['Alliance Tag'] && r['Alliance Tag'].toLowerCase() === filterVal);
            }

            achievementsData = CalculationService.calculateAchievements(sourceData);

            // Render Badges
            badgesContainer.innerHTML = '';
            badges.forEach(badge => {
                const badgeEl = document.createElement('div');
                badgeEl.className = 'hol-badge';
                badgeEl.dataset.id = badge.id;
                badgeEl.innerHTML = `
                    <div class="hol-badge-icon">${badge.icon}</div>
                    <div class="hol-badge-name">${badge.title}</div>
                `;

                badgeEl.addEventListener('click', () => {
                    // Remove active from all
                    badgesContainer.querySelectorAll('.hol-badge').forEach(c => c.classList.remove('active'));
                    badgeEl.classList.add('active');
                    renderPodium(badge);
                });

                badgesContainer.appendChild(badgeEl);
            });

            // Reset Podium View
            podiumContainer.innerHTML = '';
            categoryTitle.textContent = 'Select a Badge to see the Legend';

            // Auto-select first badge if any
            if (badgesContainer.firstChild) {
                badgesContainer.firstChild.click();
            }
        };

        const renderPodium = (badge) => {
            categoryTitle.textContent = `${badge.icon} ${badge.title} - ${badge.desc}`;
            podiumContainer.innerHTML = '';

            const data = achievementsData[badge.id] || [];
            if (data.length === 0) {
                podiumContainer.innerHTML = '<div style="text-align:center; width:100%; padding-top: 5rem; color: var(--text-muted);">No data available for this category.</div>';
                return;
            }

            // Order: 2nd, 1st, 3rd for podium effect
            const createPodiumSpot = (player, rank) => {
                const heightClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : 'rank-3');

                if (!player) return `<div class="hol-step ${heightClass}" style="opacity: 0.2"></div>`;

                return `
                    <div class="hol-step ${heightClass}">
                        <div class="hol-rank-num">${rank}</div>
                        <div class="hol-player-card">
                            <div class="hol-avatar">
                                <!-- Initial or Icon -->
                                👤
                            </div>
                            <div class="hol-info">
                                <div class="hol-name">${player.name || 'Unknown'}</div>
                                <div class="hol-alliance">${player.alliance || '-'}</div>
                                <div class="hol-value">${Utils.formatCompactNumber(player.value)}</div>
                            </div>
                        </div>
                    </div>
                `;
            };

            let html = createPodiumSpot(data[1], 2);
            html += createPodiumSpot(data[0], 1);
            html += createPodiumSpot(data[2], 3);

            podiumContainer.innerHTML = html;
        };

        // Initial Render
        render();

        // Attach Event if not already
        if (!allianceSelect.dataset.hasListener) {
            allianceSelect.addEventListener('change', render);
            allianceSelect.dataset.hasListener = 'true';
        }
    }
});
