class CalculatorsService {
    constructor() {
        this.container = document.getElementById('calculators');
        if (!this.container) return;

        this.totalDisplay = document.getElementById('calcTotalDisplay');
        this.totalSuffix = document.getElementById('calcTotalSuffix');
        this.inputs = this.container.querySelectorAll('.calc-input');

        this.currentActiveTab = 'calc-speedups';

        this.initEventListeners();
    }

    initEventListeners() {
        // Subtab Navigation
        const subTabs = this.container.querySelectorAll('.calc-tab-btn');
        const calcLayout = this.container.querySelector('.calc-layout');
        const totalsPanelEl = this.container.querySelector('.calc-totals-panel');

        const applyTroopsLayout = (isTroops) => {
            if (calcLayout) calcLayout.style.gridTemplateColumns = isTroops ? '1fr' : '2fr 1fr';
            if (totalsPanelEl) totalsPanelEl.style.display = isTroops ? 'none' : '';
        };

        subTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.subtab;

                // Active Button styling
                subTabs.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Show/Hide Content
                this.container.querySelectorAll('.calc-tab-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.dataset.content === targetId) {
                        content.classList.add('active');
                    }
                });

                this.currentActiveTab = targetId;
                applyTroopsLayout(targetId === 'calc-troops');
                this.calculateTotal(); // Recalculate if switching
            });
        });

        // Input Changes
        this.inputs.forEach(input => {
            // Recalculate on any input
            input.addEventListener('input', () => this.calculateTotal());
            // Prevent negative numbers (browser should handle min=0 but just in case)
            input.addEventListener('change', (e) => {
                if (e.target.value < 0) e.target.value = 0;
            });
        });

        // Clear All
        const clearBtn = document.getElementById('calcClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.container.querySelectorAll(`.calc-tab-content[data-content="${this.currentActiveTab}"] .calc-input`).forEach(input => {
                    input.value = '';
                });
                this.calculateTotal();
            });
        }
    }

    calculateTotal() {
        if (!this.totalDisplay) return;

        const activeContent = this.container.querySelector(`.calc-tab-content[data-content="${this.currentActiveTab}"]`);
        if (!activeContent) return;

        const activeInputs = activeContent.querySelectorAll('.calc-input');
        let total = 0;

        activeInputs.forEach(input => {
            const qty = parseInt(input.value) || 0;
            const val = parseInt(input.dataset.val) || 0;
            total += (qty * val);
        });

        this.renderTotal(total);
    }

    renderTotal(total) {
        if (this.currentActiveTab === 'calc-speedups') {
            this.totalDisplay.textContent = total.toLocaleString() + ' m';
            this.totalSuffix.textContent = this.formatTime(total);
        } else if (this.currentActiveTab === 'calc-rss') {
            this.totalDisplay.textContent = this.formatNumber(total);
            this.totalSuffix.textContent = 'Resources'; // Generic suffix for now
        } else {
            // AP, VIP, XP
            this.totalDisplay.textContent = total.toLocaleString();
            let label = "";
            if (this.currentActiveTab === 'calc-ap') label = "Action Points";
            if (this.currentActiveTab === 'calc-vip') label = "VIP Points";
            if (this.currentActiveTab === 'calc-xp') label = "XP";
            this.totalSuffix.textContent = label;
        }
    }

    formatTime(minutes) {
        if (minutes === 0) return '0 Days';

        let days = Math.floor(minutes / 1440);
        let rem = minutes % 1440;
        let hours = Math.floor(rem / 60);
        let mins = rem % 60;

        let parts = [];
        if (days > 0) parts.push(`${days} Days`);
        if (hours > 0) parts.push(`${hours} Hours`);
        if (mins > 0) parts.push(`${mins} Mins`);

        return parts.join(', ');
    }

    // Example 1.2M format
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2).replace(/\.00$/, '') + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return num.toLocaleString();
    }
}

// Attach to global scope for instantiation
window.CalculatorsService = CalculatorsService;

// ─────────────────────────────────────────────
// Troop Training Calculator
// ─────────────────────────────────────────────

class TroopTrainingCalc {
    // Base stats per tier (training time in seconds per troop)
    static TIERS = {
        1: { timeSec: 5, food: 90, wood: 90, stone: 0, gold: 0, power: 5 },
        2: { timeSec: 60, food: 500, wood: 500, stone: 0, gold: 0, power: 20 },
        3: { timeSec: 180, food: 1800, wood: 1800, stone: 0, gold: 0, power: 60 },
        4: { timeSec: 720, food: 6800, wood: 6800, stone: 6800, gold: 0, power: 200 },
        5: { timeSec: 1800, food: 15000, wood: 15000, stone: 15000, gold: 5000, power: 500 },
    };

    constructor() {
        this.speedBuff = document.getElementById('troopSpeedBuff');
        this.clearBtn = document.getElementById('troopClearBtn');
        this.inputs = document.querySelectorAll('.troop-input');

        this.els = {
            time: document.getElementById('troopResTime'),
            food: document.getElementById('troopResFood'),
            wood: document.getElementById('troopResWood'),
            stone: document.getElementById('troopResStone'),
            gold: document.getElementById('troopResGold'),
            power: document.getElementById('troopResPower'),
            speedups: document.getElementById('troopResSpeedups'),
        };

        if (!this.inputs.length) return;
        this.inputs.forEach(inp => inp.addEventListener('input', () => this.recalculate()));
        if (this.speedBuff) this.speedBuff.addEventListener('input', () => this.recalculate());
        if (this.clearBtn) this.clearBtn.addEventListener('click', () => this.clearAll());

        this.recalculate(); // initialise display
    }

    recalculate() {
        const buff = Math.max(0, parseFloat(this.speedBuff?.value) || 0);
        const multiplier = 1 + buff / 100;

        let totalTimeSec = 0, food = 0, wood = 0, stone = 0, gold = 0, power = 0;

        this.inputs.forEach(inp => {
            const qty = parseInt(inp.value) || 0;
            if (qty <= 0) return;
            const tier = parseInt(inp.dataset.tier);
            const t = TroopTrainingCalc.TIERS[tier];
            if (!t) return;

            totalTimeSec += (t.timeSec / multiplier) * qty;
            food += t.food * qty;
            wood += t.wood * qty;
            stone += t.stone * qty;
            gold += t.gold * qty;
            power += t.power * qty;
        });

        const totalMin = totalTimeSec / 60;

        this.set('time', this.formatTime(totalMin));
        this.set('food', this.fmt(food));
        this.set('wood', this.fmt(wood));
        this.set('stone', this.fmt(stone));
        this.set('gold', this.fmt(gold));
        this.set('power', this.fmt(power));
        this.set('speedups', this.formatSpeedups(totalMin));
    }

    set(key, val) {
        if (this.els[key]) this.els[key].textContent = val;
    }

    clearAll() {
        this.inputs.forEach(inp => inp.value = '');
        this.recalculate();
    }

    fmt(num) {
        if (num === 0) return '—';
        if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
        return num.toLocaleString();
    }

    formatTime(minutes) {
        if (minutes <= 0) return '—';
        const d = Math.floor(minutes / 1440);
        const h = Math.floor((minutes % 1440) / 60);
        const m = Math.round(minutes % 60);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        return parts.join(' ') || '< 1m';
    }

    formatSpeedups(minutes) {
        if (minutes <= 0) return '—';
        // Preferred: show in 24h speedups + remainder
        const days24 = Math.floor(minutes / 1440);
        const rem8h = Math.floor((minutes % 1440) / 480);
        const rem1h = Math.floor((minutes % 480) / 60);
        const rem1m = Math.round(minutes % 60);
        const parts = [];
        if (days24 > 0) parts.push(`${days24}× 24h`);
        if (rem8h > 0) parts.push(`${rem8h}× 8h`);
        if (rem1h > 0) parts.push(`${rem1h}× 1h`);
        if (rem1m > 0) parts.push(`${rem1m}× 1m`);
        return parts.join(', ') || '< 1m';
    }
}

window.TroopTrainingCalc = TroopTrainingCalc;
