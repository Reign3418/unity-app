// ==========================================
// SERVICE: FIXED MGE PLANNER (Drag & Drop)
// ==========================================
const UIMGEPlanner = {
    data: null,
    activeKingdomId: null,
    sourceAlliances: new Set(),
    targets: [], // { id, rank, commander, limit, members: [] } // members max 1

    init(dataService, kingdomId) {
        this.data = dataService;
        this.activeKingdomId = kingdomId;

        // Try restoring from localStorage, or init empty array
        try {
            const saved = localStorage.getItem('mge_targets_' + kingdomId);
            if (saved) {
                this.targets = JSON.parse(saved);
            } else {
                this.targets = [];
            }
        } catch (e) {
            console.warn("Cleared corrupted targets storage");
            this.targets = [];
        }

        try {
            const savedSources = localStorage.getItem('mge_sources_' + kingdomId);
            if (savedSources) {
                this.sourceAlliances = new Set(JSON.parse(savedSources));
            } else {
                this.sourceAlliances = new Set();
            }
        } catch (e) {
            console.warn("Cleared corrupted source storage");
            this.sourceAlliances = new Set();
        }

        // Force Generation of Overview Data if not present
        if (window.ui && typeof window.ui.updateOverview === 'function') {
            window.ui.updateOverview(kingdomId);
        }

        this.populateAllianceFilter();
        this.renderPool();
        this.renderWorkspace();

        const container = this.getContainer();
        if (!container) return;

        const searchInput = container.querySelector('.mge-search');
        if (searchInput) searchInput.oninput = () => this.renderPool();

        const sortSelect = container.querySelector('.mge-sort-select');
        if (sortSelect) sortSelect.onchange = () => this.renderPool();

        const allianceFilter = container.querySelector('.mge-alliance-filter');
        if (allianceFilter) allianceFilter.onchange = () => {
            if (allianceFilter.value) {
                this.addSourceAlliance(allianceFilter.value);
                allianceFilter.value = ""; // Reset dropdown to placeholder
            }
        };

        const addTargetBtn = container.querySelector('.mge-add-target-btn');
        if (addTargetBtn) addTargetBtn.onclick = () => this.createTarget();

        const clearBtn = container.querySelector('.mge-clear-all-btn');
        if (clearBtn) clearBtn.onclick = () => this.clearAll();
    },

    getContainer() {
        if (!this.activeKingdomId) return null;
        return document.getElementById(`kingdom-${this.activeKingdomId}`);
    },

    saveState() {
        localStorage.setItem('mge_targets_' + this.activeKingdomId, JSON.stringify(this.targets));
        localStorage.setItem('mge_sources_' + this.activeKingdomId, JSON.stringify(Array.from(this.sourceAlliances)));
    },

    populateAllianceFilter() {
        const container = this.getContainer();
        if (!container) return;

        const sourceContainer = container.querySelector('.mge-alliance-filter');
        if (!sourceContainer) return;

        const kState = this.data.state.kingdoms[this.activeKingdomId];
        if (!kState) return;

        const data = kState.currentOverviewData && kState.currentOverviewData.length > 0
            ? kState.currentOverviewData
            : (kState.endData && kState.endData.length > 0 ? kState.endData : kState.startData);

        if (!data || data.length === 0) return;

        const getAlliance = (r) => r['Alliance Tag'] || r['Alliance'] || r['Tag'] || r['alliance'] || '';
        const distinctAlliances = [...new Set(data.map(r => getAlliance(r)))]
            .filter(a => a && a !== '' && a !== 'None')
            .sort();

        // Keep the placeholder options
        sourceContainer.innerHTML = '<option value="">All Alliances / Add to filter...</option>';
        distinctAlliances.filter(tag => !this.sourceAlliances.has(tag)).forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag;
            sourceContainer.appendChild(opt);
        });

        // Add Active source pills above the dropdown
        let activeSourcesDiv = container.querySelector('.mge-active-sources');
        if (!activeSourcesDiv) {
            activeSourcesDiv = document.createElement('div');
            activeSourcesDiv.className = 'mge-active-sources';
            activeSourcesDiv.style.cssText = 'display:flex; flex-wrap:wrap; gap:5px; max-height:80px; overflow-y:auto; margin-bottom: 10px; margin-top: 10px;';
            sourceContainer.parentNode.insertBefore(activeSourcesDiv, sourceContainer.nextSibling);
        }

        activeSourcesDiv.innerHTML = Array.from(this.sourceAlliances).map(tag => `
            <span style="background: rgba(255, 255, 255, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255, 255, 255, 0.2);">
                ${tag}
                <span style="cursor:pointer; color: var(--danger-color); font-weight: bold;" onclick="UIAllianceMerge.removeSourceAlliance('${tag}')">&times;</span>
            </span>
        `).join('');
    },

    addSourceAlliance(tag) {
        if (!tag) return;
        this.sourceAlliances.add(tag);
        this.saveState();
        this.populateAllianceFilter();
        this.renderPool();
    },

    removeSourceAlliance(tag) {
        this.sourceAlliances.delete(tag);
        this.saveState();
        this.populateAllianceFilter();
        this.renderPool();
    },

    getVal(row, ...keys) {
        if (!row) return '';
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
        }
        return '';
    },

    renderPool() {
        const container = this.getContainer();
        if (!container) return;

        const poolContainer = container.querySelector('.mge-pool');
        const searchInput = container.querySelector('.mge-search');
        const sortSelect = container.querySelector('.mge-sort-select');

        if (!poolContainer) return;

        const filterText = (searchInput ? searchInput.value : '').toLowerCase();
        const sortBy = sortSelect ? sortSelect.value : 'power';

        const kState = this.data.state.kingdoms[this.activeKingdomId];
        const data = (kState.endData && kState.endData.length > 0)
            ? kState.endData
            : (kState.currentOverviewData && kState.currentOverviewData.length > 0 ? kState.currentOverviewData : kState.startData);

        if (!data || data.length === 0) {
            poolContainer.innerHTML = '<div style="padding:1rem;">No data loaded.</div>';
            return;
        }

        // Only include players from selected source alliances if any are selected, else show all
        let available = data;
        if (this.sourceAlliances.size > 0) {
            available = available.filter(p => {
                const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance');
                return this.sourceAlliances.has(alliance);
            });
        }

        // Filter out those already in target buckets
        const assignedIds = new Set();
        this.targets.forEach(t => t.members.forEach(m => assignedIds.add(String(m.id))));

        available = available.filter(p => {
            const id = this.getVal(p, 'Governor ID', 'ID', 'id');
            return !assignedIds.has(String(id));
        });

        // Search text
        if (filterText) {
            available = available.filter(p => {
                const name = String(this.getVal(p, 'Governor Name', 'Name', 'name')).toLowerCase();
                const alliance = String(this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance')).toLowerCase();
                const id = String(this.getVal(p, 'Governor ID', 'ID', 'id'));
                return name.includes(filterText) || alliance.includes(filterText) || id.includes(filterText);
            });
        }

        // Sort
        available.sort((a, b) => {
            let valA = 0, valB = 0;
            if (sortBy === 'power') {
                valA = parseFloat(this.getVal(a, '_raw_Power_End', 'Power', 'power')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Power_End', 'Power', 'power')) || 0;
                return valB - valA;
            } else if (sortBy === 'kp') {
                valA = parseFloat(this.getVal(a, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
                return valB - valA;
            } else if (sortBy === 'deads') {
                valA = parseFloat(this.getVal(a, '_raw_Deads_End', 'Deads', 'dead')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Deads_End', 'Deads', 'dead')) || 0;
                return valB - valA;
            } else if (sortBy === 'name') {
                const nameA = String(this.getVal(a, 'Governor Name', 'Name', 'name')).toLowerCase();
                const nameB = String(this.getVal(b, 'Governor Name', 'Name', 'name')).toLowerCase();
                return nameA.localeCompare(nameB);
            }
            return 0;
        });

        if (available.length === 0) {
            poolContainer.innerHTML = '<div style="padding:1rem; text-align:center;">No players found or all assigned.</div>';
        } else {
            // Cap at 250 for performance while dragging
            poolContainer.innerHTML = available.slice(0, 250).map(p => this.createPlayerCard(p)).join('');
        }
    },

    createPlayerCard(p) {
        const id = this.getVal(p, 'Governor ID', 'ID', 'id');
        const name = this.getVal(p, 'Governor Name', 'Name', 'name') || 'Unknown';
        const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-';

        const powerRaw = parseFloat(this.getVal(p, '_raw_Power_End', 'Power', 'power')) || 0;
        const kpRaw = parseFloat(this.getVal(p, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;

        return `
            <div class="wc-player" draggable="true" ondragstart="uiMGEPlanner.dragStart(event, '${id}', null)" data-id="${id}">
                <div class="wc-player-header">
                    <span class="wc-player-name">[${alliance}] ${name}</span>
                </div>
                <div class="wc-player-stats">
                    <span title="Power">⚔️ ${Utils.formatCompactNumber(powerRaw)}</span>
                    <span title="Kill Points">☠️ ${Utils.formatCompactNumber(kpRaw)}</span>
                    <span style="color:var(--text-muted); font-size: 0.8em; margin-left:auto;">ID: ${id}</span>
                </div>
            </div>
        `;
    },

    renderWorkspace() {
        const container = this.getContainer();
        if (!container) return;
        const workspace = container.querySelector('.mge-target-container');
        if (!workspace) return;

        // Ensure targets are sorted by rank 1 to 15 (if numerical) before rendering
        this.targets.sort((a, b) => {
            let rankA = parseInt(a.rank) || 99;
            let rankB = parseInt(b.rank) || 99;
            return rankA - rankB;
        });

        workspace.innerHTML = this.targets.map(t => this.createTargetHTML(t)).join('');

        workspace.innerHTML = this.targets.map(t => this.createTargetHTML(t)).join('');

        // Ensure the export button is visible in the top header rather than injected into the flex grid
        const exportHeaderBtn = document.getElementById('mgeExportMailBtn');
        if (exportHeaderBtn) {
            exportHeaderBtn.style.display = 'block';
            exportHeaderBtn.onclick = () => this.exportToMail();
        }
    },

    updateTargetField(id, field, val) {
        const target = this.targets.find(t => t.id === id);
        if (target) {
            target[field] = val;
            this.saveState();
        }
    },

    createTargetHTML(target) {
        const hasMember = target.members.length > 0;
        const rankOptions = [
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-15", "16-25", "Open"
        ];

        let rankSelectHtml = `<select style="background:transparent; color:var(--accent-primary); font-weight:bold; font-size:1.1rem; border:none; border-bottom:1px solid #555;" onchange="uiMGEPlanner.updateTargetField('${target.id}', 'rank', this.value)">`;
        rankOptions.forEach(r => {
            const selected = (target.rank === r) ? 'selected' : '';
            rankSelectHtml += `<option value="${r}" ${selected}>Rank ${r}</option>`;
        });
        rankSelectHtml += `</select>`;

        const cmdrOptions = ['Open Choice', 'Cavalry', 'Infantry', 'Archer', 'Leadership'];
        let cmdrSelectHtml = `<select style="background: rgba(0,0,0,0.2); color:white; font-size:0.9rem; padding: 4px; border-radius: 4px; border:1px solid #555;" onchange="uiMGEPlanner.updateTargetField('${target.id}', 'commander', this.value)">`;
        cmdrOptions.forEach(c => {
            const selected = (target.commander === c) ? 'selected' : '';
            cmdrSelectHtml += `<option value="${c}" ${selected}>${c}</option>`;
        });
        cmdrSelectHtml += `</select>`;

        return `
            <div class="wc-squad" data-id="${target.id}" style="border: 1px solid ${hasMember ? 'var(--accent-primary)' : '#444'}; width: 320px; flex: 0 0 auto;" ondrop="if(window.uiMGEPlanner) window.uiMGEPlanner.drop(event, '${target.id}')" ondragover="if(window.uiMGEPlanner) window.uiMGEPlanner.allowDrop(event)">
                <div class="wc-squad-header">
                    ${rankSelectHtml}
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="wc-icon-btn" onclick="uiMGEPlanner.deleteTarget('${target.id}')" title="Delete Rank">🗑️</button>
                    </div>
                </div>
                
                <div style="margin: 5px 15px; display:flex; flex-direction: column; gap: 8px; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                        <label style="font-size: 0.8em; color: var(--text-secondary); width: 80px;">Commander:</label>
                        ${cmdrSelectHtml}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                        <label style="font-size: 0.8em; color: var(--text-secondary); width: 80px;">Limit:</label>
                        <input type="number" placeholder="No limit" value="${target.limit || ''}" style="width: 120px; padding: 4px; border-radius: 4px; color: black;" onblur="window.uiMGEPlanner.updateTargetField('${target.id}', 'limit', this.value)">
                    </div>
                </div>

                <div class="wc-squad-list" style="min-height: 60px; background: rgba(0,0,0,0.1); border-radius: 8px; margin: 10px; padding: 10px; display:flex; align-items:center; justify-content:center;">
                    ${hasMember ? target.members.map(m => `
                        <div class="wc-player" style="width: 100%; margin:0;" draggable="true" ondragstart="uiMGEPlanner.dragStart(event, '${m.id}', '${target.id}')">
                            <div class="wc-player-header">
                                <span class="wc-player-name">[${m.alliance}] ${m.name}</span>
                                <button class="wc-icon-btn delete-btn" onclick="uiMGEPlanner.removeMember('${target.id}', '${m.id}')">✕</button>
                            </div>
                            <div class="wc-player-stats">
                                <span title="Power">⚔️ ${Utils.formatCompactNumber(m.power || 0)}</span>
                                <span title="Kill Points">☠️ ${Utils.formatCompactNumber(m.kp || 0)}</span>
                            </div>
                        </div>
                    `).join('') : '<span style="color:var(--text-muted); font-size: 0.9em; pointer-events:none;">Drop Governor Here</span>'}
                </div>
            </div>
        `;
    },

    createTarget() {
        // Find next logical rank
        let nextRank = "1";
        if (this.targets.length > 0) {
            const last = parseInt(this.targets[this.targets.length - 1].rank);
            if (!isNaN(last)) {
                nextRank = (last + 1).toString();
                if (last >= 10 && last < 15) nextRank = "11-15";
                else if (last >= 15) nextRank = "16-25";
            }
        }

        this.targets.push({
            id: 'mge_' + Date.now(),
            rank: nextRank,
            commander: "Open Choice",
            limit: "",
            members: [] // Limit 1 in logic
        });
        this.saveState();
        this.renderWorkspace();
    },

    deleteTarget(id) {
        this.targets = this.targets.filter(t => t.id !== id);
        this.saveState();
        this.renderWorkspace();
        this.renderPool();
    },

    clearAll() {
        if (!confirm('Clear all MGE ranks and return governors to pool?')) return;
        this.targets = [];
        this.saveState();
        this.renderWorkspace();
        this.renderPool();
    },

    removeMember(targetId, memberId) {
        const target = this.targets.find(t => t.id === targetId);
        if (target) {
            target.members = target.members.filter(m => m.id !== String(memberId));
            this.saveState();
            this.renderWorkspace();
            this.renderPool();
        }
    },

    // --- Drag & Drop ---
    dragStart(ev, playerId, sourceTargetId) {
        ev.dataTransfer.setData("text", JSON.stringify({ playerId, sourceTargetId }));
        ev.stopPropagation();
    },

    allowDrop(ev) { ev.preventDefault(); },

    drop(ev, destinationTargetId) {
        ev.preventDefault();
        ev.stopPropagation();

        try {
            const raw = ev.dataTransfer.getData("text");
            if (!raw) return;
            const data = JSON.parse(raw);
            const playerId = data.playerId;
            const sourceTargetId = data.sourceTargetId;

            // Dropped onto same target?
            if (sourceTargetId === destinationTargetId) return;

            // Dropping back into the pool container
            if (typeof destinationTargetId === "object") {
                if (sourceTargetId) {
                    const src = this.targets.find(t => t.id === sourceTargetId);
                    if (src) src.members = src.members.filter(m => String(m.id) !== String(playerId));
                    this.saveState();
                    this.renderWorkspace();
                    this.renderPool();
                }
                return;
            }

            // Get player details
            const kState = this.data.state.kingdoms[this.activeKingdomId];
            const allData = (kState.endData && kState.endData.length > 0)
                ? kState.endData
                : (kState.currentOverviewData && kState.currentOverviewData.length > 0 ? kState.currentOverviewData : kState.startData);

            const row = allData.find(r => String(this.getVal(r, 'Governor ID', 'ID', 'id')) === String(playerId));
            if (!row) return;

            const newMember = {
                id: String(playerId),
                name: this.getVal(row, 'Governor Name', 'Name', 'name') || 'Unknown',
                alliance: this.getVal(row, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-',
                power: parseFloat(this.getVal(row, '_raw_Power_End', 'Power', 'power')) || 0,
                kp: parseFloat(this.getVal(row, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0
            };

            // Before assignment, ensure destination isn't full (Max 1 for MGE)
            const dest = this.targets.find(t => t.id === destinationTargetId);
            if (dest && dest.members.length >= 1) {
                // Return the old member to the pool by overwriting them
            }

            // Remove from source map
            if (sourceTargetId) {
                const src = this.targets.find(t => t.id === sourceTargetId);
                if (src) src.members = src.members.filter(m => String(m.id) !== String(playerId));
            }

            // Add to dest (overwrites existing member if any due to max 1)
            if (dest) {
                dest.members = [newMember];
            }

            this.saveState();
            this.renderWorkspace();
            this.renderPool();

        } catch (e) {
            console.error(e);
        }
    },

    exportToMail() {
        if (this.targets.length === 0) {
            alert("No Governors assigned. Add some governors to the MGE first.");
            return;
        }

        // Generate Mail String
        let mailStr = `<b>Fixed MGE Allocations - Kingdom ${this.activeKingdomId}</b>\n\n`;

        // Ensure sorted chronologically by rank before exporting
        const sortedTargets = [...this.targets].sort((a, b) => (parseInt(a.rank) || 99) - (parseInt(b.rank) || 99));

        sortedTargets.forEach(item => {
            const formattedLimit = (parseInt(item.limit) > 0) ? parseInt(item.limit).toLocaleString() : 'None';
            const govName = item.members.length > 0 ? item.members[0].name : 'Unassigned';
            mailStr += `<b>Rank ${item.rank}:</b> ${govName} (${item.commander})\n`;
            mailStr += `<color=#ff8c00>Point Limit:</color> ${formattedLimit}\n\n`;
        });

        mailStr += `<i>Please respect the point limits above. Overcapping may result in penalties.</i>\n`;

        // Load into the Mail Generator Tool
        const mailInput = document.getElementById('mail-input');

        if (mailInput) {
            mailInput.value = mailStr;
            mailInput.dispatchEvent(new Event('input', { bubbles: true }));

            if (window.uiNavigation) {
                window.uiNavigation.switchMainTab('mail');
            } else {
                const mailTabBtn = document.querySelector('.tab-btn[data-tab="mail"]');
                if (mailTabBtn) mailTabBtn.click();
            }
        } else {
            // Fallback just show modal
            alert("Mail structure:\n\n" + mailStr);
        }
    }
};

window.uiMGEPlanner = UIMGEPlanner;
window.UIMGEPlanner = UIMGEPlanner; // Global export for HTML listeners
