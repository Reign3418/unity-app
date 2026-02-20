const UISquadBuilder = {
    selectedSlot: 'primary', // 'primary' or 'secondary'
    squad: {
        primary: null,
        secondary: null,
        skills1: '5555',
        skills2: '5555'
    },

    init() {
        this.setupListeners();
        this.renderPool('all');
        this.updateUI();
    },

    setupListeners() {
        // Pool Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderPool(e.target.dataset.type);
            });
        });

        // Slot Selection
        document.querySelectorAll('.cmd-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                // Determine slot
                const slotType = e.currentTarget.dataset.slot;

                // If clicking an filled slot, ask to remove or just select?
                // Visual feedback: Highlight selected slot
                document.querySelectorAll('.cmd-slot').forEach(s => s.style.boxShadow = 'none');
                e.currentTarget.style.boxShadow = '0 0 15px #facc15';

                this.selectedSlot = slotType;
            });
        });

        // Skill Inputs
        const s1 = document.getElementById('skillInput1');
        const s2 = document.getElementById('skillInput2');

        if (s1) s1.addEventListener('input', (e) => {
            this.squad.skills1 = this.validateSkills(e.target.value);
            this.updateSynergy();
        });
        if (s2) s2.addEventListener('input', (e) => {
            this.squad.skills2 = this.validateSkills(e.target.value);
            this.updateSynergy();
        });

        // Reset
        const resetBtn = document.getElementById('resetSquadBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetSquad());

        // Default highlight
        const pSlot = document.querySelector('.cmd-slot.primary');
        if (pSlot) pSlot.style.boxShadow = '0 0 15px #facc15';
    },

    renderPool(type) {
        const grid = document.getElementById('commanderPoolGrid');
        if (!grid) return;

        grid.innerHTML = '';

        let list = window.COMMANDERS || [];
        if (type !== 'all') {
            list = list.filter(c => c.type === type);
        }

        list.forEach(cmd => {
            const el = document.createElement('div');
            el.className = `cmd-card ${cmd.rarity.toLowerCase()}`;
            el.style.backgroundImage = `url('${cmd.image}')`;
            el.title = `${cmd.name} (${cmd.type})`;

            // Interaction
            el.addEventListener('click', () => this.selectCommander(cmd));

            grid.appendChild(el);
        });
    },

    selectCommander(cmd) {
        if (this.selectedSlot === 'primary') {
            this.squad.primary = cmd;
            // Auto-switch to secondary for easier flow
            this.selectedSlot = 'secondary';
            document.querySelectorAll('.cmd-slot').forEach(s => s.style.boxShadow = 'none');
            const sSlot = document.querySelector('.cmd-slot.secondary');
            if (sSlot) sSlot.style.boxShadow = '0 0 15px #facc15';
        } else {
            this.squad.secondary = cmd;
        }

        this.updateUI();
    },

    updateUI() {
        const updateSlot = (slotType, cmd) => {
            const el = document.querySelector(`.cmd-slot.${slotType}`);
            if (!el) return;

            if (cmd) {
                el.classList.add('filled');
                el.style.backgroundImage = `url('${cmd.image}')`;
                el.querySelector('.slot-content').innerText = cmd.name;
            } else {
                el.classList.remove('filled');
                el.style.backgroundImage = '';
                el.querySelector('.slot-content').innerText = 'Select Commander';
            }
        };

        updateSlot('primary', this.squad.primary);
        updateSlot('secondary', this.squad.secondary);

        // Show/Hide Skill Config
        const skillConfig = document.getElementById('skillConfig');
        if (this.squad.primary || this.squad.secondary) {
            skillConfig.classList.remove('hidden');
        } else {
            skillConfig.classList.add('hidden');
        }

        this.updateSynergy();
    },

    updateSynergy() {
        const badge = document.getElementById('squadSynergy');
        if (!badge) return;

        if (!this.squad.primary || !this.squad.secondary) {
            badge.innerText = "???";
            badge.style.color = "#888";
            return;
        }

        // Basic Logic
        const p = this.squad.primary;
        const s = this.squad.secondary;

        let score = 0;
        let reasons = [];

        // 1. Same Type Bonus
        if (p.type === s.type) {
            score += 50;
            reasons.push(`${p.type} Synergy`);
        } else {
            // Leadership exception
            if (p.type === 'Leadership' || s.type === 'Leadership') {
                score += 30;
                reasons.push("Leadership Mix");
            } else {
                score -= 20;
                reasons.push("Type Mismatch");
            }
        }

        // 2. Skill Levels
        const levelScore = (str) => str.split('').reduce((a, b) => a + parseInt(b), 0);
        const s1 = levelScore(this.squad.skills1); // Max 20
        const s2 = levelScore(this.squad.skills2); // Max 20

        // Normalize 40 -> 50 pts
        score += ((s1 + s2) / 40) * 50;

        // Display
        badge.innerText = Math.round(score);

        if (score > 90) badge.style.color = "#10b981"; // S
        else if (score > 70) badge.style.color = "#facc15"; // A
        else badge.style.color = "#ef4444"; // B/C
    },

    validateSkills(val) {
        // Ensure 4 digits, 1-5
        let clean = val.replace(/[^1-5]/g, '');
        if (clean.length > 4) clean = clean.substring(0, 4);
        return clean;
    },

    resetSquad() {
        this.squad = { primary: null, secondary: null, skills1: '5555', skills2: '5555' };
        this.selectedSlot = 'primary';
        document.getElementById('skillInput1').value = '5555';
        document.getElementById('skillInput2').value = '5555';

        // Reset Visuals
        document.querySelectorAll('.cmd-slot').forEach(s => s.style.boxShadow = 'none');
        document.querySelector('.cmd-slot.primary').style.boxShadow = '0 0 15px #facc15';

        this.updateUI();
    }
};

window.UISquadBuilder = UISquadBuilder;
