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
    }

    init() {
        // Run immediately once
        this.tick();

        // Setup interval for every second
        this.intervalId = setInterval(() => this.tick(), 1000);
        console.log("World Clock initialized.");
    }

    tick() {
        const now = new Date();

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
                    second: '2-digit',
                    hour12: !isUTC // UTC 24hr, others 12hr AM/PM
                }).format(now);

                const dateStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: clock.timeZone,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }).format(now);

                timeEl.textContent = timeStr;
                dateEl.textContent = dateStr;
            }
        });
    }

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}
