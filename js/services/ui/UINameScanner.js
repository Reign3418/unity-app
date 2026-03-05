class UINameScanner {
    constructor() {
        this.dropZone = document.getElementById('nsDropZone');
        this.fileInput = document.getElementById('nsFileInput');
        this.queueList = document.getElementById('nsQueueList');
        this.processBtn = document.getElementById('nsProcessBtn');
        this.resultsArea = document.getElementById('nsResultsArea');
        this.totalNamesSpan = document.getElementById('nsTotalNames');
        this.clearBtn = document.getElementById('nsClearBtn');
        this.copyBtn = document.getElementById('nsCopyBtn');
        this.emptyState = document.getElementById('nsEmptyState');

        this.queue = []; // Array of specific file objects
        this.extractedNames = new Set();
        this.isProcessing = false;
        this.filterMode = 'exact'; // 'exact' or 'similarity'

        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.dropZone || !this.fileInput) return;

        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.15)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.dropZone.style.background = '';
            this.dropZone.style.borderColor = 'var(--border-color)';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.background = '';
            this.dropZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files.length) {
                this.addFilesToQueue(Array.from(e.dataTransfer.files));
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.addFilesToQueue(Array.from(e.target.files));
            }
        });

        // Use event delegation for the buttons since they might be hidden/re-rendered
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#nsProcessBtn')) {
                this.processQueue();
            } else if (e.target.closest('#nsClearBtn')) {
                this.clearAll();
            } else if (e.target.closest('#nsFilterExact')) {
                this.setFilterMode('exact');
            } else if (e.target.closest('#nsFilterSim')) {
                this.setFilterMode('similarity');
            } else if (e.target.closest('#nsCopyBtn')) {
                if (this.resultsArea.value) {
                    navigator.clipboard.writeText(this.resultsArea.value);
                    const btn = e.target.closest('#nsCopyBtn');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '✅ Copied!';
                    setTimeout(() => btn.innerHTML = originalText, 2000);
                }
            }
        });
    }

    addFilesToQueue(files) {
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                // Determine a short safe name
                const shortName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;

                const id = 'img_' + Math.random().toString(36).substr(2, 9);
                this.queue.push({ id, file, status: 'pending' }); // status: pending, processing, complete, error
            }
        });

        this.renderQueue();
    }

    renderQueue() {
        if (this.queue.length === 0) {
            this.queueList.innerHTML = '<span style="color:var(--text-muted); font-style:italic;" id="nsEmptyState">No images in queue.</span>';
            this.processBtn.style.display = 'none';
            return;
        }

        this.queueList.innerHTML = '';
        this.processBtn.style.display = 'block';

        this.queue.forEach(item => {
            let statusIcon = '🕒';
            let statusColor = 'var(--text-muted)';
            if (item.status === 'processing') {
                statusIcon = '🔄';
                statusColor = 'var(--accent-primary)';
            } else if (item.status === 'complete') {
                statusIcon = '✅';
                statusColor = 'var(--success-color)';
            } else if (item.status === 'error') {
                statusIcon = '❌';
                statusColor = 'var(--danger-color)';
            }

            const html = `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; border-left: 3px solid ${statusColor};">
                    <span style="font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${item.file.name}</span>
                    <span style="font-size: 1.1em;" title="${item.status}">${statusIcon}</span>
                </div>
            `;
            this.queueList.insertAdjacentHTML('beforeend', html);
        });
    }

    async processQueue() {
        if (this.isProcessing) return;

        const pendingItems = this.queue.filter(i => i.status === 'pending');
        if (pendingItems.length === 0) return;

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert("Please add your Gemini API Key in the Settings tab first.");
            return;
        }

        this.isProcessing = true;
        this.processBtn.disabled = true;
        this.processBtn.textContent = 'Processing...';
        this.processBtn.style.opacity = '0.5';

        try {
            for (const item of pendingItems) {
                item.status = 'processing';
                this.renderQueue();

                try {
                    // Convert file to Base64
                    const base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(item.file);
                    });

                    let mime = item.file.type;
                    if (!mime || mime === '') mime = 'image/jpeg';

                    const apiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`;

                    const prompt = `Extract all visible player names from this game screenshot.
Ignore numbers, UI text, coordinate numbers, alliance tags like [ABCD], and the words like 'Center Fortress' or 'Rally'. 
If a name has weird symbols or emojis, just try to get the closest English alphanumeric equivalent or omit the symbol.
Return ONLY a comma-separated list of the actual governor names you see. Do not write any other sentences or introductions.`;

                    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    { inline_data: { mime_type: mime, data: base64Data } }
                                ]
                            }],
                            generationConfig: {
                                temperature: 0,
                                maxOutputTokens: 2048
                            }
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        if (response.status === 429) throw new Error("429 Quota Exceeded");
                        throw new Error(`API Error ${response.status}: ${errText}`);
                    }

                    const result = await response.json();
                    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    if (text.trim()) {
                        // Process the string into the SET, cleaning up quotes or whitespace
                        const names = text.split(',').map(n => n.trim().replace(/^['"\s]+|['"\s]+$/g, '')).filter(n => n.length > 0);
                        names.forEach(n => this.extractedNames.add(n));
                    }

                    item.status = 'complete';

                } catch (err) {
                    console.error(`Error processing ${item.file.name}:`, err);
                    item.status = 'error';
                    if (err.message.includes('429')) {
                        alert("Quota Exceeded (429). The free tier of the AI Developer API is restrictive. You must add a billing account to increase RPM limit. Stopping queue.");
                        break;
                    }
                }

                this.updateResultsDisplay();
                this.renderQueue();

                // Artificial delay to help with rate limits
                await new Promise(r => setTimeout(r, 1500));
            }
        } catch (globalErr) {
            console.error("Global scanner error:", globalErr);
            alert("A fatal error occurred while scanning: " + globalErr.message);
        } finally {
            this.isProcessing = false;
            this.processBtn.disabled = false;
            this.processBtn.textContent = 'Scan All Images';
            this.processBtn.style.opacity = '1';
        }
    }

    setFilterMode(mode) {
        this.filterMode = mode;
        const btnExact = document.getElementById('nsFilterExact');
        const btnSim = document.getElementById('nsFilterSim');

        if (btnExact && btnSim) {
            btnExact.classList.remove('active');
            btnSim.classList.remove('active');
            btnExact.style.background = 'transparent';
            btnExact.style.color = 'var(--text-muted)';
            btnSim.style.background = 'transparent';
            btnSim.style.color = 'var(--text-muted)';

            if (mode === 'exact') {
                btnExact.classList.add('active');
                btnExact.style.background = 'var(--accent-primary)';
                btnExact.style.color = 'white';
            } else {
                btnSim.classList.add('active');
                btnSim.style.background = 'var(--accent-primary)';
                btnSim.style.color = 'white';
            }
        }

        this.updateResultsDisplay();
    }

    // Levenshtein distance for fuzzy matching typos
    calculateSimilarity(s1, s2) {
        let longer = s1.toLowerCase();
        let shorter = s2.toLowerCase();
        if (longer.length < shorter.length) {
            longer = s2.toLowerCase();
            shorter = s1.toLowerCase();
        }
        let longerLength = longer.length;
        if (longerLength == 0) return 1.0;

        // Calculate distance
        let costs = new Array();
        for (let i = 0; i <= longer.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= shorter.length; j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (longer.charAt(i - 1) != shorter.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[shorter.length] = lastValue;
        }

        return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
    }

    updateResultsDisplay() {
        let nameArray = Array.from(this.extractedNames);

        if (this.filterMode === 'similarity') {
            const filteredArray = [];

            // Basic O(n^2) pass to group deeply similar strings
            for (const name of nameArray) {
                let isDuplicate = false;
                for (const existing of filteredArray) {
                    const n1 = name.toLowerCase();
                    const n2 = existing.toLowerCase();

                    // 1. Direct substring match (e.g. Biralchu vs Biralchus)
                    if (n1.includes(n2) || n2.includes(n1)) {
                        isDuplicate = true;
                        break;
                    }

                    // 2. Levenshtein Distance (e.g. Bitecrus vs BiteChus) - 70% threshold
                    const sim = this.calculateSimilarity(n1, n2);
                    if (sim >= 0.70) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    filteredArray.push(name);
                }
            }
            nameArray = filteredArray;
        }

        const sortedArray = nameArray.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        this.resultsArea.value = sortedArray.join('\n');
        this.totalNamesSpan.textContent = sortedArray.length;
    }

    clearAll() {
        if (confirm("Clear all scanned names and the current queue?")) {
            this.queue = [];
            this.extractedNames.clear();
            this.updateResultsDisplay();
            this.renderQueue();
            this.fileInput.value = '';
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.uiNameScanner = new UINameScanner();
});
