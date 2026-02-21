// ==========================================
// SERVICE: UI ALLIANCE MERGE
// ==========================================
const UIAllianceMerge = {
    data: null,
    activeKingdomId: null,
    sourceAlliances: new Set(),
    targets: [], // { id, name, capacity, members: [] }

    init(dataService, kingdomId) {
        this.data = dataService;
        this.activeKingdomId = kingdomId;

        // Try restoring from localStorage, or init empty array
        try {
            const saved = localStorage.getItem('am_targets_' + kingdomId);
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
            const savedSources = localStorage.getItem('am_sources_' + kingdomId);
            if (savedSources) {
                this.sourceAlliances = new Set(JSON.parse(savedSources));
            } else {
                this.sourceAlliances = new Set();
            }
        } catch (e) {
            console.warn("Cleared corrupted source storage");
            this.sourceAlliances = new Set();
        }

        // Extremely important: Force Generation of Overview Data if not present
        if (window.ui && typeof window.ui.updateOverview === 'function') {
            window.ui.updateOverview(kingdomId);
        }

        this.populateAllianceFilter();
        this.renderPool();
        this.renderWorkspace();

        const container = this.getContainer();
        if (!container) return;

        const searchInput = container.querySelector('.am-search');
        if (searchInput) searchInput.oninput = () => this.renderPool();

        const sortSelect = container.querySelector('.am-sort-select');
        if (sortSelect) sortSelect.onchange = () => this.renderPool();
    },

    getContainer() {
        if (!this.activeKingdomId) return null;
        return document.getElementById(`kingdom-${this.activeKingdomId}`);
    },

    saveState() {
        localStorage.setItem('am_targets_' + this.activeKingdomId, JSON.stringify(this.targets));
        localStorage.setItem('am_sources_' + this.activeKingdomId, JSON.stringify(Array.from(this.sourceAlliances)));
    },

    populateAllianceFilter() {
        const container = this.getContainer();
        if (!container) return;

        const sourceContainer = container.querySelector('.am-source-alliances');
        if (!sourceContainer) return;

        const kState = this.data.state.kingdoms[this.activeKingdomId];
        if (!kState) return;

        const data = kState.currentOverviewData && kState.currentOverviewData.length > 0
            ? kState.currentOverviewData
            : (kState.endData && kState.endData.length > 0 ? kState.endData : kState.startData);

        if (!data || data.length === 0) {
            sourceContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.9em; padding:4px;">No data loaded. Please upload a scan.</span>';
            return;
        }

        const getAlliance = (r) => r['Alliance Tag'] || r['Alliance'] || r['Tag'] || r['alliance'] || '';
        const distinctAlliances = [...new Set(data.map(r => getAlliance(r)))]
            .filter(a => a && a !== '' && a !== 'None')
            .sort();

        sourceContainer.innerHTML = '';
        if (distinctAlliances.length === 0) {
            sourceContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.9em; padding:4px;">No alliances found in dataset.</span>';
            return;
        }

        let html = `
            <select class="wc-search-input" style="margin-bottom: 8px; width: 100%; padding: 6px;" onchange="if(this.value) { UIAllianceMerge.addSourceAlliance(this.value); }">
                <option value="">+ Add Alliance to Pool...</option>
                ${distinctAlliances.filter(tag => !this.sourceAlliances.has(tag)).map(tag => `<option value="${tag}">${tag}</option>`).join('')}
            </select>
            <div style="display:flex; flex-wrap:wrap; gap:5px; max-height:80px; overflow-y:auto; margin-bottom: 10px;">
                ${Array.from(this.sourceAlliances).map(tag => `
                    <span style="background: rgba(255, 255, 255, 0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255, 255, 255, 0.2);">
                        ${tag}
                        <span style="cursor:pointer; color: var(--danger-color); font-weight: bold;" onclick="UIAllianceMerge.removeSourceAlliance('${tag}')">&times;</span>
                    </span>
                `).join('')}
            </div>
        `;
        sourceContainer.innerHTML = html;
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

        const poolContainer = container.querySelector('.am-pool');
        const searchInput = container.querySelector('.am-search');
        const sortSelect = container.querySelector('.am-sort-select');

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

        // Only include players from selected source alliances
        let available = data.filter(p => {
            const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance');
            return this.sourceAlliances.has(alliance);
        });

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
            } else if (sortBy === 'kp') {
                valA = parseFloat(this.getVal(a, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
            } else if (sortBy === 'deads') {
                valA = parseFloat(this.getVal(a, '_raw_Deads_End', 'Deads', 'dead')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Deads_End', 'Deads', 'dead')) || 0;
            }
            return valB - valA;
        });

        if (this.sourceAlliances.size === 0) {
            poolContainer.innerHTML = '<div style="padding:1rem; text-align:center;">Select at least one source alliance.</div>';
        } else if (available.length === 0) {
            poolContainer.innerHTML = '<div style="padding:1rem; text-align:center;">No players found or all assigned.</div>';
        } else {
            poolContainer.innerHTML = available.map(p => this.createPlayerCard(p)).join('');
        }
    },

    createPlayerCard(p) {
        const id = this.getVal(p, 'Governor ID', 'ID', 'id');
        const name = this.getVal(p, 'Governor Name', 'Name', 'name') || 'Unknown';
        const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-';

        const powerRaw = parseFloat(this.getVal(p, '_raw_Power_End', 'Power', 'power')) || 0;
        const kpRaw = parseFloat(this.getVal(p, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
        const cmdrRaw = parseFloat(this.getVal(p, 'Commander Power', 'Cmdr Power', 'commander')) || 0;

        return `
            <div class="wc-player" draggable="true" ondragstart="UIAllianceMerge.dragStart(event, '${id}', null)" data-id="${id}">
                <div class="wc-player-header">
                    <span class="wc-player-name">[${alliance}] ${name}</span>
                </div>
                <div class="wc-player-stats">
                    <span title="Power">⚔️ ${Utils.formatCompactNumber(powerRaw)}</span>
                    <span title="Kill Points">☠️ ${Utils.formatCompactNumber(kpRaw)}</span>
                    <span title="Commander Power">👮 ${Utils.formatCompactNumber(cmdrRaw)}</span>
                </div>
            </div>
        `;
    },

    renderWorkspace() {
        const container = this.getContainer();
        if (!container) return;
        const workspace = container.querySelector('.am-target-container');
        if (!workspace) return;

        workspace.innerHTML = this.targets.map(t => this.createTargetHTML(t)).join('');
    },

    updateTargetName(id, val) {
        const target = this.targets.find(t => t.id === id);
        if (target) {
            target.name = val;
            this.saveState();
        }
    },

    updateTargetCapacity(id, val) {
        const target = this.targets.find(t => t.id === id);
        if (target) {
            target.capacity = parseInt(val, 10) || 0;
            this.saveState();
            this.renderWorkspace(); // re-render to reflect capacity bar? we skip for typing lag
        }
    },

    createTargetHTML(target) {
        const totalPower = target.members.reduce((sum, m) => sum + (m.power || 0), 0);
        const totalKP = target.members.reduce((sum, m) => sum + (m.kp || 0), 0);
        const count = target.members.length;
        const isFull = count >= target.capacity;
        const statusColor = isFull ? 'var(--danger-color)' : 'var(--text-secondary)';

        return `
            <div class="wc-squad" data-id="${target.id}" ondrop="UIAllianceMerge.drop(event, '${target.id}')" ondragover="UIAllianceMerge.allowDrop(event)">
                <div class="wc-squad-header">
                    <input type="text" value="${target.name}" style="background:transparent; color:white; font-weight:bold; font-size:1.1rem; border:none; border-bottom:1px solid #555;" onblur="UIAllianceMerge.updateTargetName('${target.id}', this.value)">
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="wc-icon-btn" onclick="UIAllianceMerge.exportToMail('${target.id}')" title="Export to Mail" style="color:var(--info-color);">📤</button>
                        <button class="wc-icon-btn" onclick="UIAllianceMerge.deleteTarget('${target.id}')" title="Delete Target">🗑️</button>
                    </div>
                </div>
                <!-- Capacity Input -->
                <div style="margin: 5px 15px; display:flex; gap: 10px; align-items: center;">
                    <label style="font-size: 0.8em; color: var(--text-secondary);">Capacity:</label>
                    <input type="number" value="${target.capacity}" style="width: 60px; padding: 2px; color: black;" onblur="UIAllianceMerge.updateTargetCapacity('${target.id}', this.value)">
                </div>
                <div class="wc-squad-stats-header">
                    <span>⚡ ${Utils.formatCompactNumber(totalPower)}</span>
                    <span>☠️ ${Utils.formatCompactNumber(totalKP)}</span>
                    <span style="color: ${statusColor}">👤 ${count}/${target.capacity}</span>
                </div>
                <div class="wc-squad-list">
                    ${target.members.map(m => `
                        <div class="wc-player" draggable="true" ondragstart="UIAllianceMerge.dragStart(event, '${m.id}', '${target.id}')">
                            <div class="wc-player-header">
                                <span class="wc-player-name">[${m.alliance}] ${m.name}</span>
                                <button class="wc-icon-btn delete-btn" onclick="UIAllianceMerge.removeMember('${target.id}', '${m.id}')">✕</button>
                            </div>
                            <div class="wc-player-stats">
                                <span title="Power">⚔️ ${Utils.formatCompactNumber(m.power || 0)}</span>
                                <span title="Kill Points">☠️ ${Utils.formatCompactNumber(m.kp || 0)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    createTarget() {
        this.targets.push({
            id: 'target_' + Date.now(),
            name: 'New Alliance',
            capacity: 155,
            members: []
        });
        this.saveState();
        this.renderWorkspace();
    },

    deleteTarget(id) {
        if (!confirm('Delete this target alliance? Members will return to pool.')) return;
        this.targets = this.targets.filter(t => t.id !== id);
        this.saveState();
        this.renderWorkspace();
        this.renderPool();
    },

    clearAll() {
        if (!confirm('Clear all targets?')) return;
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
                kp: parseFloat(this.getVal(row, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0,
                cmdr: parseFloat(this.getVal(row, 'Commander Power', 'Cmdr Power', 'commander')) || 0
            };

            // Remove from source
            if (sourceTargetId) {
                const src = this.targets.find(t => t.id === sourceTargetId);
                if (src) src.members = src.members.filter(m => String(m.id) !== String(playerId));
            }

            // Add to dest
            if (destinationTargetId) {
                const dest = this.targets.find(t => t.id === destinationTargetId);
                if (dest && dest.members.length < dest.capacity) {
                    dest.members.push(newMember);
                } else if (dest && dest.members.length >= dest.capacity) {
                    // Over capacity manually allowed? Let's say yes but alert
                    dest.members.push(newMember);
                }
            }

            this.saveState();
            this.renderWorkspace();
            this.renderPool();

        } catch (e) {
            console.error(e);
        }
    },

    // --- Auto Fill Logic ---
    autoFill() {
        if (this.targets.length === 0) {
            alert('Create at least one target alliance first!');
            return;
        }

        const container = this.getContainer();
        const sortSelect = container.querySelector('.am-sort-select');
        const sortBy = sortSelect ? sortSelect.value : 'power';
        const minPowerInput = container.querySelector('.am-min-power');
        const minPower = minPowerInput && minPowerInput.value ? parseFloat(minPowerInput.value) : 0;
        const topXInput = container.querySelector('.am-top-x');
        const topX = topXInput && topXInput.value ? parseInt(topXInput.value, 10) : 0;

        // Get pool (filtered by source alliances but ignoring search text)
        const kState = this.data.state.kingdoms[this.activeKingdomId];
        const data = (kState.endData && kState.endData.length > 0)
            ? kState.endData
            : (kState.currentOverviewData && kState.currentOverviewData.length > 0 ? kState.currentOverviewData : kState.startData);

        if (!data || data.length === 0) return;

        let available = data.filter(p => {
            const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance');
            return this.sourceAlliances.has(alliance);
        });

        const assignedIds = new Set();
        this.targets.forEach(t => t.members.forEach(m => assignedIds.add(String(m.id))));

        available = available.filter(p => !assignedIds.has(String(this.getVal(p, 'Governor ID', 'ID', 'id'))));

        // Apply Min Power Filter
        if (minPower > 0) {
            available = available.filter(p => {
                const pwr = parseFloat(this.getVal(p, '_raw_Power_End', 'Power', 'power')) || 0;
                return pwr >= minPower;
            });
        }

        // Apply Top X per Alliance Filter
        if (topX > 0) {
            const countsPerAlliance = {};
            // Need to sort by power first to grab the actual "Top" X before slicing
            available.sort((a, b) => {
                const valA = parseFloat(this.getVal(a, '_raw_Power_End', 'Power', 'power')) || 0;
                const valB = parseFloat(this.getVal(b, '_raw_Power_End', 'Power', 'power')) || 0;
                return valB - valA;
            });

            available = available.filter(p => {
                const alliance = this.getVal(p, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-';
                if (!countsPerAlliance[alliance]) countsPerAlliance[alliance] = 0;

                if (countsPerAlliance[alliance] < topX) {
                    countsPerAlliance[alliance]++;
                    return true;
                }
                return false;
            });
        }

        if (available.length === 0) {
            alert('No unassigned players in the selected source alliances matching your filters.');
            return;
        }

        // Sort available players based on selected dropdown
        available.sort((a, b) => {
            let valA = 0, valB = 0;
            if (sortBy === 'power') {
                valA = parseFloat(this.getVal(a, '_raw_Power_End', 'Power', 'power')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Power_End', 'Power', 'power')) || 0;
            } else if (sortBy === 'kp') {
                valA = parseFloat(this.getVal(a, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0;
            } else if (sortBy === 'deads') {
                valA = parseFloat(this.getVal(a, '_raw_Deads_End', 'Deads', 'dead')) || 0;
                valB = parseFloat(this.getVal(b, '_raw_Deads_End', 'Deads', 'dead')) || 0;
            }
            return valB - valA;
        });

        // Distribute
        let distributedCount = 0;

        for (const target of this.targets) {
            let availableSlots = target.capacity - target.members.length;
            while (availableSlots > 0 && available.length > 0) {
                const row = available.shift(); // take from highest due to descending sort
                target.members.push({
                    id: String(this.getVal(row, 'Governor ID', 'ID', 'id')),
                    name: this.getVal(row, 'Governor Name', 'Name', 'name') || 'Unknown',
                    alliance: this.getVal(row, 'Alliance Tag', 'Alliance', 'Tag', 'alliance') || '-',
                    power: parseFloat(this.getVal(row, '_raw_Power_End', 'Power', 'power')) || 0,
                    kp: parseFloat(this.getVal(row, '_raw_Kill Points_End', 'Kill Points', 'kp')) || 0,
                    cmdr: parseFloat(this.getVal(row, 'Commander Power', 'Cmdr Power', 'commander')) || 0
                });
                availableSlots--;
                distributedCount++;
            }
        }

        this.saveState();
        this.renderWorkspace();
        this.renderPool();

        alert(`Successfully auto-filled ${distributedCount} players into targets.`);
    },

    exportToMail(targetId) {
        const target = this.targets.find(t => t.id === targetId);
        if (!target || target.members.length === 0) {
            alert("No members in this target to export!");
            return;
        }

        const mailTabBtn = document.querySelector('.tab-btn[data-tab="mail"]');
        const mailContentInput = document.getElementById('mail-input');

        if (!mailTabBtn || !mailContentInput) {
            alert('Mail Generator module not found! Please check if the tab is enabled.');
            console.error('Mail Export Failed:', { btn: mailTabBtn, input: mailContentInput });
            return;
        }

        const totalPower = target.members.reduce((sum, m) => sum + (m.power || 0), 0);

        // Minimal formatting to avoid hitting in-game character limits
        let content = `<size=40><b>${target.name}</b></size>\n`;
        content += `${target.members.length}/${target.capacity} | ⚔️${Utils.formatCompactNumber(totalPower)}\n`;
        content += `──────────────────────\n`;

        target.members.forEach((m, i) => {
            const num = (i + 1).toString().padStart(2, '0');
            const power = Utils.formatCompactNumber(m.power || 0);
            content += `${num}. ${m.name} (${power})\n`;
        });

        // Switch to the mail tab
        mailTabBtn.click();

        // Inject content
        setTimeout(() => {
            mailContentInput.value = content;
            mailContentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }, 100);
    }
};

window.UIAllianceMerge = UIAllianceMerge;
