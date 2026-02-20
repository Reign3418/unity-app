// ==========================================
// SERVICE: UI LIVE FEED
// Handles connection to Companion App data via GitHub
// ==========================================

class UILiveFeed {
    init() {
        this.pollingInterval = null;
        this.isLive = false;
        this.elements = {
            repoInput: document.getElementById('feedRepo'),
            pathInput: document.getElementById('feedPath'),
            btnConnect: document.getElementById('btnConnectFeed'),
            btnStop: document.getElementById('btnStopFeed'),
            statusBadge: document.getElementById('feedStatus'),
            log: document.getElementById('feedLog'),
            tableBody: document.getElementById('feedTableBody')
        };

        // Load saved settings
        this.elements.repoInput.value = localStorage.getItem('feed_repo') || '';
        this.elements.pathInput.value = localStorage.getItem('feed_path') || 'data/live_feed.json';

        this.setupListeners();
    }

    setupListeners() {
        if (this.elements.btnConnect) {
            this.elements.btnConnect.addEventListener('click', () => this.toggleConnection());
        }
        if (this.elements.btnStop) {
            this.elements.btnStop.addEventListener('click', () => this.stopFeed());
        }
    }

    toggleConnection() {
        if (this.isLive) {
            this.stopFeed();
        } else {
            this.startFeed();
        }
    }

    startFeed() {
        const repo = this.elements.repoInput.value.trim();
        const path = this.elements.pathInput.value.trim();

        if (!repo || !path) {
            alert("Please enter both Repository (User/Repo) and Path.");
            return;
        }

        // Save for next time
        localStorage.setItem('feed_repo', repo);
        localStorage.setItem('feed_path', path);

        this.isLive = true;
        this.updateUIState(true);
        this.log("System", `Connecting to ${repo}/${path}...`);

        // Immediate fetch
        this.fetchData(repo, path);

        // Start Polling (every 3 seconds)
        this.pollingInterval = setInterval(() => {
            this.fetchData(repo, path);
        }, 3000);
    }

    stopFeed() {
        this.isLive = false;
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.updateUIState(false);
        this.log("System", "Connection stopped.");
    }

    updateUIState(active) {
        if (active) {
            this.elements.btnConnect.classList.add('hidden');
            this.elements.btnStop.classList.remove('hidden');
            this.elements.statusBadge.textContent = "LIVE 🟢";
            this.elements.statusBadge.style.backgroundColor = "var(--success-color)";
            this.elements.repoInput.disabled = true;
            this.elements.pathInput.disabled = true;
        } else {
            this.elements.btnConnect.classList.remove('hidden');
            this.elements.btnStop.classList.add('hidden');
            this.elements.statusBadge.textContent = "Disconnected";
            this.elements.statusBadge.style.backgroundColor = "#555";
            this.elements.repoInput.disabled = false;
            this.elements.pathInput.disabled = false;
        }
    }

    async fetchData(repo, path) {
        try {
            // Use cache buster
            const url = `https://raw.githubusercontent.com/${repo}/main/${path}?t=${Date.now()}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();
            this.processData(json);

        } catch (error) {
            this.log("Error", `Fetch Failed: ${error.message}`);
            // Don't stop polling immediately on one error, but maybe warn?
        }
    }

    processData(data) {
        // Log raw packet if it's new (simple timestamp check logic could be added)
        // For now, just log that we got a packet
        // this.log("RX", JSON.stringify(data).substring(0, 50) + "...");

        // Update Table
        this.updateTable(data);
    }

    updateTable(data) {
        // Expecting data to be a single object from spy: { id, name, power, kp, timestamp }
        // OR an array if we change the spy to push batches.

        // For the single packet structure:
        const row = document.createElement('tr');
        const timeStr = new Date().toLocaleTimeString();

        // If data is just a status update
        if (data.status) {
            this.log("Status", `Spy Status: ${data.status}`);
            return;
        }

        row.innerHTML = `
            <td>${timeStr}</td>
            <td>${data.name || 'Unknown'}</td>
            <td>${parseInt(data.power).toLocaleString()}</td>
            <td>${parseInt(data.kp).toLocaleString()}</td>
        `;

        // Prepend to table (newest first)
        this.elements.tableBody.prepend(row);

        // Limit table rows
        if (this.elements.tableBody.children.length > 50) {
            this.elements.tableBody.lastElementChild.remove();
        }

        // Also Log meaningful event
        this.log("Data", `Received: ${data.name} (Power: ${data.power})`);
    }

    log(source, message) {
        const div = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        div.style.color = source === "Error" ? "#ff5555" : "#0f0";
        div.innerHTML = `<span style="opacity:0.5">[${time}]</span> <strong>[${source}]</strong> ${message}`;
        this.elements.log.prepend(div);

        // Limit log size
        if (this.elements.log.children.length > 100) {
            this.elements.log.lastElementChild.remove();
        }
    }
}

window.uiLiveFeed = new UILiveFeed();
