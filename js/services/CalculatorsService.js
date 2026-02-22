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
