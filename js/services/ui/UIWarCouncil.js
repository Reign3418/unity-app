const UIWarCouncil = {
    data: null, // Reference to DataService
    draggedPlayerId: null,
    squads: [], // Array of squad objects { id, name, members: [] }
    activeKingdomId: null,

    init(dataService, kingdomId) {
        this.data = dataService;
        this.activeKingdomId = kingdomId;
        this.loadSquads();

        const container = this.getContainer();
        if (!container) return; // Should not happen if index.html is correct

        // Populate Filter ONCE
        this.populateAllianceFilter();

        // Render
        this.renderPool();
        this.renderWorkspace();

        // Attach Listeners
        const searchInput = container.querySelector('.wc-search');
        if (searchInput) {
            searchInput.oninput = () => this.renderPool();
        }

        const allianceFilter = container.querySelector('.wc-alliance-filter');
        if (allianceFilter) {
            allianceFilter.onchange = () => {
                this.renderPool();
                this.renderWorkspace(); // Update squads too to reflect tag visibility
            };
        }
    },

    getContainer() {
        if (!this.activeKingdomId) return null;
        return document.getElementById(`kingdom-${this.activeKingdomId}`);
    },

    loadSquads() {
        const saved = localStorage.getItem('wc_squads');
        if (saved) {
            this.squads = JSON.parse(saved);
        } else {
            this.squads = [];
        }
    },

    saveSquads() {
        localStorage.setItem('wc_squads', JSON.stringify(this.squads));
    },

    // --- Rendering ---

    populateAllianceFilter() {
        const container = this.getContainer();
        if (!container) return;

        const allianceSelect = container.querySelector('.wc-alliance-filter');
        if (!allianceSelect) return;

        const kState = this.data.state.kingdoms[this.activeKingdomId];
        if (!kState) return;

        // Use currentOverviewData if available, otherwise fallback to endData or startData
        const data = kState.currentOverviewData && kState.currentOverviewData.length > 0
            ? kState.currentOverviewData
            : (kState.endData && kState.endData.length > 0 ? kState.endData : kState.startData);

        if (!data || data.length === 0) return;

        // Clear existing options
        allianceSelect.innerHTML = '<option value="">All Alliances</option>';

        // Robustly get alliance tag
        const getAlliance = (r) => {
            return r['Alliance Tag'] || r['Alliance'] || r['Tag'] || r['alliance'] || '';
        };

        const distinctAlliances = [...new Set(data.map(r => getAlliance(r)))]
            .filter(a => a && a !== '' && a !== 'None')
            .sort();

        distinctAlliances.forEach(tag => {
            allianceSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
        });
    },

    renderPool() {
        const container = this.getContainer();
        if (!container) return;

        const poolContainer = container.querySelector('.wc-pool');
        const searchInput = container.querySelector('.wc-search');
        const allianceSelect = container.querySelector('.wc-alliance-filter');

        if (!poolContainer || !searchInput) return;

        const filterText = (searchInput.value || '').toLowerCase();
        const filterAlliance = allianceSelect ? allianceSelect.value : "";

        const kState = this.data.state.kingdoms[this.activeKingdomId];

        // User Request: Prioritize END DATA for most up-to-date stats
        const data = (kState.endData && kState.endData.length > 0)
            ? kState.endData
            : (kState.currentOverviewData && kState.currentOverviewData.length > 0 ? kState.currentOverviewData : kState.startData);

        if (!data || data.length === 0) {
            poolContainer.innerHTML = '<div style="padding:1rem;">No data loaded. Please upload an End Scan.</div>';
            return;
        }

        // Helper to safely get properties with fallbacks
        const getVal = (row, ...keys) => {
            if (!row) return '';
            for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
            }
            return '';
        };

        // Filter players NOT in any squad
        const assignedIds = new Set();
        this.squads.forEach(s => s.members.forEach(m => assignedIds.add(String(m.id))));

        try {
            const available = data.filter(p => {
                const id = getVal(p, 'Governor ID', 'ID', 'id');
                return !assignedIds.has(String(id));
            });

            // Apply Filters
            const filtered = available.filter(p => {
                const name = String(getVal(p, 'Governor Name', 'Name', 'name')).toLowerCase();
                const alliance = String(getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance')).toLowerCase();
                const id = String(getVal(p, 'Governor ID', 'ID', 'id'));

                const textMatch = name.includes(filterText) ||
                    alliance.includes(filterText) ||
                    id.includes(filterText);

                // Strict alliance match for dropdown
                const allianceVal = String(getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance'));
                const allianceMatch = filterAlliance === "" || allianceVal === filterAlliance;

                return textMatch && allianceMatch;
            });

            // Sort by Power (desc)
            filtered.sort((a, b) => {
                const pA = parseFloat(getVal(a, '_raw_Power_End', 'Power', 'power')) || 0;
                const pB = parseFloat(getVal(b, '_raw_Power_End', 'Power', 'power')) || 0;
                return pB - pA;
            });

            if (filtered.length === 0) {
                // Check if data existed but everything filtered out
                if (available.length > 0) {
                    // DEBUG: Show available keys to help diagnose why everything is filtered out
                    const firstRow = available[0];
                    const keys = Object.keys(firstRow).join(', ');
                    poolContainer.innerHTML = `
                        <div style="padding:1rem; text-align:center;">
                            No players match filters.<br>
                            <small style="color:grey;">Debug: Available Data Keys: ${keys}</small>
                        </div>`;
                } else {
                    poolContainer.innerHTML = '<div style="padding:1rem; text-align:center;">All players assigned to squads.</div>';
                }
            } else {
                poolContainer.innerHTML = filtered.slice(0, 100).map(p => this.createPlayerCard(p)).join('');
            }

        } catch (err) {
            console.error("WarCouncil Render Error:", err);
            poolContainer.innerHTML = `<div style="padding:1rem; color:red;">Error rendering pool: ${err.message}. Check console for details.</div>`;
        }
    },

    createPlayerCard(p) {
        // Helper to safely get properties (duplicated to keep method independent)
        const getVal = (row, ...keys) => {
            if (!row) return '';
            for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
            }
            return '';
        };

        const id = getVal(p, 'Governor ID', 'ID', 'id');
        const name = getVal(p, 'Governor Name', 'Name', 'name') || 'Unknown';
        const alliance = getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-';

        // Check active filter to potentially hide tag
        const container = this.getContainer();
        const allianceFilter = container ? container.querySelector('.wc-alliance-filter').value : "";

        let displayName = `[${alliance}] ${name}`;
        // If filter is active AND matches this player's alliance, hide the tag
        if (allianceFilter && alliance === allianceFilter) {
            displayName = name;
        }

        const powerRaw = parseFloat(getVal(p, '_raw_Power_End', 'Power', 'power')) || 0;
        const kpRaw = parseFloat(getVal(p, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
        const cmdrRaw = parseFloat(getVal(p, 'Commander Power', 'Cmdr Power', 'commander')) || 0;

        const power = Utils.formatCompactNumber(powerRaw);
        const kp = Utils.formatCompactNumber(kpRaw);
        const cmdr = Utils.formatCompactNumber(cmdrRaw);

        return `
            <div class="wc-player" draggable="true" ondragstart="UIWarCouncil.dragStart(event, '${id}', null)" data-id="${id}">
                <div class="wc-player-header">
                    <span class="wc-player-name">${displayName}</span>
                </div>
                <div class="wc-player-stats">
                    <span title="Power">⚔️ ${power}</span>
                    <span title="Kill Points">☠️ ${kp}</span>
                    <span title="Commander Power">👮 ${cmdr}</span>
                </div>
            </div>
        `;
    },

    renderWorkspace() {
        const container = this.getContainer();
        if (!container) return;
        const workspace = container.querySelector('.wc-workspace');

        if (!workspace) return;

        // Pass the current filter to createSquadHTML implicitly via DOM lookups inside it, 
        // or just rely on it calling the same logic if we updated createSquadHTML.
        // Actually best to read it here and pass it down, but for simplicity I'll look it up inside.

        workspace.innerHTML = this.squads.map(s => this.createSquadHTML(s)).join('');
    },

    createSquadHTML(squad) {
        const totalPower = squad.members.reduce((sum, m) => sum + (m.power || 0), 0);
        const totalKP = squad.members.reduce((sum, m) => sum + (m.kp || 0), 0);

        // Check active filter
        const container = this.getContainer();
        const allianceFilter = container ? container.querySelector('.wc-alliance-filter').value : "";

        return `
            <div class="wc-squad" data-id="${squad.id}" ondrop="UIWarCouncil.drop(event, '${squad.id}')" ondragover="UIWarCouncil.allowDrop(event)">
                <div class="wc-squad-header">
                    <span class="wc-squad-title" contenteditable="true" onblur="UIWarCouncil.renameSquad('${squad.id}', this.innerText)">${squad.name}</span>
                    <div>
                        <button class="wc-icon-btn wc-mail-btn" onclick="UIWarCouncil.sendToMail('${squad.id}')" title="Send to Mail Generator">✉️</button>
                        <button class="wc-icon-btn" onclick="UIWarCouncil.deleteSquad('${squad.id}')" title="Delete Squad">🗑️</button>
                    </div>
                </div>
                <div class="wc-squad-stats-header">
                    <span>⚡ ${Utils.formatCompactNumber(totalPower)}</span>
                    <span>☠️ ${Utils.formatCompactNumber(totalKP)}</span>
                    <span>👤 ${squad.members.length}/30</span>
                </div>
                <div class="wc-squad-list">
                    ${squad.members.map(m => {
            const pwr = Utils.formatCompactNumber(m.power || 0);
            const kp = Utils.formatCompactNumber(m.kp || 0);
            const cmdr = Utils.formatCompactNumber(m.cmdr || 0);

            let displayName = `[${m.alliance}] ${m.name}`;
            if (allianceFilter && m.alliance === allianceFilter) {
                displayName = m.name;
            }

            return `
                        <div class="wc-player" draggable="true" ondragstart="UIWarCouncil.dragStart(event, '${m.id}', '${squad.id}')">
                            <div class="wc-player-header">
                                <span class="wc-player-name">${displayName}</span>
                                <button class="wc-icon-btn delete-btn" onclick="UIWarCouncil.removeMember('${squad.id}', '${m.id}')">✕</button>
                            </div>
                            <div class="wc-player-stats">
                                <span title="Power">⚔️ ${pwr}</span>
                                <span title="Kill Points">☠️ ${kp}</span>
                                <span title="Commander Power">👮 ${cmdr}</span>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    },

    // --- Actions ---

    createSquad() {
        const id = 'squad_' + Date.now();
        this.squads.push({
            id: id,
            name: 'New Squad',
            members: []
        });
        this.saveSquads();
        this.renderWorkspace();
    },

    deleteSquad(squadId) {
        if (!confirm('Delete this squad?')) return;
        this.squads = this.squads.filter(s => s.id !== squadId);
        this.saveSquads();
        this.renderWorkspace();
        this.renderPool(); // Return members to pool
    },

    renameSquad(squadId, newName) {
        const squad = this.squads.find(s => s.id === squadId);
        if (squad) {
            squad.name = newName;
            this.saveSquads();
        }
    },

    clearAll() {
        if (!confirm('Clear all squads?')) return;
        this.squads = [];
        this.saveSquads();
        this.renderWorkspace();
        this.renderPool();
    },

    // --- Drag & Drop ---

    dragStart(ev, playerId, sourceSquadId) {
        // Store both ID and source in dataTransfer
        ev.dataTransfer.setData("text", JSON.stringify({ playerId, sourceSquadId }));
        ev.stopPropagation();
        this.draggedPlayerId = playerId;
    },

    allowDrop(ev) {
        ev.preventDefault();
    },

    drop(ev, targetSquadId) {
        ev.preventDefault();
        ev.stopPropagation();

        try {
            const rawData = ev.dataTransfer.getData("text");
            if (!rawData) return;

            const data = JSON.parse(rawData);
            const playerId = data.playerId;
            const sourceSquadId = data.sourceSquadId;

            // 1. If dropping onto the pool (no targetSquadId) or same squad, handle accordingly
            if (!targetSquadId) {
                // Drop to pool = Remove from source squad
                if (sourceSquadId) {
                    this.removeFromSquad(sourceSquadId, playerId);
                }
                return;
            }

            // 2. Drop to Target Squad
            const targetSquad = this.squads.find(s => s.id === targetSquadId);
            if (!targetSquad) return;

            // Check if already in target
            if (targetSquad.members.find(m => m.id === playerId)) return;

            // 3. Remove from source squad if moving between squads
            if (sourceSquadId && sourceSquadId !== targetSquadId) {
                this.removeFromSquad(sourceSquadId, playerId, false); // false = don't render yet
            }

            // 4. Add to target squad
            // Get data from active kingdom using this.activeKingdomId
            if (!this.activeKingdomId && this.data.state.kingdoms) {
                // Fallback if activeKingdomId lost?
                this.activeKingdomId = Object.keys(this.data.state.kingdoms)[0];
            }
            const kState = this.data.state.kingdoms[this.activeKingdomId];
            if (!kState) return;

            // User Request: Prioritize END DATA for most up-to-date stats
            const sourceData = (kState.endData && kState.endData.length > 0)
                ? kState.endData
                : (kState.currentOverviewData && kState.currentOverviewData.length > 0 ? kState.currentOverviewData : kState.startData);

            if (!sourceData) return;

            // Helper to safely get properties (duplicated to keep method independent)
            const getVal = (row, ...keys) => {
                if (!row) return '';
                for (const k of keys) {
                    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
                }
                return '';
            };

            const player = sourceData.find(p => getVal(p, 'Governor ID', 'ID', 'id') == playerId);

            if (player) {
                targetSquad.members.push({
                    id: getVal(player, 'Governor ID', 'ID', 'id'),
                    name: getVal(player, 'Governor Name', 'Name', 'name'),
                    alliance: getVal(player, 'Alliance Tag', 'Alliance', 'Tag', 'alliance'),
                    power: parseFloat(getVal(player, '_raw_Power_End', 'Power', 'power')) || 0,
                    kp: parseFloat(getVal(player, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0,
                    cmdr: parseFloat(getVal(player, 'Commander Power', 'Cmdr Power', 'commander')) || 0
                });
            }

            this.saveSquads();
            this.renderWorkspace();
            this.renderPool();

        } catch (e) {
            console.error("Drop error", e);
        }
    },

    removeFromSquad(squadId, playerId, shouldRender = true) {
        const squad = this.squads.find(s => s.id === squadId);
        if (squad) {
            squad.members = squad.members.filter(m => m.id !== playerId);
            if (shouldRender) {
                this.saveSquads();
                this.renderWorkspace();
                this.renderPool();
            }
        }
    },

    removeMember(squadId, memberId) {
        this.removeFromSquad(squadId, memberId);
    },

    sendToMail(squadId) {
        const squad = this.squads.find(s => s.id === squadId);
        if (!squad) return;

        // data-tab="mail" is the target
        const mailTab = document.querySelector('.tab-btn[data-tab="mail"]');
        const mailInput = document.getElementById('mail-input');

        if (mailTab && mailInput) {
            // Build Mail Content - Light Paper Theme
            // Title
            let content = `<size=40><color=#000000><b>${squad.name}</b></color></size>\n`;
            // Subtitle
            const totalPower = squad.members.reduce((sum, m) => sum + (m.power || 0), 0);
            content += `<size=24><color=#333333>Squad Size: ${squad.members.length} | Power: ${Utils.formatCompactNumber(totalPower)}</color></size>\n`;
            // Date
            content += `<size=18><color=#666666>${new Date().toLocaleString()}</color></size>\n`;
            // Divider
            content += `<color=#ccb888>________________________________________________</color>\n\n`;

            // List
            content += `<size=22><color=#000000><b>Priority Targets:</b></color></size>\n`;

            squad.members.forEach((m, i) => {
                const num = (i + 1).toString() + ".";
                const power = Utils.formatCompactNumber(m.power || 0);
                content += `<size=20><color=#222222>${num} [${m.alliance}] <b>${m.name}</b> (${power})</color></size>\n`;
            });
            content += `\n<size=18><color=#888888>Generated by Unity Team Builder</color></size>`;

            // Switch Tab
            mailTab.click();

            // Set Content
            setTimeout(() => {
                mailInput.value = content;
                mailInput.dispatchEvent(new Event('input', { bubbles: true }));
            }, 100);
        } else {
            alert('Mail Generator module not found! Please check if the tab is enabled.');
        }
    }
};

window.UIWarCouncil = UIWarCouncil;
