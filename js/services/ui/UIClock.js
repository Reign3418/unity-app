class UIClock {
    constructor() {
        this.clocks = [
            // Top Row
            { id: 'clock-pt', timeZone: 'America/Los_Angeles' },
            { id: 'clock-et', timeZone: 'America/New_York' },
            { id: 'clock-paris', timeZone: 'Europe/Paris' },
            { id: 'clock-germany', timeZone: 'Europe/Berlin' },
            { id: 'clock-poland', timeZone: 'Europe/Warsaw' },
            // Center
            { id: 'clock-utc', timeZone: 'UTC' },
            // Bottom Rows
            { id: 'clock-riyadh', timeZone: 'Asia/Riyadh' },
            { id: 'clock-vietnam', timeZone: 'Asia/Ho_Chi_Minh' },
            { id: 'clock-thailand', timeZone: 'Asia/Bangkok' },
            { id: 'clock-china', timeZone: 'Asia/Shanghai' },
            { id: 'clock-philippines', timeZone: 'Asia/Manila' },
            { id: 'clock-korea', timeZone: 'Asia/Seoul' },
            { id: 'clock-jst', timeZone: 'Asia/Tokyo' },
            { id: 'clock-aet', timeZone: 'Australia/Sydney' }
        ];

        this.intervalId = null;
        this.customTimeInput = null;
        this.clearBtn = null;
    }

    init() {
        this.customTimeInput = document.getElementById('customUtcTimeInput');
        this.clearBtn = document.getElementById('clearUtcTimeBtn');

        if (this.customTimeInput) {
            this.customTimeInput.addEventListener('input', () => this.tick());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                if (this.customTimeInput) {
                    this.customTimeInput.value = '';
                    this.tick();
                }
            });
        }

        // Run immediately once
        this.tick();

        // Setup interval for every second
        this.intervalId = setInterval(() => this.tick(), 1000);
        console.log("World Clock initialized with Converter.");
    }

    tick() {
        let referenceTime = new Date();
        let isFrozen = false;

        // If the user has typed a time into the converter, freeze the clocks to that time
        if (this.customTimeInput && this.customTimeInput.value) {
            const [hours, minutes] = this.customTimeInput.value.split(':');
            referenceTime = new Date();
            referenceTime.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
            isFrozen = true;
        }

        this.clocks.forEach(clock => {
            const container = document.getElementById(clock.id);
            if (!container) return; // Fail gracefully if DOM isn't ready

            const timeEl = container.querySelector('.clock-time');
            const dateEl = container.querySelector('.clock-date');

            if (timeEl && dateEl) {
                // Determine format
                const isUTC = clock.timeZone === 'UTC';
                const timeStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: clock.timeZone,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: isFrozen ? undefined : '2-digit', // Hide seconds if frozen
                    hour12: !isUTC // UTC 24hr, others 12hr AM/PM
                }).format(referenceTime);

                const dateStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: clock.timeZone,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }).format(referenceTime);

                timeEl.textContent = timeStr;
                dateEl.textContent = dateStr;

                // Visual freeze feedback
                const converterPanel = document.getElementById('clock-converter-panel');
                if (isFrozen) {
                    timeEl.style.color = "var(--accent-primary)";
                    container.style.borderColor = "var(--accent-primary)";
                    if (converterPanel) converterPanel.style.borderColor = "var(--accent-primary)";
                } else {
                    timeEl.style.color = "";
                    container.style.borderColor = "";
                    if (converterPanel) converterPanel.style.borderColor = "var(--border-color)";
                }
            }
        });
    }

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}
