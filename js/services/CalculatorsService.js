class CalculatorsService {
    constructor() {
        this.container = document.getElementById('calculators');
        if (!this.container) return;

        this.totalDisplay = document.getElementById('calcTotalDisplay');
        this.totalSuffix = document.getElementById('calcTotalSuffix');
        this.inputs = this.container.querySelectorAll('.calc-input');

        this.currentActiveTab = 'calc-speedups';

        this.initEventListeners();
        this.initStarlightCalculator();
    }

    initEventListeners() {
        // Subtab Navigation
        const subTabs = this.container.querySelectorAll('.calc-tab-btn');
        const calcLayout = this.container.querySelector('.calc-layout');
        const totalsPanelEl = this.container.querySelector('.calc-totals-panel');

        const applyCustomLayout = (isCustom) => {
            if (calcLayout) calcLayout.style.gridTemplateColumns = isCustom ? '1fr' : '2fr 1fr';
            if (totalsPanelEl) totalsPanelEl.style.display = isCustom ? 'none' : '';
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
                applyCustomLayout(['calc-troops', 'calc-flag', 'calc-starlight'].includes(targetId));
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

    initStarlightCalculator() {
        this.starlightCurrent = document.getElementById('starlightCurrentStar');
        this.starlightTarget = document.getElementById('starlightTargetStar');
        if (!this.starlightCurrent || !this.starlightTarget) return;

        this.starlightData = {
            1: { normal: 0, blessed: 0, dazzling: 0 },
            2: { normal: 0, blessed: 0, dazzling: 0 },
            3: { normal: 6, blessed: 1, dazzling: 1 },
            4: { normal: 65, blessed: 17, dazzling: 9 },
            5: { normal: 160, blessed: 40, dazzling: 20 },
            6: { normal: 510, blessed: 120, dazzling: 60 }
        };

        const calculate = () => {
            let current = parseInt(this.starlightCurrent.value) || 3;
            let target = parseInt(this.starlightTarget.value) || 6;

            if (current >= target) {
                target = current + 1;
                if (target > 6) { target = 6; current = 5; }
                this.starlightTarget.value = target;
                this.starlightCurrent.value = current;
            }

            let startReqs = this.starlightData[current];
            let endReqs = this.starlightData[target];

            document.getElementById('starlightNormalReq').textContent = (endReqs.normal - startReqs.normal).toLocaleString();
            document.getElementById('starlightBlessedReq').textContent = (endReqs.blessed - startReqs.blessed).toLocaleString();
            document.getElementById('starlightDazzlingReq').textContent = (endReqs.dazzling - startReqs.dazzling).toLocaleString();
        };

        this.starlightCurrent.addEventListener('change', calculate);
        this.starlightTarget.addEventListener('change', calculate);

        // Initial paint
        calculate();
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

// Per-tier base stats (training time in seconds per single troop)
var TROOP_TIER_DATA = {
    1: { timeSec: 5, food: 90, wood: 90, stone: 0, gold: 0, power: 5 },
    2: { timeSec: 60, food: 500, wood: 500, stone: 0, gold: 0, power: 20 },
    3: { timeSec: 180, food: 1800, wood: 1800, stone: 0, gold: 0, power: 60 },
    4: { timeSec: 720, food: 6800, wood: 6800, stone: 6800, gold: 0, power: 200 },
    5: { timeSec: 1800, food: 15000, wood: 15000, stone: 15000, gold: 5000, power: 500 },
};

class TroopTrainingCalc {
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
            const t = TROOP_TIER_DATA[tier];
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

class AllianceFlagCalc {
    constructor() {
        this.inputs = document.querySelectorAll('.flag-input');
        if (!this.inputs.length) return;

        this.readyTimeDisplay = document.getElementById('flagReadyTime');
        this.bottleneckMsg = document.getElementById('flagBottleneckMsg');
        this.deficitBarsContainer = document.getElementById('flagDeficitBars');
        this.glidePathContainer = document.getElementById('flagGlidePath');
        this.glidePathBody = document.getElementById('flagGlidePathBody');
        this.clearBtn = document.getElementById('flagClearBtn');
        this.exportBtn = document.getElementById('flagExportMailBtn');

        this.dropZone = document.getElementById('flagOcrDropZone');
        this.fileInput = document.getElementById('flagOcrInput');
        this.ocrStatus = document.getElementById('flagOcrStatus');

        this.resources = ['credits', 'food', 'wood', 'stone', 'gold'];
        this.resColors = {
            'credits': '#FFF',
            'food': '#FACC15',
            'wood': '#A3E635',
            'stone': '#9CA3AF',
            'gold': '#FCD34D'
        };

        this.initEventListeners();
        this.initDropzone();
        this.recalculate();
    }

    initEventListeners() {
        this.inputs.forEach(input => {
            input.addEventListener('input', () => this.recalculate());
            input.addEventListener('change', (e) => {
                if (e.target.value < 0) e.target.value = 0;
            });
        });

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                this.inputs.forEach(inp => inp.value = '');
                this.recalculate();
            });
        }

        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportToMail());
        }
    }

    initDropzone() {
        if (!this.dropZone || !this.fileInput) return;

        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.15)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.05)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.05)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
            if (e.dataTransfer.files.length) this.processScreenshot(e.dataTransfer.files[0]);
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.processScreenshot(e.target.files[0]);
        });
    }

    getVal(res, field) {
        const el = document.querySelector(`.flag-input[data-res="${res}"][data-field="${field}"]`);
        return el && el.value ? parseFloat(el.value) : 0;
    }

    setVal(res, field, value) {
        if (value === null || value === undefined) return;
        const el = document.querySelector(`.flag-input[data-res="${res}"][data-field="${field}"]`);
        if (el) el.value = value;
    }

    async processScreenshot(file) {
        if (!file.type.startsWith('image/')) {
            alert("Please drop a valid image file.");
            return;
        }

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            this.ocrStatus.textContent = "Error: API Key Missing (Add in Settings)";
            this.ocrStatus.style.color = "var(--danger-color)";
            return;
        }

        this.ocrStatus.textContent = "Scanning screenshot with Gemini Vision...";
        this.ocrStatus.style.color = "var(--accent-primary)";
        this.dropZone.style.opacity = "0.7";

        try {
            // Convert file to Base64
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64 = dataUrl.split(',')[1];
            const mimeType = file.type || 'image/jpeg';
            const apiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`;

            const prompt = `This is a screenshot of the Alliance Storehouse in Rise of Kingdoms.
The user's game may be in any language (e.g., Russian, Spanish, English). Ignore the text labels and rely on the UI layout and resource icons to map the values correctly:
- First box (Gold Medal/Star icon): Credits
- Second box (Corn/Wheat icon): Food
- Third box (Wood Log icon): Wood
- Fourth box (Stone/Rock icon): Stone
- Fifth box (Gold Coin icon): Gold

Extract the resource data for credits, food, wood, stone, and gold. 

Return an exact JSON object containing the extracted values. Use 0 if a resource is missing or not visible. Keep all numbers as plain integers, avoiding K/M formatting (e.g. 1.2M -> 1200000, 500K -> 500000).

For "cost", look at the "Resource/Activity" log at the very bottom. Find the most recent log entry (it will have negative numbers next to resource icons). Enter those negative numbers as positive integers for "cost". Note that Credits are usually the first coin icon, and Gold is the last coin icon.

Respond ONLY with a valid JSON object matching this structure identically:
{
  "credits_stock": 0, "credits_income": 0, "credits_cost": 0,
  "food_stock": 0, "food_income": 0, "food_cost": 0,
  "wood_stock": 0, "wood_income": 0, "wood_cost": 0,
  "stone_stock": 0, "stone_income": 0, "stone_cost": 0,
  "gold_stock": 0, "gold_income": 0, "gold_cost": 0
}`;

            const response = await fetch(`${apiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64 } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0,
                        responseMimeType: 'application/json',
                        maxOutputTokens: 2048
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                // Check if it's the 429 Quota Error and give human-readable advice
                if (response.status === 429) {
                    throw new Error("Quota Exceeded (429). The free tier of the AI Developer API is too restrictive. You must add a billing account in Google AI Studio to increase your RPM limit.");
                }
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            const result = await response.json();
            const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            console.log('Gemini Raw Output:', rawText);
            let cleaned = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }
            const parsed = JSON.parse(cleaned);

            // Populate the DOM
            this.resources.forEach(res => {
                this.setVal(res, 'stock', parsed[`${res}_stock`] || 0);
                this.setVal(res, 'income', parsed[`${res}_income`] || 0);
                this.setVal(res, 'cost', parsed[`${res}_cost`] || 0);
            });

            this.ocrStatus.textContent = "Data extracted successfully!";
            this.ocrStatus.style.color = "var(--success-color)";
            this.recalculate(); // Trigger the math rendering

        } catch (err) {
            console.error("Gemini OCR Error:", err);
            this.ocrStatus.textContent = err.message.substring(0, 100);
            this.ocrStatus.style.color = "var(--danger-color)";
        } finally {
            this.dropZone.style.opacity = "1";
        }
    }

    recalculate() {
        let maxWaitHours = 0;
        let bottleneckRes = null;
        let hasDeficit = false;
        let hasAnyCost = false;
        let minBuildable = Infinity;

        const results = [];
        const glideResults = [];

        this.resources.forEach(res => {
            const cost = this.getVal(res, 'cost');
            const stock = this.getVal(res, 'stock');
            const income = this.getVal(res, 'income');

            // Generate glide path data independent of cost
            if (income > 0) {
                glideResults.push({
                    name: res.charAt(0).toUpperCase() + res.slice(1),
                    color: this.resColors[res],
                    income: income
                });
            }

            if (cost === 0) return; // Skip deficit calc if no cost specified
            hasAnyCost = true;

            const buildable = Math.floor(stock / cost);
            if (buildable < minBuildable) minBuildable = buildable;

            const deficit = Math.max(0, cost - stock);
            const percent = Math.min(100, (stock / cost) * 100).toFixed(1);

            let waitHours = 0;
            let timeStr = "Ready";

            if (deficit > 0) {
                hasDeficit = true;
                if (income > 0) {
                    waitHours = deficit / income;
                    timeStr = this.formatTime(waitHours);
                } else {
                    waitHours = Infinity;
                    timeStr = "Never (0 Income)";
                }

                if (waitHours > maxWaitHours) {
                    maxWaitHours = waitHours;
                    bottleneckRes = res;
                }
            }

            results.push({
                name: res.charAt(0).toUpperCase() + res.slice(1),
                color: this.resColors[res],
                percent: percent,
                deficit: deficit,
                timeStr: timeStr,
                isBottleneck: false
            });
        });

        // Flag the bottleneck
        if (bottleneckRes) {
            const bItem = results.find(r => r.name.toLowerCase() === bottleneckRes);
            if (bItem) bItem.isBottleneck = true;
        }

        // Cache for export functionality
        this.lastResults = results;
        this.lastGlide = glideResults;
        this.lastMaxWaitHours = maxWaitHours;
        this.lastBottleneckRes = bottleneckRes;
        this.lastHasAnyCost = hasAnyCost;
        this.lastHasDeficit = hasDeficit;
        this.lastMaxBuildable = hasAnyCost && minBuildable !== Infinity ? minBuildable : 0;

        // Render UI Elements
        this.renderBars(results);
        this.renderGlidePath(glideResults);

        const buildableDisplay = document.getElementById('flagMaxBuildableMsg');
        const buildableCount = document.getElementById('flagMaxBuildableCount');
        if (buildableDisplay && buildableCount) {
            if (hasAnyCost && this.lastMaxBuildable > 0) {
                buildableDisplay.style.display = 'block';
                buildableCount.textContent = this.lastMaxBuildable;
            } else {
                buildableDisplay.style.display = 'none';
                buildableCount.textContent = '0';
            }
        }

        // Render Main Status
        if (!hasAnyCost) {
            this.readyTimeDisplay.textContent = "---";
            this.readyTimeDisplay.style.color = "var(--accent-primary)";
            this.bottleneckMsg.textContent = "Enter flag costs to test for bottlenecks.";
            this.bottleneckMsg.style.color = "var(--text-muted)";
        } else if (!hasDeficit && results.length > 0) {
            this.readyTimeDisplay.textContent = "Ready Now!";
            this.readyTimeDisplay.style.color = "var(--success-color)";
            this.bottleneckMsg.textContent = "You have enough resources to build this flag.";
            this.bottleneckMsg.style.color = "var(--text-muted)";
        } else if (maxWaitHours === Infinity) {
            this.readyTimeDisplay.textContent = "Cannot Build";
            this.readyTimeDisplay.style.color = "var(--danger-color)";
            this.bottleneckMsg.textContent = `You have no income to generate missing ${bottleneckRes}.`;
            this.bottleneckMsg.style.color = "var(--danger-color)";
        } else {
            this.readyTimeDisplay.textContent = this.formatTime(maxWaitHours);
            this.readyTimeDisplay.style.color = "var(--accent-primary)";
            this.bottleneckMsg.textContent = `${bottleneckRes.charAt(0).toUpperCase() + bottleneckRes.slice(1)} is your bottleneck.`;
            this.bottleneckMsg.style.color = "var(--warning-color)";
        }
    }

    renderBars(results) {
        if (!this.deficitBarsContainer) return;
        this.deficitBarsContainer.innerHTML = '';

        results.forEach(res => {
            const bgClass = res.isBottleneck ? "rgba(255,0,0,0.1)" : "rgba(255,255,255,0.05)";
            const borderClass = res.isBottleneck ? "1px solid rgba(255,0,0,0.3)" : "none";

            const html = `
                <div style="background: ${bgClass}; border: ${borderClass}; padding: 10px 15px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 5px;">
                        <span style="color: ${res.color}; font-weight: bold;">
                            ${res.name} ${res.isBottleneck ? '⚠️ (Bottleneck)' : ''}
                        </span>
                        <span>${res.percent}%</span>
                    </div>
                    <!-- Progress Bar -->
                    <div style="height: 6px; background: rgba(0,0,0,0.5); border-radius: 3px; overflow: hidden; margin-bottom: 5px;">
                        <div style="height: 100%; width: ${res.percent}%; background: ${res.color}; transition: width 0.3s;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-muted);">
                        <span>Deficit: ${this.fmt(res.deficit)}</span>
                        <span>Time: ${res.timeStr}</span>
                    </div>
                </div>
            `;
            this.deficitBarsContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    renderGlidePath(glideResults) {
        if (!this.glidePathContainer || !this.glidePathBody) return;

        if (glideResults.length === 0) {
            this.glidePathContainer.style.display = 'none';
            return;
        }

        this.glidePathContainer.style.display = 'block';
        this.glidePathBody.innerHTML = '';

        glideResults.forEach(res => {
            const html = `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="text-align: left; padding: 10px 0; color: ${res.color}; font-weight: bold;">
                        <span style="display:inline-block; border-left: 3px solid ${res.color}; padding-left: 8px;">${res.name}</span>
                    </td>
                    <td style="padding: 10px 0; color: var(--text-primary);">+${this.fmt(res.income * 24)}</td>
                    <td style="padding: 10px 0; color: var(--text-primary);">+${this.fmt(res.income * 72)}</td>
                    <td style="padding: 10px 0; color: var(--text-primary);">+${this.fmt(res.income * 168)}</td>
                </tr>
            `;
            this.glidePathBody.insertAdjacentHTML('beforeend', html);
        });
    }

    exportToMail() {
        if (!this.lastHasAnyCost) {
            alert("Please enter flag costs to generate a report.");
            return;
        }

        let report = `<b>Alliance Flag Readiness Report</b>\n\n`;

        if (!this.lastHasDeficit && this.lastResults.length > 0) {
            report += `<color=#00ff00>Status: Ready Now!</color>\n\n`;
        } else if (this.lastMaxWaitHours === Infinity) {
            report += `<color=#ff0000>Status: Cannot Build (0 Income for ${this.lastBottleneckRes})</color>\n\n`;
        } else {
            const timeStr = this.formatTime(this.lastMaxWaitHours);
            const resName = this.lastBottleneckRes.charAt(0).toUpperCase() + this.lastBottleneckRes.slice(1);
            report += `Status: Ready in <b>${timeStr}</b>\n`;
            report += `Bottleneck: <color=#ff0000>${resName}</color>\n\n`;
        }

        if (this.lastMaxBuildable > 0) {
            report += `<color=#00ff00>Max Buildable Flags: <b>${this.lastMaxBuildable}</b></color>\n\n`;
        }

        report += `<b>Current Deficits:</b>\n`;
        this.lastResults.forEach(r => {
            report += `${r.name}: ${this.fmt(r.deficit)} ${r.isBottleneck ? '⚠️' : ''}\n`;
        });

        if (this.lastGlide && this.lastGlide.length > 0) {
            report += `\n<b>Income Glide Path:</b>\n`;
            this.lastGlide.forEach(g => {
                report += `${g.name}: 24h (+${this.fmt(g.income * 24)}) | 3d (+${this.fmt(g.income * 72)})\n`;
            });
        }

        const mailInput = document.getElementById('mail-input');
        if (mailInput) {
            mailInput.value = report;
            if (window.mailService) {
                window.mailService.updatePreview();
            }
        }

        // Navigate to Mail Tab
        const mailTabBtn = document.querySelector('.tab-btn[data-tab="mail"]');
        if (mailTabBtn) {
            mailTabBtn.click();
        }
    }

    fmt(num) {
        if (!num) return "0";
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    formatTime(hours) {
        const totalMinutes = Math.round(hours * 60);
        const d = Math.floor(totalMinutes / (24 * 60));
        const h = Math.floor((totalMinutes % (24 * 60)) / 60);
        const m = totalMinutes % 60;

        let parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || parts.length === 0) parts.push(`${m}m`);

        return parts.join(' ');
    }
}

window.AllianceFlagCalc = AllianceFlagCalc;

class HoHScannerCalc {
    constructor() {
        this.dropZone = document.getElementById('hohOcrDropZone');
        this.fileInput = document.getElementById('hohOcrInput');
        this.statusEl = document.getElementById('hohScannerStatus');
        this.resultsPanel = document.getElementById('hohResultsPanel');
        this.t4Display = document.getElementById('hohTotalT4Deads');
        this.t5Display = document.getElementById('hohTotalT5Deads');

        window.hohData = { t4: 0, t5: 0 };
        this.initDropzone();
    }

    initDropzone() {
        if (!this.dropZone || !this.fileInput) return;

        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(59, 130, 246, 0.15)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.background = 'rgba(0,0,0,0.2)';
            this.dropZone.style.borderColor = 'var(--border-color)';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(0,0,0,0.2)';
            this.dropZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files.length) this.processScreenshot(e.dataTransfer.files[0]);
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.processScreenshot(e.target.files[0]);
        });
    }

    async processScreenshot(file) {
        const targetKingdom = document.getElementById('hohTargetKingdom')?.value;
        if (!targetKingdom) {
            alert("Please select a target Kingdom from the dropdown before dropping the screenshot.");
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert("Please drop a valid image file.");
            return;
        }

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            this.statusEl.textContent = "Error: API Key Missing (Add in Settings)";
            this.statusEl.style.color = "var(--danger-color)";
            return;
        }

        this.statusEl.textContent = "Scanning Hall of Heroes screenshot with Gemini Vision...";
        this.statusEl.style.color = "var(--accent-primary)";
        this.dropZone.style.opacity = "0.5";

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64 = dataUrl.split(',')[1];
            const mimeType = file.type || 'image/jpeg';
            const apiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`;

            const prompt = `This is a "Unit Deaths" screenshot from the Rise of Kingdoms Hall of Heroes (Post-KvK).
It shows the total dead troops for a Kingdom. There are 8 gold framed commander icons in a zig-zag or block pattern, each representing a troop type/tier.
Look closely at the small Roman Numeral at the bottom center of each gold frame (IV = Tier 4, V = Tier 5).
Ignore the sword/horse/bow icons next to the numbers.

Extract all 8 numbers visible next to the frames.
Match them to the correct Tier based on the Roman Numeral on the frame (IV or V) and the unit type icon.

Return an exact JSON object containing the extracted values. Use 0 if a metric is missing. Keep all numbers as plain integers, avoiding commas (e.g. 1,200,000 -> 1200000).

Respond ONLY with a valid JSON object matching this structure identically:
{
  "t5_infantry": 0, "t5_cavalry": 0, "t5_archer": 0, "t5_siege": 0,
  "t4_infantry": 0, "t4_cavalry": 0, "t4_archer": 0, "t4_siege": 0
}`;

            const response = await fetch(`${apiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64 } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0,
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 429) {
                    throw new Error("Quota Exceeded (429). Check API limits.");
                }
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            const result = await response.json();
            const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            let cleaned = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);

            // Sum up the tiers
            let totalT4 = (parsed.t4_infantry || 0) + (parsed.t4_cavalry || 0) + (parsed.t4_archer || 0) + (parsed.t4_siege || 0);
            let totalT5 = (parsed.t5_infantry || 0) + (parsed.t5_cavalry || 0) + (parsed.t5_archer || 0) + (parsed.t5_siege || 0);

            if (window.uiService && window.uiService.data && window.uiService.data.state && window.uiService.data.state.kingdoms[targetKingdom]) {
                window.uiService.data.state.kingdoms[targetKingdom].hohData = { t4: totalT4, t5: totalT5 };
            } else {
                window.hohData = { t4: totalT4, t5: totalT5 }; // Fallback just in case
            }

            this.t4Display.textContent = totalT4.toLocaleString();
            this.t5Display.textContent = totalT5.toLocaleString();

            this.resultsPanel.classList.remove('hidden');

            this.statusEl.textContent = "Data extracted successfully! Reshaping DKP...";
            this.statusEl.style.color = "var(--success-color)";

            // Trigger UI Re-render
            if (window.uiService) {
                window.uiService.renderKingdomComparison();
            }

        } catch (err) {
            console.error("Gemini OCR Error:", err);
            this.statusEl.textContent = err.message.substring(0, 100);
            this.statusEl.style.color = "var(--danger-color)";
        } finally {
            this.dropZone.style.opacity = "1";
        }
    }
}

window.HoHScannerCalc = HoHScannerCalc;
