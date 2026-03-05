class UICamps {
    constructor(dataService) {
        this.data = dataService;
        this.baseWeightInputs = {
            t4Weight: document.getElementById('campsT4Weight'),
            t5Weight: document.getElementById('campsT5Weight'),
            deadWeight: document.getElementById('campsDeadWeight'),
            t4DeadWeight: document.getElementById('campsT4DeadWeight'),
            t5DeadWeight: document.getElementById('campsT5DeadWeight'),
            dkpMode: document.getElementById('campsDkpMode')
        };
        this.bindEvents();
    }

    bindEvents() {
        const addBtn = document.getElementById('addCampBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.addCamp());

        // We also want to re-render camps when DKP weights change in the All Kingdoms tab
        Object.values(this.baseWeightInputs).forEach(input => {
            if (input) {
                input.addEventListener('input', Utils.debounce(() => this.renderCampsDashboard(), 300));
            }
        });

        // DKP Mode toggle
        if (this.baseWeightInputs.dkpMode) {
            this.baseWeightInputs.dkpMode.addEventListener('change', (e) => {
                const isAdvanced = e.target.value === 'advanced';
                const basicInputs = document.getElementById('basicCampsInputs');
                const advancedInputs = document.getElementById('advancedCampsInputs');

                if (basicInputs) isAdvanced ? basicInputs.classList.add('hidden') : basicInputs.classList.remove('hidden');
                if (advancedInputs) isAdvanced ? advancedInputs.classList.remove('hidden') : advancedInputs.classList.add('hidden');

                this.renderCampsDashboard();
            });
        }
    }

    updateCampKingdomSelects() {
        const container = document.getElementById('campKingdomSelects');
        if (!container) return;

        container.innerHTML = '';
        if (this.data.state.loadedKingdoms.size === 0) {
            container.innerHTML = '<span style="font-style: italic; opacity:0.7;">No kingdoms loaded yet.</span>';
            return;
        }

        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const wrapper = document.createElement('label');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '5px';
            wrapper.style.cursor = 'pointer';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = kId;
            cb.className = 'camp-kingdom-cb';

            wrapper.appendChild(cb);
            wrapper.appendChild(document.createTextNode(kId));
            container.appendChild(wrapper);
        });
    }

    addCamp() {
        const nameInput = document.getElementById('newCampName');
        const colorInput = document.getElementById('newCampColor');
        const checkboxes = document.querySelectorAll('.camp-kingdom-cb:checked');

        const name = nameInput.value.trim();
        const color = colorInput.value;
        const kingdoms = Array.from(checkboxes).map(cb => cb.value);

        if (!name) {
            alert('Please enter a Camp Name.');
            return;
        }
        if (kingdoms.length === 0) {
            alert('Please select at least one Kingdom for this Camp.');
            return;
        }

        const newCamp = {
            id: 'camp_' + Date.now(),
            name: name,
            color: color,
            kingdoms: kingdoms
        };

        if (!this.data.state.camps) this.data.state.camps = [];
        this.data.state.camps.push(newCamp);
        this.data.saveState();

        // Reset form
        nameInput.value = '';
        document.querySelectorAll('.camp-kingdom-cb').forEach(cb => cb.checked = false);

        this.renderCampsDashboard();
    }

    deleteCamp(campId) {
        if (!confirm('Are you sure you want to delete this camp?')) return;
        this.data.state.camps = this.data.state.camps.filter(c => c.id !== campId);
        this.data.saveState();
        this.renderCampsDashboard();
    }

    renderCampsDashboard() {
        const tbody = document.querySelector('#campComparisonTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!this.data.state.camps || this.data.state.camps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No camps configured. Create one above!</td></tr>';
            return;
        }

        const dkpMode = this.baseWeightInputs.dkpMode?.value || 'basic';
        const t4Weight = parseFloat(this.baseWeightInputs.t4Weight?.value) || 10;
        const t5Weight = parseFloat(this.baseWeightInputs.t5Weight?.value) || 20;
        const deadWeight = parseFloat(this.baseWeightInputs.deadWeight?.value) || 30;
        const t4DeadWeight = parseFloat(this.baseWeightInputs.t4DeadWeight?.value) || 50;
        const t5DeadWeight = parseFloat(this.baseWeightInputs.t5DeadWeight?.value) || 100;

        this.data.state.camps.forEach(camp => {
            let stats = { startPower: 0, powerDiff: 0, t4: 0, t5: 0, deads: 0, kp: 0, dkp: 0, activePlayers: 0 };

            // Reusable logic from UIRenderers.js adapted for Camps
            camp.kingdoms.forEach(kingdomId => {
                const kState = this.data.state.kingdoms[kingdomId];
                if (!kState || !kState.calculatedData) return;

                stats.activePlayers += kState.calculatedData.length;

                kState.calculatedData.forEach(p => {
                    stats.startPower += p.startPower || 0;
                    stats.powerDiff += p.powerDiff || 0;
                    stats.t4 += p.t4 || 0;
                    stats.t5 += p.t5 || 0;
                    stats.deads += p.deads || 0;
                });

                // DKP accumulation per kingdom level (to account for HoH data if it exists)
                let kKp = 0;
                let kDkp = 0;

                kState.calculatedData.forEach(p => {
                    kKp += ((p.t4 || 0) * t4Weight) + ((p.t5 || 0) * t5Weight);
                });

                if (dkpMode === 'advanced' && kState.hohData && (kState.hohData.t4 > 0 || kState.hohData.t5 > 0)) {
                    kDkp = kKp + (kState.hohData.t4 * t4DeadWeight) + (kState.hohData.t5 * t5DeadWeight);
                } else {
                    // Have to aggregate kingdom deads for basic
                    let kDeads = 0;
                    kState.calculatedData.forEach(p => kDeads += (p.deads || 0));
                    kDkp = kKp + (kDeads * deadWeight);
                }

                stats.kp += kKp;
                stats.dkp += kDkp;
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="width:12px; height:12px; border-radius:50%; background-color:${camp.color}; box-shadow: 0 0 5px ${camp.color};"></span>
                        <strong style="color:${camp.color}">${camp.name}</strong>
                    </div>
                </td>
                <td><div style="max-width:200px; overflow-wrap:normal; word-wrap:break-word; font-size:0.85rem;" title="${camp.kingdoms.join(', ')}">${camp.kingdoms.join('<br>')}</div></td>
                <td>${stats.activePlayers.toLocaleString()}</td>
                <td>${stats.startPower.toLocaleString()}</td>
                <td class="${stats.powerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.powerDiff.toLocaleString()}</td>
                <td>${stats.t4.toLocaleString()}</td>
                <td>${stats.t5.toLocaleString()}</td>
                <td>${stats.deads.toLocaleString()}</td>
                <td>${stats.kp.toLocaleString()}</td>
                <td style="font-weight:bold; font-size:1.1rem; color:var(--text-primary)">${Math.round(stats.dkp).toLocaleString()}</td>
                <td>
                    <button class="delete-camp-btn" data-id="${camp.id}" style="background:transparent; border:none; color:var(--danger-color); cursor:pointer; font-size:1.2rem;" title="Delete Camp">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind delete buttons
        document.querySelectorAll('.delete-camp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteCamp(e.target.dataset.id));
        });
    }
}
window.UICamps = UICamps;
