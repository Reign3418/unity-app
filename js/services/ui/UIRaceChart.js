const UIRaceChart = {
    data: null, // Reference to DataService
    chart: null,
    animationFrameId: null,
    isPlaying: false,
    progress: 0, // 0 to 1
    speedMultiplier: 1,
    currentMetric: 'power',

    // Config
    FRAMES_PER_SECOND: 60,
    DURATION_SECONDS: 10, // Base duration for 1x speed

    init(dataService) {
        this.data = dataService;
        this.setupListeners();
    },

    setupListeners() {
        const playBtn = document.getElementById('race-btn-play');
        const pauseBtn = document.getElementById('race-btn-pause');
        const resetBtn = document.getElementById('race-btn-reset');
        const metricSelect = document.getElementById('race-metric');
        const speedSelect = document.getElementById('race-speed');
        const allianceSelect = document.getElementById('race-alliance-filter');

        if (playBtn) playBtn.onclick = () => this.play();
        if (pauseBtn) pauseBtn.onclick = () => this.pause();
        if (resetBtn) resetBtn.onclick = () => this.reset();

        if (metricSelect) metricSelect.onchange = (e) => {
            this.currentMetric = e.target.value;
            this.reset();
        };

        if (speedSelect) speedSelect.onchange = (e) => {
            this.speedMultiplier = parseFloat(e.target.value);
        };

        if (allianceSelect) allianceSelect.onchange = () => {
            this.reset();
        };
    },

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.loop();
    },

    pause() {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    },

    reset() {
        this.pause();
        this.progress = 0;
        this.updateChart(0);
    },

    loop() {
        if (!this.isPlaying) return;

        // Increment progress
        // Amount to add per frame = 1 / (FPS * Duration) * Speed
        const increment = (1 / (this.FRAMES_PER_SECOND * this.DURATION_SECONDS)) * this.speedMultiplier;
        this.progress += increment;

        if (this.progress >= 1) {
            this.progress = 1;
            this.pause();
        }

        this.updateChart(this.progress);

        if (this.isPlaying) {
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    },

    populateAllianceFilter() {
        const allianceSelect = document.getElementById('race-alliance-filter');
        if (!allianceSelect) return;

        const activeKingdomId = Object.keys(this.data.state.kingdoms)[0];
        if (!activeKingdomId) return;
        const kState = this.data.state.kingdoms[activeKingdomId];

        // Use End Data for source of truth on Alliances
        const data = kState.endData || kState.startData || [];
        if (data.length === 0) return;

        // Save current selection
        const currentVal = allianceSelect.value;

        // Clear existing options (keep default)
        allianceSelect.innerHTML = '<option value="">All Alliances</option>';

        // Helper
        const getAlliance = (r) => r['Alliance Tag'] || r['Alliance'] || r['Tag'] || r['alliance'] || '';

        const distinctAlliances = [...new Set(data.map(r => getAlliance(r)))]
            .filter(a => a && a !== '' && a !== 'None')
            .sort();

        distinctAlliances.forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.innerText = tag;
            if (tag === currentVal) opt.selected = true;
            allianceSelect.appendChild(opt);
        });
    },

    prepareData() {
        // We need Start and End data matched by ID
        const activeKingdomId = Object.keys(this.data.state.kingdoms)[0]; // Default to first
        if (!activeKingdomId) return [];

        const kState = this.data.state.kingdoms[activeKingdomId];
        const startData = kState.startData || [];
        const endData = kState.endData || [];

        // Identify Key and Fallback for Metrics
        let key = '_raw_Power_End'; // Default internal
        let label = 'Power';

        if (this.currentMetric === 'kp') {
            key = '_raw_Kill Points_End';
            label = 'Kill Points';
        } else if (this.currentMetric === 'deads') {
            key = '_raw_Dead_End';
            label = 'Deads';
        }

        // Helper to get value from a row
        const getVal = (row, metric) => {
            if (!row) return 0;
            // Logic to find metric safely
            if (metric === 'power') return parseFloat(row['_raw_Power_End'] || row['Power'] || 0);
            if (metric === 'kp') return parseFloat(row['_raw_Kill Points_End'] || row['Kill Points'] || 0);
            if (metric === 'deads') return parseFloat(row['_raw_Dead_End'] || row['Dead'] || 0);
            return 0;
        };

        const getAlliance = (r) => r['Alliance Tag'] || r['Alliance'] || r['Tag'] || r['alliance'] || '';

        // Filter logic
        const allianceFilter = document.getElementById('race-alliance-filter')?.value || "";

        // Map End Data to Players (Master List)
        let players = endData.map(p => {
            const id = p['Governor ID'] || p['ID'];
            const name = p['Governor Name'] || p['Name'] || 'Unknown';
            const alliance = getAlliance(p);
            const endVal = getVal(p, this.currentMetric);

            // Find Start Value
            const startRow = startData.find(s => (s['Governor ID'] || s['ID']) === id);
            const startVal = getVal(startRow, this.currentMetric);

            return {
                id,
                name,
                alliance,
                start: startVal,
                end: endVal,
                current: startVal // Init
            };
        });

        // Apply Alliance Filter
        if (allianceFilter) {
            players = players.filter(p => p.alliance === allianceFilter);
        }

        // Filter out zero-growth or low-value players to improve performance?
        // Top 20 only for the race visuals
        return players.sort((a, b) => b.end - a.end).slice(0, 50); // Take top 50 candidates
    },

    render() {
        // Populate filter if needed (once)
        // Check if options > 1 (meaning more than just "All Alliances")
        const allianceSelect = document.getElementById('race-alliance-filter');
        if (allianceSelect && allianceSelect.options.length <= 1) {
            this.populateAllianceFilter();
        }

        const ctx = document.getElementById('raceChart');
        if (!ctx) return;

        if (this.chart) this.chart.destroy();

        this.raceData = this.prepareData();

        if (this.raceData.length === 0) {
            // Show message on canvas or container
            const container = document.querySelector('.race-chart-container');
            if (container) {
                // Check if message already exists
                if (!container.querySelector('.no-data-msg')) {
                    const msg = document.createElement('div');
                    msg.className = 'no-data-msg';
                    msg.style.position = 'absolute';
                    msg.style.top = '50%';
                    msg.style.left = '50%';
                    msg.style.transform = 'translate(-50%, -50%)';
                    msg.style.color = 'rgba(255,255,255,0.7)';
                    msg.style.fontSize = '1.2rem';
                    msg.innerText = 'No Data Available (Check Filter).';
                    container.appendChild(msg);
                } else {
                    container.querySelector('.no-data-msg').innerText = 'No Data Available (Check Filter).';
                }
            }
            return;
        } else {
            // Remove message if exists
            const container = document.querySelector('.race-chart-container');
            const msg = container?.querySelector('.no-data-msg');
            if (msg) msg.remove();
        }

        // Initial Sort (Start Values)
        this.raceData.sort((a, b) => b.start - a.start);

        const top10 = this.raceData.slice(0, 15); // Show top 15 on chart

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(p => p.name),
                datasets: [{
                    label: this.currentMetric.toUpperCase(),
                    data: top10.map(p => p.start),
                    backgroundColor: top10.map(p => this.getColorForPlayer(p.name)), // Simple hash color
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // Disable internal Chart.js animation for manual control
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#333' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#fff', font: { size: 14, weight: 'bold' } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        this.updateDateDisplay(0);
    },

    updateChart(progress) {
        if (!this.chart || !this.raceData) return;

        // 1. Update Current Values
        this.raceData.forEach(p => {
            p.current = p.start + (p.end - p.start) * progress;
        });

        // 2. Sort by Current
        this.raceData.sort((a, b) => b.current - a.current);

        // 3. Update Chart Data (Top 15)
        const top15 = this.raceData.slice(0, 15);

        this.chart.data.labels = top15.map(p => p.name);
        this.chart.data.datasets[0].data = top15.map(p => p.current);
        this.chart.data.datasets[0].backgroundColor = top15.map(p => this.getColorForPlayer(p.name));

        this.chart.update();
        this.updateDateDisplay(progress);
    },

    updateDateDisplay(progress) {
        const el = document.getElementById('race-date-display');
        if (!el) return;

        // Improve: simulate date if we have start/end dates
        const pct = Math.round(progress * 100);
        el.innerText = `Progress: ${pct}%`;
    },

    getColorForPlayer(name) {
        // Generate consistent color from name hash
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
};

window.UIRaceChart = UIRaceChart;
