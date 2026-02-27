const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yahooFinance = require('yahoo-finance2').default;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://reign3418.github.io",
            "https://trad3r.onrender.com"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Serve the static frontend files (index.html, styles.css, script.js)
app.use(express.static(path.join(__dirname, '/')));

// Simple in-memory rate limiter / tracker for subscriptions
const activeSubscriptions = new Map(); // ticker -> Set of socket IDs

io.on('connection', (socket) => {
    console.log(`[+] Client connected: ${socket.id}`);

    // Listen for a client requesting to subscribe to a live ticker
    socket.on('subscribeTicker', (ticker) => {
        ticker = ticker.toUpperCase();
        console.log(`[->] Client ${socket.id} requesting ${ticker}`);

        // Remove from old subscriptions if they switch tickers
        activeSubscriptions.forEach((subscribers, key) => {
            if (subscribers.has(socket.id)) {
                subscribers.delete(socket.id);
                if (subscribers.size === 0) {
                    activeSubscriptions.delete(key);
                }
            }
        });

        // Add to new subscription
        if (!activeSubscriptions.has(ticker)) {
            activeSubscriptions.set(ticker, new Set());
        }
        activeSubscriptions.get(ticker).add(socket.id);

        // Confirm subscription
        socket.emit('subscriptionConfirmed', ticker);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client disconnected: ${socket.id}`);
        activeSubscriptions.forEach((subscribers, key) => {
            subscribers.delete(socket.id);
            if (subscribers.size === 0) {
                activeSubscriptions.delete(key);
            }
        });
    });
});

// The polling engine - runs every 2 seconds
setInterval(async () => {
    if (activeSubscriptions.size === 0) return;

    // Get an array of unique tickers currently requested by any client
    const tickersToFetch = Array.from(activeSubscriptions.keys());

    try {
        // Fetch quotes for all required tickers in one batch call
        const quotes = await yahooFinance.quote(tickersToFetch);

        // Yahoo Finance returns a single object if 1 ticker, or array if multiple
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

        quotesArray.forEach(quote => {
            const ticker = quote.symbol;
            const price = quote.regularMarketPrice;
            const time = Date.now(); // We send the current server time for the chart X-axis
            const open = quote.regularMarketOpen;
            const previousClose = quote.regularMarketPreviousClose;
            const volume = quote.regularMarketVolume;

            const payload = { ticker, price, time, open, previousClose, volume };

            // Broadcast this quote to ONLY the clients that requested this ticker
            const subscribers = activeSubscriptions.get(ticker);
            if (subscribers) {
                subscribers.forEach(socketId => {
                    io.to(socketId).emit('liveQuote', payload);
                });
            }
        });
    } catch (error) {
        console.error('Error fetching live quotes:', error.message);
    }
}, 2000); // Poll every 2 seconds

// Top Movers Engine - runs every 30 seconds
setInterval(async () => {
    try {
        // Fetch top 10 daily gainers using Yahoo Finance screener
        const queryOptions = { scrIds: 'day_gainers', count: 10 };
        const result = await yahooFinance.screener(queryOptions);

        if (result && result.quotes) {
            const topMovers = result.quotes.map(quote => ({
                ticker: quote.symbol,
                name: quote.shortName || quote.symbol,
                price: quote.regularMarketPrice,
                changePercent: quote.regularMarketChangePercent
            }));

            // Broadcast to absolutely everyone connected
            io.emit('topMovers', topMovers);
        }
    } catch (error) {
        console.error('Error fetching top movers:', error.message);
    }
}, 30000); // Poll every 30 seconds

// Initial trigger for top movers so clients don't have to wait 30s on boot
setTimeout(async () => {
    try {
        const queryOptions = { scrIds: 'day_gainers', count: 10 };
        const result = await yahooFinance.screener(queryOptions);
        if (result && result.quotes) {
            const topMovers = result.quotes.map(quote => ({
                ticker: quote.symbol,
                name: quote.shortName || quote.symbol,
                price: quote.regularMarketPrice,
                changePercent: quote.regularMarketChangePercent
            }));
            io.emit('topMovers', topMovers);
        }
    } catch (error) {
        console.error('Initial top movers fetch failed:', error.message);
    }
}, 3000);

server.listen(PORT, () => {
    console.log(`🚀 TradeMentor Live Server running at http://localhost:${PORT}`);
    console.log(`Streaming live market data via Yahoo Finance`);
});
