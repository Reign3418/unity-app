// TradeMentor - Simulator Logic with Lightweight Charts

// Helper to generate simple sequential dates for the mock data
function generateDates(count, offsetDays = 0) {
    const dates = [];
    const today = new Date();
    today.setDate(today.getDate() - count - offsetDays);

    for (let i = 0; i < count; i++) {
        today.setDate(today.getDate() + 1);
        // Format YYYY-MM-DD
        dates.push(today.toISOString().split('T')[0]);
    }
    return dates;
}

// Generate some basic past and future price data for our scenarios
const datesScenario1Past = generateDates(20, 10);
const datesScenario1Future = generateDates(10, 0);

const datesScenario2Past = generateDates(30, 20);
const datesScenario2Future = generateDates(20, 0);

const datesScenario3Past = generateDates(25, 15);
const datesScenario3Future = generateDates(15, 0);

const datesScenario4Past = generateDates(20, 5);
const datesScenario4Future = generateDates(5, 0);

const datesScenario5Past = generateDates(20, 10);
const datesScenario5Future = generateDates(10, 0);

const scenarios = [
    {
        title: "The Earnings Drop",
        difficulty: "Easy",
        description: "Company XYZ just reported record revenue, beating expectations. However, the stock price immediately drops 8% at the market open.",
        correctAction: "buy",
        proMove: "Usually Buy or Hold (Watch Support)",
        explanation: "This is a 'Sell the News' event. The good news was priced in. If the business is great, this temporary drop is a buying opportunity.",
        pastData: [
            { time: datesScenario1Past[0], value: 130 }, { time: datesScenario1Past[1], value: 132 }, { time: datesScenario1Past[2], value: 131 },
            { time: datesScenario1Past[3], value: 134 }, { time: datesScenario1Past[4], value: 136 }, { time: datesScenario1Past[5], value: 135 },
            { time: datesScenario1Past[6], value: 138 }, { time: datesScenario1Past[7], value: 140 }, { time: datesScenario1Past[8], value: 142 },
            { time: datesScenario1Past[9], value: 144 }, { time: datesScenario1Past[10], value: 146 }, { time: datesScenario1Past[11], value: 148 },
            { time: datesScenario1Past[12], value: 150 }, { time: datesScenario1Past[13], value: 152 }, { time: datesScenario1Past[14], value: 155 },
            { time: datesScenario1Past[15], value: 157 }, { time: datesScenario1Past[16], value: 156 }, { time: datesScenario1Past[17], value: 158 },
            { time: datesScenario1Past[18], value: 145 } // The 8% Earnings Drop
        ],
        futureData: [
            { time: datesScenario1Future[0], value: 144 }, { time: datesScenario1Future[1], value: 146 }, { time: datesScenario1Future[2], value: 148 },
            { time: datesScenario1Future[3], value: 151 }, { time: datesScenario1Future[4], value: 154 }, { time: datesScenario1Future[5], value: 156 },
            { time: datesScenario1Future[6], value: 159 }, { time: datesScenario1Future[7], value: 161 }, { time: datesScenario1Future[8], value: 162 },
            { time: datesScenario1Future[9], value: 165 } // Recovery and higher highs
        ]
    },
    {
        title: "The Breakout",
        difficulty: "Medium",
        description: "Stock ABC has been stuck below $50 for a year. Today, on massive volume, it just pushed through $51.",
        correctAction: "buy",
        proMove: "Buy the Breakout",
        explanation: "This is a classic breakout. High volume indicates institutions are buying. Resistance ($50) has turned into support.",
        pastData: [
            { time: datesScenario2Past[0], value: 42 }, { time: datesScenario2Past[1], value: 44 }, { time: datesScenario2Past[2], value: 48 },
            { time: datesScenario2Past[3], value: 50 }, { time: datesScenario2Past[4], value: 47 }, { time: datesScenario2Past[5], value: 45 },
            { time: datesScenario2Past[6], value: 49 }, { time: datesScenario2Past[7], value: 50 }, { time: datesScenario2Past[8], value: 46 },
            { time: datesScenario2Past[9], value: 48 }, { time: datesScenario2Past[10], value: 50 }, { time: datesScenario2Past[11], value: 49 },
            { time: datesScenario2Past[12], value: 47 }, { time: datesScenario2Past[13], value: 49 }, { time: datesScenario2Past[14], value: 50 },
            { time: datesScenario2Past[15], value: 48 }, { time: datesScenario2Past[16], value: 49 }, { time: datesScenario2Past[17], value: 50 },
            { time: datesScenario2Past[18], value: 51.5 } // The Breakout
        ],
        futureData: [
            { time: datesScenario2Future[0], value: 52 }, { time: datesScenario2Future[1], value: 54 }, { time: datesScenario2Future[2], value: 53 },
            { time: datesScenario2Future[3], value: 56 }, { time: datesScenario2Future[4], value: 58 }, { time: datesScenario2Future[5], value: 60 },
            { time: datesScenario2Future[6], value: 59 }, { time: datesScenario2Future[7], value: 62 }, { time: datesScenario2Future[8], value: 65 },
            { time: datesScenario2Future[9], value: 68 } // Massive run up
        ]
    },
    {
        title: "The Dead Cat Bounce",
        difficulty: "Hard",
        description: "A formerly popular stock has crashed heavily. Today, it randomly jumps 15% with no new news.",
        correctAction: "sell",
        proMove: "Sell or Avoid (Do not Buy)",
        explanation: "In a strong downtrend, sudden rallies are common ('Dead Cat Bounce'). Without fundamental improvement, they fizzle out.",
        pastData: [
            { time: datesScenario3Past[0], value: 100 }, { time: datesScenario3Past[1], value: 95 }, { time: datesScenario3Past[2], value: 90 },
            { time: datesScenario3Past[3], value: 85 }, { time: datesScenario3Past[4], value: 88 }, { time: datesScenario3Past[5], value: 80 },
            { time: datesScenario3Past[6], value: 75 }, { time: datesScenario3Past[7], value: 70 }, { time: datesScenario3Past[8], value: 72 },
            { time: datesScenario3Past[9], value: 65 }, { time: datesScenario3Past[10], value: 60 }, { time: datesScenario3Past[11], value: 55 },
            { time: datesScenario3Past[12], value: 58 }, { time: datesScenario3Past[13], value: 50 }, { time: datesScenario3Past[14], value: 45 },
            { time: datesScenario3Past[15], value: 40 }, { time: datesScenario3Past[16], value: 35 }, { time: datesScenario3Past[17], value: 30 },
            { time: datesScenario3Past[18], value: 34.5 } // The Bounce
        ],
        futureData: [
            { time: datesScenario3Future[0], value: 32 }, { time: datesScenario3Future[1], value: 29 }, { time: datesScenario3Future[2], value: 25 },
            { time: datesScenario3Future[3], value: 22 }, { time: datesScenario3Future[4], value: 20 }, { time: datesScenario3Future[5], value: 18 },
            { time: datesScenario3Future[6], value: 15 }, { time: datesScenario3Future[7], value: 14 }, { time: datesScenario3Future[8], value: 12 },
            { time: datesScenario3Future[9], value: 10 } // Continued crash
        ]
    },
    {
        title: "The Parabolic Run",
        difficulty: "Medium",
        description: "A stock has gone up 300% in weeks because of social media hype. The chart is vertical.",
        correctAction: "sell",
        proMove: "Sell (Take Profits) or Avoid",
        explanation: "Parabolic moves are driven by emotion (FOMO), not fundamentals. Smart money takes profits before the inevitable crash.",
        pastData: [
            { time: datesScenario4Past[0], value: 20 }, { time: datesScenario4Past[1], value: 21 }, { time: datesScenario4Past[2], value: 22 },
            { time: datesScenario4Past[3], value: 25 }, { time: datesScenario4Past[4], value: 30 }, { time: datesScenario4Past[5], value: 35 },
            { time: datesScenario4Past[6], value: 45 }, { time: datesScenario4Past[7], value: 60 }, { time: datesScenario4Past[8], value: 80 },
            { time: datesScenario4Past[9], value: 88 } // The Peak Bubble
        ],
        futureData: [
            { time: datesScenario4Future[0], value: 75 }, { time: datesScenario4Future[1], value: 60 }, { time: datesScenario4Future[2], value: 45 },
            { time: datesScenario4Future[3], value: 35 }, { time: datesScenario4Future[4], value: 30 } // The Pop
        ]
    }
];

let currentScenarioIndex = 0;
let chart = null;
let lineSeries = null;

// DOM Elements
const scenarioTracker = document.getElementById('scenarioTracker');
const difficultyBadge = document.getElementById('difficultyBadge');
const scenarioTitle = document.getElementById('scenarioTitle');
const scenarioDescription = document.getElementById('scenarioDescription');
const chartContainer = document.getElementById('chartContainer');

const actionPhase = document.getElementById('actionPhase');
const feedbackPhase = document.getElementById('feedbackPhase');

const feedbackResultTitle = document.getElementById('feedbackResultTitle');
const feedbackProMove = document.getElementById('feedbackProMove');
const feedbackExplanation = document.getElementById('feedbackExplanation');

const btnBuy = document.getElementById('btnBuy');
const btnHold = document.getElementById('btnHold');
const btnSell = document.getElementById('btnSell');
const btnNextScenario = document.getElementById('btnNextScenario');

// Init Chart once
function initChart() {
    const chartOptions = {
        layout: {
            textColor: '#9494a8',
            background: { type: 'solid', color: 'transparent' },
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        rightPriceScale: {
            borderVisible: false,
        },
        timeScale: {
            borderVisible: false,
            timeVisible: true,
            secondsVisible: false,
        },
        handleScroll: false,
        handleScale: false
    };

    chart = LightweightCharts.createChart(chartContainer, chartOptions);

    lineSeries = chart.addLineSeries({
        color: '#00bfff', // default blue accent
        lineWidth: 3,
        crosshairMarkerVisible: true,
        lastPriceAnimation: LightweightCharts.LastPriceAnimationMode.Continuous,
    });

    // Handle Window Resize
    window.addEventListener('resize', () => {
        chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
    });
}

// Load Scenario
function loadScenario() {
    const scenario = scenarios[currentScenarioIndex];

    // Reset UI
    actionPhase.classList.remove('hidden');
    feedbackPhase.classList.add('hidden');

    // Populate Data
    scenarioTracker.textContent = `Scenario ${currentScenarioIndex + 1} of ${scenarios.length}`;
    difficultyBadge.textContent = `Difficulty: ${scenario.difficulty}`;

    difficultyBadge.style.color = scenario.difficulty === 'Easy' ? 'var(--accent-green)' :
        scenario.difficulty === 'Medium' ? 'var(--accent-blue)' : 'var(--accent-red)';

    scenarioTitle.textContent = scenario.title;
    scenarioDescription.textContent = scenario.description;

    // Make sure chart is initialized and sized
    if (!chart) initChart();
    chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });

    // Set Data Series to PAST DATA ONLY
    lineSeries.setData(scenario.pastData);

    // Theme line based on recent trend (up or down)
    const startVal = scenario.pastData[0].value;
    const endVal = scenario.pastData[scenario.pastData.length - 1].value;
    const lineColor = endVal >= startVal ? '#00ff88' : '#ff3366'; // Green or Red

    lineSeries.applyOptions({
        color: lineColor,
    });

    chart.timeScale().fitContent();
}

// Handle User Choice & Reveal Future
function handleChoice(userAction) {
    const scenario = scenarios[currentScenarioIndex];

    // Hide buttons, show feedback
    actionPhase.classList.add('hidden');
    feedbackPhase.classList.remove('hidden');

    // Evaluate answer
    if (userAction === scenario.correctAction) {
        feedbackResultTitle.textContent = "Spot On! 🎯";
        feedbackResultTitle.className = "result-title correct";
    } else {
        feedbackResultTitle.textContent = "Not Quite Ideal 💡";
        feedbackResultTitle.className = "result-title incorrect";

        if (scenario.correctAction === 'hold' && (userAction === 'buy' || userAction === 'sell')) {
            feedbackResultTitle.textContent = "Patience Might Be Better ⏳";
            feedbackResultTitle.className = "result-title partial";
        }
    }

    // Populate Explanation
    feedbackProMove.textContent = scenario.proMove;
    feedbackExplanation.textContent = scenario.explanation;

    // Change button text if it's the last scenario
    if (currentScenarioIndex === scenarios.length - 1) {
        btnNextScenario.innerHTML = 'Restart Simulator <i class="fa-solid fa-rotate-right"></i>';
    } else {
        btnNextScenario.innerHTML = 'Next Scenario <i class="fa-solid fa-arrow-right"></i>';
    }

    // ----- REVEAL FUTURE DATA -----
    // Combine past + future and animate the reveal
    const fullData = [...scenario.pastData];

    // We add the points sequentially to create an animation effect
    let delay = 0;
    scenario.futureData.forEach((point) => {
        setTimeout(() => {
            fullData.push(point);
            lineSeries.setData(fullData);
            // We don't fit content here so the chart slowly scrolls forward
        }, delay);
        delay += 150; // 150ms per new candle reveals the future
    });
}

// Event Listeners
btnBuy.addEventListener('click', () => handleChoice('buy'));
btnHold.addEventListener('click', () => handleChoice('hold'));
btnSell.addEventListener('click', () => handleChoice('sell'));

btnNextScenario.addEventListener('click', () => {
    currentScenarioIndex++;
    if (currentScenarioIndex >= scenarios.length) {
        currentScenarioIndex = 0; // Loop back
    }
    loadScenario();

    // Scroll back to top of simulator
    document.getElementById('simulator').scrollIntoView({ behavior: 'smooth' });
});

// Start the app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    // slight timeout to ensure container is rendered and sized perfectly before chart init
    setTimeout(loadScenario, 100);
});

// ==========================================
// LIVE PAPER TRADING LOGIC
// ==========================================

// DOM Elements
const tabScenario = document.getElementById('tabScenario');
const tabLive = document.getElementById('tabLive');
const scenarioContainer = document.getElementById('scenarioContainer');
const liveContainer = document.getElementById('liveContainer');

const liveTickerInput = document.getElementById('liveTickerInput');
const btnStartLive = document.getElementById('btnStartLive');
const marketStatusIndicator = document.getElementById('marketStatusIndicator');
const livePnL = document.getElementById('livePnL');
const liveShares = document.getElementById('liveShares');

const liveChartContainer = document.getElementById('liveChartContainer');
const btnLiveBuy = document.getElementById('btnLiveBuy');
const btnLiveSell = document.getElementById('btnLiveSell');

// State
let isLiveMode = false;
let socket = null;
let currentLiveTicker = null;
let liveChart = null;
let liveLineSeries = null;
let lastKnownPrice = 0;
let position = { shares: 0, averageCost: 0, realizedPnL: 0 };

// Tab Switching
tabScenario.addEventListener('click', () => {
    isLiveMode = false;
    tabScenario.classList.add('active');
    tabLive.classList.remove('active');
    scenarioContainer.classList.remove('hidden');
    liveContainer.classList.add('hidden');

    // Resize chart to fit visible container
    if (chart) chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
});

tabLive.addEventListener('click', () => {
    isLiveMode = true;
    tabLive.classList.add('active');
    tabScenario.classList.remove('active');
    liveContainer.classList.remove('hidden');
    scenarioContainer.classList.add('hidden');

    // Initialize Live Chart if it doesn't exist yet
    if (!liveChart) initLiveChart();

    // Resize chart to fit visible container
    if (liveChart) liveChart.applyOptions({ width: liveChartContainer.clientWidth, height: liveChartContainer.clientHeight });
});

function initLiveChart() {
    const chartOptions = {
        layout: { textColor: '#9494a8', background: { type: 'solid', color: 'transparent' } },
        grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true }, // Show seconds for live
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    };

    liveChart = LightweightCharts.createChart(liveChartContainer, chartOptions);
    liveLineSeries = liveChart.addLineSeries({
        color: '#9d00ff', // Purple accent for live
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastPriceAnimation: LightweightCharts.LastPriceAnimationMode.Continuous,
    });

    window.addEventListener('resize', () => {
        if (isLiveMode && liveChart) {
            liveChart.applyOptions({ width: liveChartContainer.clientWidth, height: liveChartContainer.clientHeight });
        }
    });
}

// Connect to WebSocket Server
function connectToLiveMarket(ticker) {
    // Set our intended target so the connect handler knows what to ask for
    currentLiveTicker = ticker;

    if (!socket) {
        // Dynamically connect to localhost if running locally, otherwise connect to the hosted backend URL.
        const socketUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000'
            : 'https://trad3r.onrender.com';

        // Force websocket transport to bypass restrictive long-polling CORS policies
        socket = io(socketUrl, {
            transports: ['websocket'],
            withCredentials: true
        });
        setupSocketListeners();
    }

    // Reset Data & Position
    liveLineSeries.setData([]);
    position = { shares: 0, averageCost: 0, realizedPnL: 0 };
    updatePnLDisplay();
    btnLiveBuy.disabled = true;
    btnLiveSell.disabled = true;

    marketStatusIndicator.textContent = "Connecting...";
    marketStatusIndicator.className = "text-muted";

    // If already connected when clicking switch ticker, emit immediately
    if (socket.connected) {
        socket.emit('subscribeTicker', currentLiveTicker);
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        if (currentLiveTicker) {
            socket.emit('subscribeTicker', currentLiveTicker);
        }
    });

    socket.on('subscriptionConfirmed', (confirmedTicker) => {
        marketStatusIndicator.textContent = `Live: ${confirmedTicker}`;
        marketStatusIndicator.className = "neon-green";
        currentLiveTicker = confirmedTicker;
        liveTickerInput.value = confirmedTicker; // Update input if clicked from Movers
        btnLiveBuy.disabled = false;
        btnLiveBuy.innerHTML = `<i class="fa-solid fa-arrow-up"></i> BUY (100)`;
        btnStartLive.textContent = "Switch Ticker";
    });

    // Top Movers Listener
    socket.on('topMovers', (moversArray) => {
        const listContainer = document.getElementById('topMoversList');
        if (!listContainer) return;

        listContainer.innerHTML = ''; // Clear loading state

        moversArray.forEach(mover => {
            const item = document.createElement('div');
            item.className = 'mover-item';

            const isPositive = mover.changePercent >= 0;
            const changeColorClass = isPositive ? 'text-green' : 'text-red';
            const changeSign = isPositive ? '+' : '';
            const percentStr = (mover.changePercent).toFixed(2);

            item.innerHTML = `
                <div>
                    <div class="mover-ticker">${mover.ticker}</div>
                </div>
                <div>
                    <div class="mover-change ${changeColorClass}">${changeSign}${percentStr}%</div>
                </div>
            `;

            // Allow clicking to instantly switch the live chart
            item.addEventListener('click', () => {
                liveTickerInput.value = mover.ticker;
                btnStartLive.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
                connectToLiveMarket(mover.ticker);
            });

            listContainer.appendChild(item);
        });
    });

    socket.on('liveQuote', (data) => {
        if (data.ticker !== currentLiveTicker) return;

        lastKnownPrice = data.price;

        // Convert server timestamp to the format LightweightCharts expects (seconds)
        // Adjusting for timezone offset so it lines up with local time
        const tzOffset = new Date().getTimezoneOffset() * 60;
        const timeObj = (Math.floor(data.time / 1000)) - tzOffset;

        liveLineSeries.update({
            time: timeObj,
            value: data.price
        });

        // Update PnP Tracker
        updatePnLDisplay();
    });

    socket.on('disconnect', () => {
        marketStatusIndicator.textContent = "Disconnected";
        marketStatusIndicator.className = "text-red";
        btnLiveBuy.disabled = true;
        btnLiveSell.disabled = true;
    });
}

// Start live stream
btnStartLive.addEventListener('click', () => {
    const ticker = liveTickerInput.value.trim().toUpperCase();
    if (ticker) {
        btnStartLive.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
        connectToLiveMarket(ticker);
    }
});

// Trading Actions
btnLiveBuy.addEventListener('click', () => {
    if (lastKnownPrice === 0) return;

    const qty = 100;
    const cost = lastKnownPrice * qty;

    // Update Average Cost
    const totalCurrentCost = position.shares * position.averageCost;
    position.shares += qty;
    position.averageCost = (totalCurrentCost + cost) / position.shares;

    btnLiveSell.disabled = false;
    updatePnLDisplay();
});

btnLiveSell.addEventListener('click', () => {
    if (position.shares === 0 || lastKnownPrice === 0) return;

    const qty = position.shares;
    const revenue = lastKnownPrice * qty;
    const costBasis = position.averageCost * qty;

    // Realize PnL
    position.realizedPnL += (revenue - costBasis);
    position.shares = 0;
    position.averageCost = 0;

    btnLiveSell.disabled = true;
    updatePnLDisplay();
});

function updatePnLDisplay() {
    liveShares.textContent = `${position.shares} Shares`;

    let totalPnL = position.realizedPnL;

    // Add unrealized PnL if holding shares
    if (position.shares > 0) {
        const unrealized = (lastKnownPrice - position.averageCost) * position.shares;
        totalPnL += unrealized;
    }

    // Format Currency
    const formattedPnL = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPnL);

    livePnL.textContent = formattedPnL;

    // Style green or red
    if (totalPnL > 0) {
        livePnL.className = 'text-green';
    } else if (totalPnL < 0) {
        livePnL.className = 'text-red';
    } else {
        livePnL.className = 'text-muted';
    }
}
