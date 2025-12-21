/**
 * Unity DKP System
 * Refactored for Scalability and Maintainability
 * 
 * Architecture:
 * - Config: Global constants and settings.
 * - Utils: Static helper functions.
 * - DataService: State management, persistence, and file parsing.
 * - CalculationService: Pure business logic for DKP and stats.
 * - UIService: DOM manipulation, event listeners, and rendering.
 */

// ==========================================
// 1. CONFIGURATION
// ==========================================
const Config = {
    DEFAULT_KINGDOM_SETTINGS: {
        deadsMultiplier: 0.02,
        deadsWeight: 50,
        kpPowerDivisor: 3,
        t5MixRatio: 0.7,
        kpMultiplier: 1.25,
        t4Points: 10,
        t5Points: 20
    },
    COLUMN_MAPPING: {
        'Governor ID': ['governor id', 'gov id', 'id', 'user id', 'uid'],
        'Governor Name': ['governor name', 'gov name', 'name', 'player', 'governor'],
        'Power': ['power', 'total power', 'pwr'],
        'Troop Power': ['troop power', 'troops', 'troop'],
        'Kill Points': ['kill points', 'kp', 'killpoints', 'kills'],
        'Deads': ['deads', 'dead', 'deaths', 'dead troops'],
        'T1 Kills': ['t1 kills', 'tier 1 kills', 't1'],
        'T2 Kills': ['t2 kills', 'tier 2 kills', 't2'],
        'T3 Kills': ['t3 kills', 'tier 3 kills', 't3'],
        'T4 Kills': ['t4 kills', 'tier 4 kills', 't4'],
        'T5 Kills': ['t5 kills', 'tier 5 kills', 't5'],
        'Town Hall': ['town hall', 'th', 'al', 'city hall', 'ch'],
        'Alliance Tag': ['alliance', 'tag', 'alliance tag', 'abbr'],
        'Healed': ['healed', 'sev wounded', 'severely wounded', 'heads', 'units healed'],
        'Resources Gathered': ['resources gathered', 'rss gathered', 'gathered', 'resources', 'resource assistance', 'rss assistance', 'rss', 'resource']
    }
};

// ==========================================
// 2. UTILITIES
// ==========================================
class Utils {
    static parseNumber(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
    }

    static debounce(func, wait) {
        let timeout;
        return function (...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static getFilteredData(data, townHall25) {
        if (!data) return [];
        if (!townHall25) return data;
        return data.filter(row => {
            const th = Utils.parseNumber(row['Town Hall']);
            return th === 25;
        });
    }

    static normalizeData(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const normalized = [];
        for (let j = 0; j < cols; j++) {
            let sum = 0, sumSq = 0;
            for (let i = 0; i < rows; i++) { sum += matrix[i][j]; sumSq += matrix[i][j] * matrix[i][j]; }
            const mean = sum / rows;
            const stdDev = Math.sqrt((sumSq / rows) - (mean * mean)) || 1;
            for (let i = 0; i < rows; i++) {
                if (!normalized[i]) normalized[i] = [];
                normalized[i][j] = (matrix[i][j] - mean) / stdDev;
            }
        }
        return normalized;
    }

    static dotProduct(vecA, vecB) {
        return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    }
}

class GitHubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        // Default to public repo if no local config found
        const defaults = { owner: 'reign3418', repo: 'unity-app', token: '' };
        this.config = JSON.parse(localStorage.getItem('unity_gh_config')) || defaults;
        // Ensure defaults are populated if partial config exists (except token)
        if (!this.config.owner) this.config.owner = defaults.owner;
        if (!this.config.repo) this.config.repo = defaults.repo;
    }

    saveConfig(owner, repo, token) {
        this.config = { owner, repo, token };
        localStorage.setItem('unity_gh_config', JSON.stringify(this.config));
        return true;
    }

    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        if (this.config.token) {
            headers['Authorization'] = `token ${this.config.token}`;
        }
        return headers;
    }

    async uploadFile(path, content, message) {
        if (!this.config.token) throw new Error("GitHub Token not found. Please configure in Settings.");

        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        // Check if file exists to get SHA (for update)
        let sha = null;
        try {
            const existing = await fetch(url, { headers: this.getHeaders() });
            if (existing.ok) {
                const data = await existing.json();
                sha = data.sha;
            }
        } catch (e) { /* Ignore if not exists */ }

        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))), // Base64 encode
            branch: 'main' // Default branch
        };
        if (sha) body.sha = sha;

        const response = await fetch(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Upload failed');
        }
        return await response.json();
    }

    async getFiles(folderPath) {
        if (!this.config.token) return [];
        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${folderPath}`;
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) return [];
        return await response.json();
    }

    async getFileContent(path) {
        const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        const headers = this.getHeaders();
        // Request raw content directly to handle large files and private repos correctly
        headers['Accept'] = 'application/vnd.github.v3.raw';

        console.log(`Fetching RAW content from: ${url}`);
        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errText = await response.text();
            console.error('GitHub Fetch Error:', errText);
            throw new Error(`Could not fetch file: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }
}

// ==========================================
// 3. STORAGE SERVICE (INDEXEDDB)
// ==========================================
class StorageService {
    constructor() {
        this.dbName = 'UnityDKP_DB';
        this.storeName = 'scans';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (e) => { console.error('DB Error', e); reject(e); };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    async saveScan(type, name, data, date) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const record = {
                type, // 'start', 'mid', 'end'
                name: name || `Scan ${new Date().toLocaleString()}`,
                data,
                date: date || new Date().toISOString(),
                timestamp: Date.now()
            };
            const request = store.add(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async getScans(type = null) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            let request;
            if (type) {
                const index = store.index('type');
                request = index.getAll(type);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = (e) => reject(e);
        });
    }

    async getScan(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }

    async deleteScan(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
}

// ==========================================
// 4. DATA SERVICE
// ==========================================
class DataService {
    constructor() {
        this.state = {
            kingdoms: {},
            activeKingdomId: null,
            startScanDate: null,
            midScanDate: null,
            endScanDate: null,
            loadedKingdoms: new Set(),
            filterTownHall25: false,
            rankingSort: { key: 'power', dir: 'desc' }
        };
        this.storage = new StorageService();
        this.storage.init().catch(console.error);
    }

    initKingdom(id) {
        if (!this.state.kingdoms[id]) {
            this.state.kingdoms[id] = {
                startData: [],
                midData: [],
                endData: [],
                calculatedData: [],
                currentOverviewData: [],
                config: { ...Config.DEFAULT_KINGDOM_SETTINGS },
                sortDirection: 1,
                lastSortCol: '',
                scatterChart: null,
                efficiencyChart: null,
                rosterScatterChart: null
            };
            this.state.loadedKingdoms.add(id);
        }
    }

    loadState() {
        try {
            const savedKingdoms = localStorage.getItem('dkp_kingdoms');
            const savedLoaded = localStorage.getItem('dkp_loadedKingdoms');
            const savedDates = localStorage.getItem('dkp_scanDates');

            if (savedKingdoms) this.state.kingdoms = JSON.parse(savedKingdoms);
            if (savedLoaded) this.state.loadedKingdoms = new Set(JSON.parse(savedLoaded));
            if (savedDates) {
                const dates = JSON.parse(savedDates);
                this.state.startScanDate = dates.start;
                this.state.midScanDate = dates.mid;
                this.state.endScanDate = dates.end;
            }
        } catch (e) { console.error('Failed to load state:', e); }
    }

    saveState() {
        try {
            // Avoid circular references if charts are stored in state (Charts are complex objects)
            // Ideally, we shouldn't store Chart instances in localStorage.
            // We should create a clean copy for storage.
            const cleanKingdoms = {};
            for (const [kId, kData] of Object.entries(this.state.kingdoms)) {
                cleanKingdoms[kId] = { ...kData, scatterChart: null, efficiencyChart: null, rosterScatterChart: null };
            }

            localStorage.setItem('dkp_kingdoms', JSON.stringify(cleanKingdoms));
            localStorage.setItem('dkp_loadedKingdoms', JSON.stringify(Array.from(this.state.loadedKingdoms)));
            localStorage.setItem('dkp_scanDates', JSON.stringify({
                start: this.state.startScanDate,
                mid: this.state.midScanDate,
                end: this.state.endScanDate
            }));
        } catch (e) { console.error('Failed to save state:', e); }
    }

    parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let extractedDate = null, allData = [], kingdoms = [];
                    const firstSheetCSV = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
                    const dateMatch = firstSheetCSV.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)/);
                    if (dateMatch) extractedDate = dateMatch[1];

                    workbook.SheetNames.forEach(sheetName => {
                        if (['summary', 'top 10s'].includes(sheetName.toLowerCase())) return;
                        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                        const normalize = (str) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : '';
                        let headerRowIndex = -1;
                        for (let i = 0; i < Math.min(json.length, 20); i++) {
                            if (json[i] && json[i].some(cell => Config.COLUMN_MAPPING['Governor ID'].includes(normalize(cell)))) { headerRowIndex = i; break; }
                        }

                        if (headerRowIndex !== -1) {
                            kingdoms.push(sheetName);
                            const headerMap = {};
                            json[headerRowIndex].forEach((h, i) => {
                                const norm = normalize(h);
                                for (const [key, vars] of Object.entries(Config.COLUMN_MAPPING)) { if (vars.includes(norm)) { headerMap[i] = key; break; } }
                            });
                            console.log(`[Parse] Sheet: ${sheetName}, Headers Mapped:`, headerMap);
                            json.slice(headerRowIndex + 1).forEach(row => {
                                const rowObj = {};
                                let hasData = false;
                                row.forEach((cell, i) => { if (headerMap[i]) { rowObj[headerMap[i]] = cell; if (cell) hasData = true; } });
                                if (hasData && rowObj['Governor ID']) { rowObj['_kingdom'] = sheetName; allData.push(rowObj); }
                            });
                        }
                    });

                    if (allData.length === 0) reject(new Error('No valid Governor data found.'));
                    else resolve({ data: allData, date: extractedDate, kingdoms });
                } catch (error) { reject(error); }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    async loadScanFromStorage(scanId) {
        const scan = await this.storage.getScan(parseInt(scanId));
        if (!scan) throw new Error('Scan not found in storage');
        return { data: scan.data.data, date: scan.data.date, kingdoms: scan.data.kingdoms };
    }
}

// ==========================================
// 4. CALCULATION SERVICE
// ==========================================
class CalculationService {
    static calculateKingdom(kingdomId, state) {
        const kState = state.kingdoms[kingdomId];
        if (!kState || kState.startData.length === 0 || kState.endData.length === 0) return;

        const config = kState.config;
        const midData = kState.midData;

        const startFiltered = Utils.getFilteredData(kState.startData, state.filterTownHall25);
        const midFiltered = Utils.getFilteredData(kState.midData, state.filterTownHall25);
        const endFiltered = Utils.getFilteredData(kState.endData, state.filterTownHall25);

        console.log(`[Calc] Kingdom ${kingdomId}: Start=${kState.startData.length}, End=${kState.endData.length}`);
        console.log(`[Calc] Filtered (TH25=${state.filterTownHall25}): Start=${startFiltered.length}, End=${endFiltered.length}`);

        const startMap = new Map(startFiltered.map(row => [row['Governor ID'], row]));
        const midMap = new Map(midFiltered.map(row => [row['Governor ID'], row]));
        const endMap = new Map(endFiltered.map(row => [row['Governor ID'], row]));

        // STRICT INTERSECTION: Only IDs in Start AND End
        const allIds = new Set([...startMap.keys()].filter(id => endMap.has(id)));
        console.log(`[Calc] Intersection IDs: ${allIds.size}`);

        kState.calculatedData = [];

        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};
            const midRow = midMap.get(id) || {};

            const name = endRow['Governor Name'] || startRow['Governor Name'] || 'Unknown';
            const kingdom = endRow['_kingdom'] || startRow['_kingdom'] || kingdomId;

            const deadsDiff = Math.max(0, Utils.parseNumber(endRow['Deads']) - Utils.parseNumber(startRow['Deads']));

            // Healed Logic
            let healedDiff = 0;
            if (midData.length > 0) {
                const endTroop = Utils.parseNumber(endRow['Troop Power']);
                const midTroop = Utils.parseNumber(midRow['Troop Power']);
                if (endTroop > 0 && midTroop > 0) {
                    healedDiff = Math.max(0, endTroop - midTroop);
                }
            } else {
                healedDiff = Math.max(0, Utils.parseNumber(endRow['Healed']) - Utils.parseNumber(startRow['Healed']));
            }

            const startPower = Utils.parseNumber(startRow['Power']);
            const powerDiff = Utils.parseNumber(endRow['Power']) - startPower;
            const troopPowerDiff = Utils.parseNumber(endRow['Troop Power']) - Utils.parseNumber(startRow['Troop Power']);

            const startRawKP = Utils.parseNumber(startRow['Kill Points']);
            const endRawKP = Utils.parseNumber(endRow['Kill Points']);
            const rawKPDiff = Math.max(0, endRawKP - startRawKP);

            const t4Diff = Math.max(0, Utils.parseNumber(endRow['T4 Kills']) - Utils.parseNumber(startRow['T4 Kills']));
            const t5Diff = Math.max(0, Utils.parseNumber(endRow['T5 Kills']) - Utils.parseNumber(startRow['T5 Kills']));
            const t4t5Combined = t4Diff + t5Diff;

            // Resources Logic
            const rssDiff = Math.max(0, Utils.parseNumber(endRow['Resources Gathered']) - Utils.parseNumber(startRow['Resources Gathered']));

            const kvkKP = (t4Diff * config.t4Points) + (t5Diff * config.t5Points);
            const t4MixRatio = 1 - config.t5MixRatio;
            const targetKP = ((startPower / config.kpPowerDivisor) * ((config.t5MixRatio * config.t5Points) + (t4MixRatio * config.t4Points))) * config.kpMultiplier;
            const targetDeads = startPower * config.deadsMultiplier;

            const kpPercent = targetKP > 0 ? (kvkKP / targetKP) * 100 : 0;
            const deadPercent = targetDeads > 0 ? (deadsDiff / targetDeads) * 100 : 0;

            let totalDKPPercent = 0;
            if (targetKP > 0 && targetDeads > 0) totalDKPPercent = (kpPercent + deadPercent) / 2;
            else if (targetKP > 0) totalDKPPercent = kpPercent;
            else if (targetDeads > 0) totalDKPPercent = deadPercent;

            // Status Logic (Refined)
            let status = 'Sleeper';
            if (rawKPDiff > 0) status = 'Fighter';
            else if (rssDiff > 0) status = 'Farmer';
            else if (powerDiff > 0) status = 'Grower';
            else if (powerDiff < 0) status = 'Dropped';

            kState.calculatedData.push({
                id, name, kingdom, startPower, powerDiff, troopPowerDiff, rawKP: rawKPDiff,
                status, rssGathered: rssDiff,
                t1: Math.max(0, Utils.parseNumber(endRow['T1 Kills']) - Utils.parseNumber(startRow['T1 Kills'])),
                t2: Math.max(0, Utils.parseNumber(endRow['T2 Kills']) - Utils.parseNumber(startRow['T2 Kills'])),
                t3: Math.max(0, Utils.parseNumber(endRow['T3 Kills']) - Utils.parseNumber(startRow['T3 Kills'])),
                t4: t4Diff, t5: t5Diff, t4t5: t4t5Combined,
                deads: deadsDiff, healed: healedDiff, kvkKP, targetKP,
                kpPercent: parseFloat(kpPercent.toFixed(2)),
                targetDeads,
                deadPercent: parseFloat(deadPercent.toFixed(2)),
                totalDKPPercent: parseFloat(totalDKPPercent.toFixed(2)),
                bonus: 0
            });
        });

        // Restore bonuses if they existed (Simple match by ID)
        // Note: For now, keeping original behavior (reset), as explicit "preserve" logic wasn't in procedural version unless manually coded.
        // Wait, the procedural version recalculated `kState.calculatedData = []`, so it wiped bonuses unless `saveState` persisted them and we didn't wipe.
        // `calculateKingdom` creates a fresh array. So bonuses were lost on Recalculate button click in old version too.
        // Run Governance Analysis
        this.calculateGovernance(kState);
    }

    static calculateGovernance(kState) {
        if (!kState || !kState.calculatedData) return;

        // Benchmarks (Simple heuristics for now, could be dynamic later)
        // Ideally, these would be based on Kingdom Average, but safe defaults work.
        const BENCHMARK_RSS = 500000000; // 500M RSS = Max Points
        const BENCHMARK_HEALED = 5000000; // 5M Healed = Max Points

        kState.calculatedData.forEach(row => {
            let score = 0;
            let combatPts = 0;
            let supportPts = 0;
            let notes = [];

            // 1. Activity Penalties
            if (row.status === 'Sleeper') { score -= 100; notes.push('Inactive'); }
            else if (row.status === 'Dropped') { score -= 100; notes.push('Zeroed/Migrated'); }
            else if (row.status === 'Grower') { score -= 50; notes.push('Selfish Growth'); }

            // 2. Combat Points (Max 80)
            // KP % (Max 40) - Capped at 150% target for bonus
            const kpScore = Math.min(1.5, (row.kpPercent || 0) / 100) * 40;
            // Dead % (Max 40)
            const deadScore = Math.min(1.5, (row.deadPercent || 0) / 100) * 40;

            combatPts = kpScore + deadScore;
            score += combatPts;

            // 3. Support Points (Max 20 + Bonus)
            // RSS (Max 10)
            const rssScore = Math.min(1, (row.rssGathered || 0) / BENCHMARK_RSS) * 10;
            // Healed (Max 10)
            const healedScore = Math.min(1, (row.healed || 0) / BENCHMARK_HEALED) * 10;

            supportPts = rssScore + healedScore;
            score += supportPts;

            // T1/T2 Bonus (Filling Rallies) - Max 5 pts
            if ((row.t1 + row.t2) > 100000) { score += 5; supportPts += 5; notes.push('Filler'); }

            // Final Assessment
            row.governanceScore = Math.round(score);
            row.combatPts = Math.round(combatPts);
            row.supportPts = Math.round(supportPts);

            if (score >= 80) row.riskLevel = 'Safe';
            else if (score >= 40) row.riskLevel = 'Monitor';
            else if (score >= 0) row.riskLevel = 'Warning';
            else row.riskLevel = 'Critical';

            row.mainContribution = combatPts > supportPts ? 'Combat' : 'Support';
            if (combatPts < 5 && supportPts < 5) row.mainContribution = 'None';

            row.governanceNotes = notes.join(', ') || '-';
        });
    }

    static calculateOverviewDiff(startData, endData) {
        const startMap = new Map(startData.map(row => [row['Governor ID'], row]));
        const endMap = new Map(endData.map(row => [row['Governor ID'], row]));
        const allIds = new Set([...startMap.keys()].filter(id => endMap.has(id)));

        const headers = Object.keys(startData[0] || endData[0] || {});
        // Static columns that shouldn't be diffed
        const staticColumns = new Set(['governor id', 'governor name', 'alliance tag', 'kingdom', 'town hall', '_kingdom']);

        const diffData = [];
        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};
            const newRow = {};

            headers.forEach(header => {
                const lowerHeader = header.toLowerCase();
                const isNumeric = !isNaN(parseFloat(startRow[header]?.toString().replace(/,/g, ''))) || !isNaN(parseFloat(endRow[header]?.toString().replace(/,/g, '')));

                if (header === '_kingdom' || staticColumns.has(lowerHeader)) {
                    newRow[header] = endRow[header] || startRow[header] || '';
                } else if (isNumeric) {
                    const startVal = Utils.parseNumber(startRow[header]);
                    const endVal = Utils.parseNumber(endRow[header]);
                    let diff = endVal - startVal;
                    // Prevent negative kills
                    if (['t1', 't2', 't3', 't4', 't5'].some(k => lowerHeader.includes(k))) diff = Math.max(0, diff);
                    newRow[header] = diff > 0 ? `+ ${diff.toLocaleString()}` : diff.toLocaleString();
                } else {
                    newRow[header] = endRow[header] || startRow[header] || '';
                }
            });
            diffData.push(newRow);
        });
        return diffData;
    }

    processImportedData(data, type) {
        // data is array of governor objects
        // We need to identify kingdoms from the data
        const kingdoms = new Set(data.map(r => r._kingdom).filter(k => k));

        kingdoms.forEach(kId => {
            this.initKingdom(kId);
            const kState = this.state.kingdoms[kId];
            if (type === 'start') kState.startData = data.filter(r => r._kingdom === kId);
            else if (type === 'mid') kState.midData = data.filter(r => r._kingdom === kId);
            else kState.endData = data.filter(r => r._kingdom === kId);

            // Recalculate if we have enough data
            if (kState.startData.length > 0 && kState.endData.length > 0) {
                CalculationService.calculateKingdom(kId, this.state);
            }
        });
        this.saveState();
    }
}

// ==========================================
// 5. UI SERVICE
// ==========================================
class UIService {
    constructor(dataService) {
        this.data = dataService;
        this.elements = {};
        this.cacheElements();
    }

    cacheElements() {
        // Cache all IDs for quick access
        const ids = [
            'mainTabs', 'kingdomTabs', 'kingdomsContainer', 'kingdomContentTemplate',
            'startScanDetails', 'endScanDetails', 'midScanDetails',
            'resetDataBtn', 'prekvkKingdomSelect', 'prekvkGovCountSelect',
            'kingdomAnalysisContainer', 'allianceAnalysisContainer', 'governorAnalysisContainer',
            'townHallFilter', 'npwdKingdomSelect', 'newArrivalsContainer', 'departuresContainer',
            'rankingGovCountSelect', 'rankingTable', 'rankingCountLabel',
            'kingdomComparisonLimit', 'kingdomComparisonTable'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));

        // Dynamic elements can be queried on demand, or cached if stable
    }

    init() {
        this.setupEventListeners();
        if (this.data.state.loadedKingdoms.size > 0) {
            this.renderKingdomTabs();
            // Restore active state if needed, or default
            this.updateScanDetails('start', this.data.state.startScanDate, Array.from(this.data.state.loadedKingdoms));
            this.updateScanDetails('mid', this.data.state.midScanDate, Array.from(this.data.state.loadedKingdoms));
            this.updateScanDetails('end', this.data.state.endScanDate, Array.from(this.data.state.loadedKingdoms));

            // Recalculate all loaded to ensure charts/data are fresh
            this.data.state.loadedKingdoms.forEach(kId => {
                CalculationService.calculateKingdom(kId, this.data.state);
            });
            this.renderKingdomComparison();
        }
    }

    setupEventListeners() {
        // Main Tab Switching
        if (this.elements.mainTabs) {
            this.elements.mainTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (btn) this.switchMainTab(btn.dataset.tab);
            });
        }

        if (this.elements.kingdomTabs) {
            this.elements.kingdomTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (btn) {
                    const kId = btn.dataset.tab.replace('kingdom-', '');
                    this.switchKingdom(kId);
                }
            });
        }

        // Town Hall Filter
        if (this.elements.townHallFilter) {
            this.elements.townHallFilter.addEventListener('change', (e) => {
                this.data.state.filterTownHall25 = e.target.checked;
                // Re-render active view
                const activeMainTab = document.querySelector('.tab-btn.active');
                if (activeMainTab) {
                    const tabId = activeMainTab.dataset.tab;
                    if (tabId === 'prekvk-analysis') {
                        const activeSubTab = document.querySelector('.prekvk-subtabs .subtab-btn.active');
                        if (activeSubTab) this.switchPrekvkSubTab(activeSubTab.dataset.subtab);
                    } else if (tabId === 'all-kingdom-results') {
                        this.renderKingdomComparison();
                    } else if (tabId.startsWith('kingdom-')) {
                        const kId = tabId.replace('kingdom-', '');
                        // Recalculate if needed
                        if (this.data.state.kingdoms[kId].calculatedData.length > 0) CalculationService.calculateKingdom(kId, this.data.state);
                        this.updateOverview(kId);
                    }
                }
            });
        }

        // Reset Data
        if (this.elements.resetDataBtn) {
            this.elements.resetDataBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all data and start fresh? This action cannot be undone.')) {
                    localStorage.removeItem('dkp_kingdoms');
                    localStorage.removeItem('dkp_loadedKingdoms');
                    localStorage.removeItem('dkp_scanDates');
                    location.reload();
                }
            });
        }

        // GitHub Integration
        this.ghService = new GitHubService();
        const ghOwner = document.getElementById('ghOwner');
        const ghRepo = document.getElementById('ghRepo');
        const ghToken = document.getElementById('ghToken');

        // Load saved config
        if (this.ghService.config.token) {
            if (ghOwner) ghOwner.value = this.ghService.config.owner;
            if (ghRepo) ghRepo.value = this.ghService.config.repo;
            if (ghToken) ghToken.value = this.ghService.config.token;
        }

        const saveGhBtn = document.getElementById('saveGhConfigBtn');
        if (saveGhBtn) {
            saveGhBtn.addEventListener('click', () => {
                const success = this.ghService.saveConfig(
                    ghOwner.value.trim(),
                    ghRepo.value.trim(),
                    ghToken.value.trim()
                );
                if (success) alert('GitHub configuration saved!');
            });
        }

        // Upload Buttons
        ['start', 'mid', 'end'].forEach(type => {
            const btn = document.getElementById(`cloudUpload${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
            if (btn) {
                btn.addEventListener('click', async () => {
                    const kingdoms = Array.from(this.data.state.loadedKingdoms);
                    if (kingdoms.length === 0) return alert('No data to upload.');

                    // Gather data for this type
                    let allData = [];
                    let date = new Date().toISOString().split('T')[0];
                    if (type === 'start') {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].startData));
                        date = this.data.state.startScanDate || date;
                    } else if (type === 'mid') {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].midData));
                        date = this.data.state.midScanDate || date;
                    } else {
                        kingdoms.forEach(k => allData.push(...this.data.state.kingdoms[k].endData));
                        date = this.data.state.endScanDate || date;
                    }

                    if (allData.length === 0) return alert('No relevant scan data found to upload.');

                    const name = prompt('Enter a name for this cloud save:', `${type}_scan_${date}`);
                    if (!name) return;

                    const fileName = `scans/${type}/${name}.json`;

                    try {
                        btn.textContent = '⏳';
                        await this.ghService.uploadFile(fileName, allData, `Upload ${type} scan: ${name}`);
                        alert(`Uploaded successfully to ${fileName}`);
                        btn.textContent = '☁️';
                    } catch (e) {
                        alert('Upload failed: ' + e.message);
                        btn.textContent = '❌';
                        setTimeout(() => btn.textContent = '☁️', 2000);
                    }
                });
            }
        });

        // PreKVK Analysis Listeners
        const prekvkSubTabs = document.querySelector('.prekvk-subtabs');
        if (prekvkSubTabs) {
            prekvkSubTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('subtab-btn')) {
                    this.switchPrekvkSubTab(e.target.dataset.subtab);
                }
            });
        }

        if (this.elements.prekvkKingdomSelect) {
            this.elements.prekvkKingdomSelect.addEventListener('change', (e) => {
                const kingdomId = e.target.value;
                const activeBtn = document.querySelector('.prekvk-subtabs .subtab-btn.active');
                if (activeBtn) {
                    const activeSubTab = activeBtn.dataset.subtab;
                    if (activeSubTab === 'alliance-analysis') this.renderAllianceAnalysis(kingdomId);
                    if (activeSubTab === 'governor-analysis') this.renderGovernorAnalysis(kingdomId);
                }
            });
        }

        if (this.elements.prekvkGovCountSelect) {
            this.elements.prekvkGovCountSelect.addEventListener('change', () => this.renderKingdomAnalysis());
        }

        // PreKVK Ranking Listeners
        if (this.elements.rankingGovCountSelect) {
            this.elements.rankingGovCountSelect.addEventListener('change', (e) => {
                document.getElementById('rankingCountLabel').textContent = e.target.value === 'all' ? 'All' : e.target.value;
                this.renderPreKVKRanking();
            });
        }

        // Comparison Limit
        if (this.elements.kingdomComparisonLimit) {
            this.elements.kingdomComparisonLimit.addEventListener('change', () => this.renderKingdomComparison());
        }

        // New Phone Who Dis Listeners
        if (this.elements.npwdKingdomSelect) {
            this.elements.npwdKingdomSelect.addEventListener('change', (e) => {
                this.renderNewPhoneWhoDis(e.target.value);
            });
        }

        this.attachProfileListeners();
    }

    attachProfileListeners() {
        const types = ['start', 'mid', 'end'];
        types.forEach(type => {
            const saveBtn = document.getElementById(`${type}ProfileName`).nextElementSibling;
            const loadBtn = document.getElementById(`load${type.charAt(0).toUpperCase() + type.slice(1)}ScanBtn`);
            const deleteBtn = document.getElementById(`delete${type.charAt(0).toUpperCase() + type.slice(1)}ScanBtn`);
            const select = document.getElementById(`${type}ProfileSelect`);

            // Populate initially
            this.updateProfileDropdown(type);

            // SAVE
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const nameInput = document.getElementById(`${type}ProfileName`);
                    const name = nameInput.value.trim();
                    // We need the data. Currently, file parsing happens in onchange.
                    // We can check if any data exists for this type in state.
                    // Actually, the user wants to upload, THEN save.
                    // So we must have data in state.

                    // Simple logic: If kingdoms are loaded, and we have data, we save the memory state.
                    // We'll filter state.kingdoms for ALL data matching this type/date? No, that's complex.
                    // Better: Intercept the "Handle Files" logic to allow "Processing" -> "Data Object" -> "Save".
                    // But for now, let's just save the CURRENT collected data for this "type" across all kingdoms? 
                    // No, usually a scan file is one file. 
                    // The user uploads a file, it gets parsed. We should ideally save THE PARSED RESULT immediately if requested.
                    // OR, we assume the user just wants to save the CURRENT state of "Start Scans" as a snapshot.

                    // Re-reading user request: "everytime we want to look at something we have to upload scans... save each scan and make it a profile".
                    // Implies saving the File content or the Parsed content. Saving parsed is better.
                    // Challenge: We already merged data into `kState`.
                    // Compromise: When saving, we assume the user wants to save what they JUST uploaded (or what is currently sitting in memory).
                    // We can iterate all kingdoms and gather `startData` (if type is start).

                    const gatheredData = [];
                    const kingdoms = [];
                    let date = null;

                    Object.keys(this.data.state.kingdoms).forEach(kId => {
                        const k = this.data.state.kingdoms[kId];
                        const list = (type === 'start') ? k.startData : (type === 'mid' ? k.midData : k.endData);
                        if (list && list.length > 0) {
                            gatheredData.push(...list);
                            kingdoms.push(kId);
                        }
                    });

                    if (type === 'start') date = this.data.state.startScanDate;
                    if (type === 'mid') date = this.data.state.midScanDate;
                    if (type === 'end') date = this.data.state.endScanDate;

                    if (gatheredData.length === 0) {
                        alert(`No ${type} scan data loaded to save.`);
                        return;
                    }

                    try {
                        await this.data.storage.saveScan(type, name, { data: gatheredData, date, kingdoms });
                        this.updateProfileDropdown(type);
                        nameInput.value = '';
                        alert('Profile saved!');
                    } catch (e) { console.error(e); alert('Error saving profile.'); }
                });
            }

            // LOAD
            if (loadBtn) {
                loadBtn.addEventListener('click', async () => {
                    const val = select.value;
                    if (!val) return alert('Please select a profile first.');

                    if (val.startsWith('cloud:')) {
                        try {
                            loadBtn.textContent = '⏳';
                            const path = val.replace('cloud:', '');
                            const content = await this.ghService.getFileContent(path);

                            // Inline processing to avoid method missing error
                            const data = content;
                            // Identify kingdoms
                            const kingdoms = new Set(data.map(r => r._kingdom).filter(k => k));

                            kingdoms.forEach(kId => {
                                this.data.initKingdom(kId);
                                const kState = this.data.state.kingdoms[kId];
                                if (type === 'start') kState.startData = data.filter(r => r._kingdom === kId);
                                else if (type === 'mid') kState.midData = data.filter(r => r._kingdom === kId);
                                else kState.endData = data.filter(r => r._kingdom === kId);

                                // Recalculate if we have enough data
                                if (kState.startData.length > 0 && kState.endData.length > 0) {
                                    CalculationService.calculateKingdom(kId, this.data.state);
                                }
                            });
                            this.data.saveState();

                            this.renderKingdomTabs();
                            this.updateOverview(this.data.state.activeKingdomId || Array.from(this.data.state.loadedKingdoms)[0]);

                            alert(`${type.toUpperCase()} cloud profile loaded!`);
                        } catch (e) {
                            console.error(e);
                            alert('Failed to load cloud profile: ' + e.message);
                        } finally {
                            loadBtn.textContent = 'Load';
                        }
                    } else {
                        // Local Load
                        try {
                            const result = await this.data.loadScanFromStorage(parseInt(val));
                            if (!result) throw new Error('Scan not found');
                            // { data, date, kingdoms }
                            const { data, date, kingdoms } = result;

                            if (type === 'start') { this.data.state.startScanDate = date; }
                            else if (type === 'mid') { this.data.state.midScanDate = date; }
                            else { this.data.state.endScanDate = date; }

                            this.updateScanDetails(type, date, kingdoms);

                            kingdoms.forEach(kId => {
                                this.data.initKingdom(kId);
                                const kState = this.data.state.kingdoms[kId];
                                if (type === 'start') kState.startData = data.filter(r => r['_kingdom'] === kId);
                                else if (type === 'mid') kState.midData = data.filter(r => r['_kingdom'] === kId);
                                else kState.endData = data.filter(r => r['_kingdom'] === kId);
                            });

                            this.data.saveState();
                            this.renderKingdomTabs();

                            this.data.state.loadedKingdoms.forEach(kId => CalculationService.calculateKingdom(kId, this.data.state));
                            this.renderKingdomComparison();
                            alert(`${type.toUpperCase()} profile loaded!`);

                        } catch (e) { console.error(e); alert('Error loading profile.'); }
                    }
                });
            }

            // DELETE
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    const id = select.value;
                    if (!id) return;
                    if (confirm('Delete this profile permanently?')) {
                        await this.data.storage.deleteScan(parseInt(id));
                        this.updateProfileDropdown(type);
                    }
                });
            }
        });
    }

    async updateProfileDropdown(type) {
        const select = document.getElementById(`${type}ProfileSelect`);
        if (!select) return;

        // Fetch ALL scans now, ignoring 'type' filter for the dropdown
        const scans = await this.data.storage.getScans();

        select.innerHTML = '<option value="">Load Saved Profile...</option>';
        scans.forEach(scan => {
            const option = document.createElement('option');
            option.value = scan.id;
            // Add (Type) to the label so user knows source
            const typeLabel = scan.type.charAt(0).toUpperCase() + scan.type.slice(1);
            option.textContent = `[${typeLabel}] ${scan.name} (${new Date(scan.timestamp).toLocaleDateString()})`;
            select.appendChild(option);
        });

        // Add Cloud Profiles
        if (this.ghService) {
            try {
                const files = await this.ghService.getFiles(`scans/${type}`);
                if (Array.isArray(files)) {
                    files.forEach(file => {
                        if (file.name.endsWith('.json')) {
                            const option = document.createElement('option');
                            const name = file.name.replace('.json', '');
                            option.value = `cloud:${file.path}`; // Store path
                            option.textContent = `☁️ ${name}`;
                            select.appendChild(option);
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch ${type} profiles from GitHub`, e);
            }
        }
    }

    _activateTab(container, tabSelector, contentSelector, activeId, datasetKey = 'tab') {
        if (!container) return;
        container.querySelectorAll(tabSelector).forEach(btn => {
            btn.classList.toggle('active', btn.dataset[datasetKey] === activeId);
        });
        if (datasetKey === 'tab') {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(activeId);
            if (content) content.classList.add('active');
        } else {
            container.querySelectorAll(contentSelector).forEach(content => {
                content.classList.toggle('active', content.dataset.content === activeId);
            });
        }
    }

    switchMainTab(tabId) {
        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');
        if (this.elements.kingdomTabs) this.elements.kingdomTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

        this._activateTab(this.elements.mainTabs, '.tab-btn', null, tabId, 'tab');

        if (tabId === 'prekvk-analysis') {
            const activeSubTabBtn = document.querySelector('.prekvk-subtabs .subtab-btn.active');
            const subTabId = activeSubTabBtn ? activeSubTabBtn.dataset.subtab : 'kingdom-analysis';
            this.switchPrekvkSubTab(subTabId);
        } else if (tabId === 'all-kingdom-results') {
            this.renderKingdomComparison();
        } else if (tabId === 'new-phone-who-dis') {
            this.updateNPWDDropdown();
        } else if (tabId === 'prekvk-ranking') {
            this.renderPreKVKRanking();
        }
        this.data.state.activeKingdomId = null;
    }

    switchKingdom(kingdomId) {
        this.data.state.activeKingdomId = kingdomId;
        // Deactivate main tabs
        if (this.elements.mainTabs) this.elements.mainTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        // Deactivate other kingdom tabs
        if (this.elements.kingdomTabs) this.elements.kingdomTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');

        const btn = this.elements.kingdomTabs ? this.elements.kingdomTabs.querySelector(`[data-tab="kingdom-${kingdomId}"]`) : null;
        if (btn) btn.classList.add('active');

        const content = document.getElementById(`kingdom-${kingdomId}`);
        if (content) {
            content.style.display = 'block';
            if (!content.querySelector('.subtab-content.active')) {
                this.switchSubTab(kingdomId, 'overview');
            }
            this.updateOverview(kingdomId);
        }
    }

    switchSubTab(kingdomId, subTabId) {
        const kingdomContainer = document.getElementById(`kingdom-${kingdomId}`);
        if (!kingdomContainer) return;

        this._activateTab(kingdomContainer, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        if (subTabId === 'overview') this.syncOverviewScroll(kingdomId);
        else if (subTabId === 'scatter') {
            const kState = this.data.state.kingdoms[kingdomId];
            const data = kState.calculatedData.length > 0 ? kState.calculatedData : kState.currentOverviewData;
            if (data.length > 0) this.renderScatterChart(kingdomId, data);
        } else if (subTabId === 'efficiency') {
            const kState = this.data.state.kingdoms[kingdomId];
            if (kState.calculatedData.length > 0) this.renderPowerEfficiencyChart(kingdomId, kState.calculatedData);
        } else if (subTabId === 'roster-analysis') {
            const kState = this.data.state.kingdoms[kingdomId];
            const data = kState.startData.length > 0 ? kState.startData : kState.endData;
            if (data.length > 0) this.renderRosterAnalysis(kingdomId, data);
            else {
                const insightsId = document.getElementById('rosterInsights');
                if (insightsId) insightsId.innerHTML = '<p>No data available for analysis.</p>';
            }
        } else if (subTabId === 'governance') {
            const kState = this.data.state.kingdoms[kingdomId];
            if (kState.calculatedData.length > 0) this.renderGovernanceTab(kingdomId, kState.calculatedData);
        }
    }

    switchPrekvkSubTab(subTabId) {
        const container = document.getElementById('prekvk-analysis');
        if (!container) return;
        this._activateTab(container, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        const select = this.elements.prekvkKingdomSelect;
        const govCountSelect = this.elements.prekvkGovCountSelect;

        if (select) {
            if (subTabId === 'kingdom-analysis') select.classList.add('hidden');
            else select.classList.remove('hidden');
        }
        if (govCountSelect) {
            if (subTabId === 'kingdom-analysis') govCountSelect.classList.remove('hidden');
            else govCountSelect.classList.add('hidden');
        }

        if (subTabId === 'kingdom-analysis') {
            this.renderKingdomAnalysis();
        } else if (select && select.value) {
            if (subTabId === 'alliance-analysis') this.renderAllianceAnalysis(select.value);
            if (subTabId === 'governor-analysis') this.renderGovernorAnalysis(select.value);
        }
    }

    updateScanDetails(type, date, kingdoms) {
        let detailsEl;
        if (type === 'start') detailsEl = this.elements.startScanDetails;
        else if (type === 'mid') detailsEl = document.getElementById('midScanDetails');
        else detailsEl = this.elements.endScanDetails;

        if (!detailsEl) return;
        let html = '';
        if (date) html += `<div class="scan-date">Date: <strong>${date}</strong></div>`;
        if (kingdoms && kingdoms.length > 0) html += `<div class="scan-kingdoms">Kingdoms: <strong>${kingdoms.join(', ')}</strong></div>`;
        detailsEl.innerHTML = html;
        detailsEl.style.display = 'block';
    }

    renderKingdomTabs() {
        if (!this.elements.kingdomTabs) return;
        this.elements.kingdomTabs.innerHTML = '';

        const kingdoms = Array.from(this.data.state.loadedKingdoms);
        if (kingdoms.length > 0) this.elements.kingdomTabs.classList.remove('hidden');
        else this.elements.kingdomTabs.classList.add('hidden');

        kingdoms.forEach(kId => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = `kingdom-${kId}`;
            btn.dataset.tooltip = `Analysis and calculations for Kingdom ${kId}`;
            btn.textContent = `Kingdom ${kId}`;
            this.elements.kingdomTabs.appendChild(btn);

            if (!document.getElementById(`kingdom-${kId}`)) this.createKingdomContent(kId);
        });
        this.updatePrekvkDropdown();
        this.updateNPWDDropdown();
    }

    renderKingdomComparison() {
        const tbody = document.querySelector('#kingdomComparisonTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const limitSelect = document.getElementById('kingdomComparisonLimit');
        const limitVal = limitSelect ? limitSelect.value : 'all';

        if (this.data.state.loadedKingdoms.size === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No kingdoms loaded. Upload scans to begin.</td></tr>';
            return;
        }

        let hasData = false;
        this.data.state.loadedKingdoms.forEach(kingdomId => {
            const kState = this.data.state.kingdoms[kingdomId];
            if (!kState) return;

            if (!kState.calculatedData || kState.calculatedData.length === 0) {
                const tr = document.createElement('tr');
                let statusMsg = 'No Data';
                if (kState.startData.length === 0 && kState.endData.length === 0) statusMsg = 'No Data';
                else if (kState.startData.length === 0) statusMsg = 'Missing Start Scan';
                else if (kState.endData.length === 0) statusMsg = 'Missing End Scan';
                else statusMsg = 'Calculation Pending';

                tr.innerHTML = `<td>${kingdomId}</td><td colspan="8" style="text-align:center; color: var(--text-secondary); font-style: italic;">${statusMsg} - Upload missing file to see results</td>`;
                tbody.appendChild(tr);
                return;
            }

            hasData = true;
            let processedData = [...kState.calculatedData];
            if (limitVal !== 'all') {
                const limit = parseInt(limitVal);
                processedData.sort((a, b) => (b.startPower || 0) - (a.startPower || 0));
                processedData = processedData.slice(0, limit);
            }

            let stats = { startPower: 0, powerDiff: 0, troopPower: 0, t4: 0, t5: 0, deads: 0, healed: 0, kp: 0, dkp: 0 };
            processedData.forEach(p => {
                stats.startPower += p.startPower || 0;
                stats.powerDiff += p.powerDiff || 0;
                stats.troopPower += p.troopPowerDiff || 0;
                stats.t4 += p.t4 || 0;
                stats.t5 += p.t5 || 0;
                stats.deads += p.deads || 0;
                stats.healed += p.healed || 0;
                stats.kp += p.kvkKP || 0;
            });

            const deadsWeight = kState.config.deadsWeight || 50;
            stats.dkp = stats.kp + (stats.deads * deadsWeight);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${kingdomId}</td>
                <td>${stats.startPower.toLocaleString()}</td>
                <td class="${stats.powerDiff >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.powerDiff.toLocaleString()}</td>
                <td class="${stats.troopPower >= 0 ? 'status-complete' : 'status-incomplete'}">${stats.troopPower.toLocaleString()}</td>
                <td>${stats.t4.toLocaleString()}</td>
                <td>${stats.t5.toLocaleString()}</td>
                <td>${stats.deads.toLocaleString()}</td>
                <td>${stats.healed.toLocaleString()}</td>
                <td>${stats.kp.toLocaleString()}</td>
                <td>${Math.round(stats.dkp).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });

        if (!hasData && tbody.innerHTML === '') {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No valid comparisons available.</td></tr>';
        }
    }

    createKingdomContent(kingdomId) {
        const clone = this.elements.kingdomContentTemplate.cloneNode(true);
        clone.id = `kingdom-${kingdomId}`;
        clone.style.display = 'none';
        clone.classList.add('kingdom-content');

        const subTabs = clone.querySelector('.kingdom-subtabs');
        if (subTabs) {
            subTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('subtab-btn')) this.switchSubTab(kingdomId, e.target.dataset.subtab);
            });
        }

        const kConfig = this.data.state.kingdoms[kingdomId].config;
        clone.querySelectorAll('.config-input').forEach(input => {
            if (kConfig[input.name] !== undefined) input.value = kConfig[input.name];
            input.addEventListener('change', (e) => this.data.state.kingdoms[kingdomId].config[e.target.name] = parseFloat(e.target.value));
        });

        const nextBtn = clone.querySelector('.next-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.switchSubTab(kingdomId, 'results'));

        const calcBtn = clone.querySelector('.calculate-btn');
        if (calcBtn) calcBtn.addEventListener('click', () => {
            CalculationService.calculateKingdom(kingdomId, this.data.state);
            this.renderResultsTable(kingdomId, this.data.state.kingdoms[kingdomId].calculatedData);
        });

        const exportBtn = clone.querySelector('.export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToCSV(kingdomId));

        const attachSearch = (selector, handler) => {
            const el = clone.querySelector(selector);
            if (el) el.addEventListener('input', Utils.debounce((e) => handler.call(this, kingdomId, e.target.value.toLowerCase().trim()), 300));
        };

        attachSearch('.scatter-search', this.updateScatterHighlight);
        attachSearch('.overview-search', this.filterOverviewTable);
        attachSearch('.efficiency-search', this.updateEfficiencyHighlight);
        attachSearch('.results-search', this.filterResultsTable);

        const logToggle = clone.querySelector('.roster-log-toggle');
        const limitSelect = clone.querySelector('.roster-limit-select');

        if (logToggle && limitSelect) {
            const updateRoster = () => {
                const kState = this.data.state.kingdoms[kingdomId];
                const data = kState.startData.length > 0 ? kState.startData : kState.endData;
                if (data.length > 0) {
                    this.renderRosterAnalysis(kingdomId, data, logToggle.checked, parseInt(limitSelect.value));
                }
            };
            logToggle.addEventListener('change', updateRoster);
            limitSelect.addEventListener('change', updateRoster);
        }

        // Results Table Sort
        clone.querySelectorAll('.dkp-table:not(.governance-table) th').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(kingdomId, th.dataset.sort, false);
            });
        });

        // Governance Table Sort
        clone.querySelectorAll('.governance-table th').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(kingdomId, th.dataset.sort, true);
            });
        });

        this.elements.kingdomsContainer.appendChild(clone);
    }

    handleSort(kingdomId, sortKey, isGovernance) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (kState.lastSortCol === sortKey) kState.sortDirection *= -1;
        else { kState.sortDirection = 1; kState.lastSortCol = sortKey; }

        kState.calculatedData.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            // Handle undefined/null safely
            if (valA === undefined || valA === null) valA = -Infinity;
            if (valB === undefined || valB === null) valB = -Infinity;

            if (valA < valB) return -1 * kState.sortDirection;
            if (valA > valB) return 1 * kState.sortDirection;
            return 0;
        });

        if (isGovernance) this.renderGovernanceTab(kingdomId, kState.calculatedData);
        else this.renderResultsTable(kingdomId, kState.calculatedData);
    }


    renderGovernanceTab(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        const tbody = container.querySelector('.governance-table tbody');
        if (!tbody) return;

        const fragment = document.createDocumentFragment();
        tbody.innerHTML = '';

        // Default Sort if needed, but handled by handleSort usually.
        // If no sort active, sort by Risk (Score Ascending)
        if (!this.data.state.kingdoms[kingdomId].lastSortCol) {
            data.sort((a, b) => (a.governanceScore || 0) - (b.governanceScore || 0));
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            const riskClass = `risk-${(row.riskLevel || 'critical').toLowerCase()}`;

            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td style="font-weight:bold;">${row.governanceScore || 0}</td>
                <td><span class="status-badge ${riskClass}">${row.riskLevel || 'Critical'}</span></td>
                <td>${row.mainContribution || '-'}</td>
                <td>${row.governanceNotes || '-'}</td>
                <td>${row.combatPts || 0}</td>
                <td>${row.supportPts || 0}</td>
            `;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }

    renderResultsTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        if (!container) return;
        // Use :not(.governance-table) to ensure we get the results table
        const tbody = container.querySelector('.dkp-table:not(.governance-table) tbody');
        if (!tbody) return;

        // Ensure results section is visible if data exists
        const resultsSection = container.querySelector('.results-section');
        if (resultsSection) resultsSection.classList.remove('hidden');

        try {
            const fragment = document.createDocumentFragment();
            tbody.innerHTML = '';

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="19" style="text-align:center; padding: 20px;">No matching data found. Check your filters (Top N, TH25) or uploaded files.</td></tr>`;
                return;
            }

            data.forEach(row => {
                const tr = document.createElement('tr');
                const status = row.status || 'Sleeper';
                const statusClass = `status-${status.toLowerCase()}`;

                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td>${row.name}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${(row.startPower || 0).toLocaleString()}</td>
                    <td class="${(row.powerDiff || 0) >= 0 ? 'status-complete' : 'status-incomplete'}">${(row.powerDiff || 0).toLocaleString()}</td>
                    <td class="${(row.troopPowerDiff || 0) >= 0 ? 'status-complete' : 'status-incomplete'}">${(row.troopPowerDiff || 0).toLocaleString()}</td>
                    <td>${(row.t1 || 0).toLocaleString()}</td>
                    <td>${(row.t2 || 0).toLocaleString()}</td>
                    <td>${(row.t3 || 0).toLocaleString()}</td>
                    <td>${(row.t4 || 0).toLocaleString()}</td>
                    <td>${(row.t5 || 0).toLocaleString()}</td>
                    <td>${(row.t4t5 || 0).toLocaleString()}</td>
                    <td>${(row.deads || 0).toLocaleString()}</td>
                    <td>${(row.rssGathered || 0).toLocaleString()}</td>
                    <td>${(row.kvkKP || 0).toLocaleString()}</td>
                    <td>${Math.round(row.targetKP || 0).toLocaleString()}</td>
                    <td class="${(row.kpPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}">${(row.kpPercent || 0)}%</td>
                    <td>${Math.round(row.targetDeads || 0).toLocaleString()}</td>
                    <td class="${(row.deadPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}">${(row.deadPercent || 0)}%</td>
                    <td class="${(row.totalDKPPercent || 0) >= 100 ? 'status-complete' : 'status-incomplete'}"><span class="total-dkp">${(row.totalDKPPercent || 0)}%</span></td>
                    <td><input type="number" class="bonus-input" data-id="${row.id}" value="${row.bonus || 0}" step="1"></td>
                `;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
            this.attachBonusListeners(kingdomId);
        } catch (e) {
            console.error("Render Error:", e);
            tbody.innerHTML = `<tr><td colspan="19" style="color:red">Error rendering table. Check console.</td></tr>`;
        }
    }

    attachBonusListeners(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        container.querySelectorAll('.bonus-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.dataset.id;
                const newBonus = parseFloat(e.target.value) || 0;
                const row = this.data.state.kingdoms[kingdomId].calculatedData.find(r => r.id === id);

                if (row) {
                    row.bonus = newBonus;
                    let baseScore = 0;
                    if (row.targetKP > 0 && row.targetDeads > 0) baseScore = (row.kpPercent + row.deadPercent) / 2;
                    else if (row.targetKP > 0) baseScore = row.kpPercent;
                    else if (row.targetDeads > 0) baseScore = row.deadPercent;

                    row.totalDKPPercent = parseFloat((baseScore + newBonus).toFixed(2));

                    const tr = e.target.closest('tr');
                    const totalCell = tr.querySelector('.total-dkp');
                    const totalTd = totalCell.parentElement;

                    totalCell.textContent = row.totalDKPPercent + '%';
                    totalTd.className = row.totalDKPPercent >= 100 ? 'status-complete' : 'status-incomplete';
                }
            });
        });
    }

    updateOverview(kingdomId) {
        const kState = this.data.state.kingdoms[kingdomId];
        const startFiltered = Utils.getFilteredData(kState.startData, this.data.state.filterTownHall25);
        const endFiltered = Utils.getFilteredData(kState.endData, this.data.state.filterTownHall25);

        if (startFiltered.length > 0 && endFiltered.length > 0) {
            const diffData = CalculationService.calculateOverviewDiff(startFiltered, endFiltered);
            kState.currentOverviewData = diffData;
            this.renderOverviewTable(kingdomId, diffData);
        } else if (startFiltered.length > 0) {
            kState.currentOverviewData = startFiltered;
            this.renderOverviewTable(kingdomId, startFiltered);
        } else {
            kState.currentOverviewData = [];
            this.renderOverviewTable(kingdomId, []);
        }
    }

    renderOverviewTable(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const table = container.querySelector('.overview-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (!data || data.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td>No data available matching filter.</td></tr>';
            return;
        }

        const headers = Object.keys(data[0]).filter(h => h !== '_kingdom' && h !== 'Kingdom');
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        const fragment = document.createDocumentFragment();
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = headers.map(h => `<td>${row[h]}</td>`).join('');
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        this.syncOverviewScroll(kingdomId);
    }

    syncOverviewScroll(kingdomId) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const table = container.querySelector('.overview-table');
        const topScroll = container.querySelector('.top-scroll-wrapper');
        const content = topScroll.querySelector('.top-scroll-content');

        if (table && content) {
            content.style.width = table.offsetWidth + 'px';
            topScroll.onscroll = () => { container.querySelector('.table-container').scrollLeft = topScroll.scrollLeft; };
            container.querySelector('.table-container').onscroll = () => { topScroll.scrollLeft = container.querySelector('.table-container').scrollLeft; };
        }
    }

    updateNPWDDropdown() {
        const select = this.elements.npwdKingdomSelect;
        if (!select) return;
        select.innerHTML = '';
        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });
        if (this.data.state.loadedKingdoms.size > 0 && select.value === '') {
            select.value = Array.from(this.data.state.loadedKingdoms)[0];
            this.renderNewPhoneWhoDis(select.value);
        }
    }

    updatePrekvkDropdown() {
        const select = this.elements.prekvkKingdomSelect;
        if (!select) return;
        select.innerHTML = '';
        Array.from(this.data.state.loadedKingdoms).forEach(kId => {
            const option = document.createElement('option');
            option.value = kId;
            option.textContent = `Kingdom ${kId}`;
            select.appendChild(option);
        });
        if (this.data.state.loadedKingdoms.size > 0 && select.value === '') {
            select.value = Array.from(this.data.state.loadedKingdoms)[0];
            select.dispatchEvent(new Event('change'));
        }
    }

    renderPreKVKRanking() {
        const tbody = document.querySelector('#rankingTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const limitStr = this.elements.rankingGovCountSelect ? this.elements.rankingGovCountSelect.value : '300';
        const limit = limitStr === 'all' ? Infinity : parseInt(limitStr);

        if (this.data.state.loadedKingdoms.size === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No kingdoms loaded. Upload scans to begin.</td></tr>';
            return;
        }

        let rankingData = [];
        this.data.state.loadedKingdoms.forEach(kId => {
            const kState = this.data.state.kingdoms[kId];
            if (!kState.startData || kState.startData.length === 0) return;

            let validGovs = kState.startData.map(r => ({
                power: Utils.parseNumber(r['Power']),
                kp: Utils.parseNumber(r['Kill Points'])
            })).sort((a, b) => b.power - a.power);

            if (limit !== Infinity) validGovs = validGovs.slice(0, limit);

            rankingData.push({
                kingdom: kId,
                power: validGovs.reduce((sum, g) => sum + g.power, 0),
                kp: validGovs.reduce((sum, g) => sum + g.kp, 0)
            });
        });

        if (rankingData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No valid Start Scan data found.</td></tr>';
            return;
        }

        rankingData.sort((a, b) => b.power - a.power);
        rankingData.forEach((d, i) => d.powerRank = i + 1);

        const kpSorted = [...rankingData].sort((a, b) => b.kp - a.kp);
        const kpRankMap = new Map();
        kpSorted.forEach((d, i) => kpRankMap.set(d.kingdom, i + 1));
        rankingData.forEach(d => d.kpRank = kpRankMap.get(d.kingdom));

        const { key, dir } = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
        rankingData.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (key === 'rank') { valA = a.powerRank; valB = b.powerRank; }
            if (key === 'kingdom') { valA = parseInt(a.kingdom); valB = parseInt(b.kingdom); }
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        const headers = document.querySelectorAll('#rankingTable th[data-sort]');
        headers.forEach(th => {
            if (!th.dataset.hasListener) {
                th.addEventListener('click', () => {
                    const sortKey = th.dataset.sort;
                    const currentSort = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
                    if (currentSort.key === sortKey) {
                        currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc';
                    } else {
                        currentSort.key = sortKey;
                        currentSort.dir = 'desc';
                        if (sortKey === 'kingdom' || sortKey === 'rank' || sortKey.includes('Rank')) currentSort.dir = 'asc';
                    }
                    this.data.state.rankingSort = currentSort;
                    this.renderPreKVKRanking();
                });
                th.dataset.hasListener = 'true';
            }
            th.classList.remove('sort-asc', 'sort-desc');
            const currentSort = this.data.state.rankingSort || { key: 'power', dir: 'desc' };
            if (th.dataset.sort === currentSort.key) th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        });

        rankingData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${index + 1}</td><td>${row.kingdom}</td><td>${row.power.toLocaleString()}</td><td>${row.kp.toLocaleString()}</td><td>${row.powerRank}</td><td>${row.kpRank}</td>`;
            tbody.appendChild(tr);
        });
    }

    renderNewPhoneWhoDis(kingdomId) {
        const newContainer = document.getElementById('newArrivalsContainer');
        const departContainer = document.getElementById('departuresContainer');
        if (!newContainer || !departContainer) return;

        if (!kingdomId) {
            newContainer.innerHTML = '<p>Please select a kingdom.</p>';
            departContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }

        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState) return;

        const startIds = new Set(kState.startData.map(r => r['Governor ID']));
        const endIds = new Set(kState.endData.map(r => r['Governor ID']));

        const newArrivals = kState.endData.filter(r => !startIds.has(r['Governor ID']));
        const departures = kState.startData.filter(r => !endIds.has(r['Governor ID']));

        const formatData = (list) => list.map(r => ({
            'Name': r['Governor Name'],
            'ID': r['Governor ID'],
            'Alliance': r['Alliance Tag'],
            'Power': Utils.parseNumber(r['Power'])
        })).sort((a, b) => b.Power - a.Power);

        this.renderAnalysisTable(formatData(newArrivals), newContainer);
        this.renderAnalysisTable(formatData(departures), departContainer);
    }

    renderKingdomAnalysis() {
        const data = [];
        const govCountLimit = this.elements.prekvkGovCountSelect ? this.elements.prekvkGovCountSelect.value : 'all';

        this.data.state.loadedKingdoms.forEach(kId => {
            const kState = this.data.state.kingdoms[kId];
            const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;
            if (!sourceData || sourceData.length === 0) return;

            let processedData = Utils.getFilteredData([...sourceData], this.data.state.filterTownHall25);
            if (govCountLimit !== 'all') {
                const limit = parseInt(govCountLimit);
                processedData.sort((a, b) => Utils.parseNumber(b['Power']) - Utils.parseNumber(a['Power']));
                processedData = processedData.slice(0, limit);
            }

            const totalPower = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Power']), 0);
            const totalDeads = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Deads']), 0);
            const totalT4 = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['T4 Kills']), 0);
            const totalT5 = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['T5 Kills']), 0);
            const totalKP = processedData.reduce((sum, r) => sum + Utils.parseNumber(r['Kill Points']), 0);

            data.push({
                'Kingdom': kId,
                'Gov Count': processedData.length,
                'Total Power': totalPower,
                'Total Deads': totalDeads,
                'Total T4 Kills': totalT4,
                'Total T5 Kills': totalT5,
                'Total KP': totalKP
            });
        });

        data.sort((a, b) => b['Total Power'] - a['Total Power']);
        this.renderAnalysisTable(data, this.elements.kingdomAnalysisContainer);
    }

    renderAllianceAnalysis(kingdomId) {
        if (!kingdomId) {
            if (this.elements.allianceAnalysisContainer) this.elements.allianceAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = this.data.state.kingdoms[kingdomId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!kState || !sourceData || sourceData.length === 0) {
            if (this.elements.allianceAnalysisContainer) this.elements.allianceAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = Utils.getFilteredData(sourceData, this.data.state.filterTownHall25);
        const allianceMap = {};
        filteredData.forEach(row => {
            const tag = row['Alliance Tag'] || 'No Tag';
            if (!allianceMap[tag]) {
                allianceMap[tag] = { 'Alliance': tag, 'Count': 0, 'Power': 0, 'Deads': 0, 'T4 Kills': 0, 'T5 Kills': 0, 'Kill Points': 0 };
            }
            allianceMap[tag]['Count']++;
            allianceMap[tag]['Power'] += Utils.parseNumber(row['Power']);
            allianceMap[tag]['Deads'] += Utils.parseNumber(row['Deads']);
            allianceMap[tag]['T4 Kills'] += Utils.parseNumber(row['T4 Kills']);
            allianceMap[tag]['T5 Kills'] += Utils.parseNumber(row['T5 Kills']);
            allianceMap[tag]['Kill Points'] += Utils.parseNumber(row['Kill Points']);
        });

        const data = Object.values(allianceMap).sort((a, b) => b['Power'] - a['Power']);
        this.renderAnalysisTable(data, this.elements.allianceAnalysisContainer);
    }

    renderGovernorAnalysis(kingdomId) {
        if (!kingdomId) {
            if (this.elements.governorAnalysisContainer) this.elements.governorAnalysisContainer.innerHTML = '<p>Please select a kingdom.</p>';
            return;
        }
        const kState = this.data.state.kingdoms[kingdomId];
        const sourceData = kState.startData.length > 0 ? kState.startData : kState.endData;

        if (!kState || !sourceData || sourceData.length === 0) {
            if (this.elements.governorAnalysisContainer) this.elements.governorAnalysisContainer.innerHTML = '<p>No data available.</p>';
            return;
        }

        const filteredData = Utils.getFilteredData(sourceData, this.data.state.filterTownHall25);
        const sorted = [...filteredData].sort((a, b) => Utils.parseNumber(b['Power']) - Utils.parseNumber(a['Power'])).slice(0, 100);
        const data = sorted.map(row => ({
            'Name': row['Governor Name'],
            'ID': row['Governor ID'],
            'Alliance': row['Alliance Tag'],
            'Power': Utils.parseNumber(row['Power']),
            'Deads': Utils.parseNumber(row['Deads']),
            'T4 Kills': Utils.parseNumber(row['T4 Kills']),
            'T5 Kills': Utils.parseNumber(row['T5 Kills']),
            'Kill Points': Utils.parseNumber(row['Kill Points'])
        }));

        this.renderAnalysisTable(data, this.elements.governorAnalysisContainer);
    }

    renderAnalysisTable(data, container) {
        if (!container) return;
        if (!data || data.length === 0) {
            container.innerHTML = '<p>No data available.</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        const numericHeaders = headers.filter(h => typeof data[0][h] === 'number');
        const maxValues = {};
        numericHeaders.forEach(h => maxValues[h] = Math.max(...data.map(row => row[h])));

        let html = '<table class="prekvk-table"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                let style = '';
                const val = row[h];
                if (numericHeaders.includes(h) && maxValues[h] > 0) {
                    const intensity = (val / maxValues[h]);
                    const alpha = Math.max(0.1, intensity * 0.8);
                    style = `style="background-color: rgba(59, 130, 246, ${alpha}); color: ${intensity > 0.6 ? 'white' : 'var(--text-primary)'}"`;
                }
                html += `<td ${style}>${typeof val === 'number' ? val.toLocaleString() : val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderScatterChart(kingdomId, overviewData) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.scatter-chart').getContext('2d');
        const kState = this.data.state.kingdoms[kingdomId];
        const config = kState.config;

        const getAdjustedKP = (row) => {
            if (row.kvkKP !== undefined) return row.kvkKP;
            const t4 = Utils.parseNumber(row['T4 Kills']);
            const t5 = Utils.parseNumber(row['T5 Kills']);
            return (t4 * config.t4Points) + (t5 * config.t5Points);
        };

        const validRows = overviewData.filter(row => {
            const kp = getAdjustedKP(row);
            const deads = row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads']);
            return kp > 0 || deads > 0;
        });

        if (validRows.length < 2) return;

        const dataMatrix = validRows.map(row => {
            const kp = getAdjustedKP(row);
            if (row.rawKP !== undefined) {
                return [row.powerDiff, row.troopPowerDiff, row.t4, row.t5, row.deads, kp];
            } else {
                return [
                    Utils.parseNumber(row['Power']), Utils.parseNumber(row['Troop Power']),
                    Utils.parseNumber(row['T4 Kills']), Utils.parseNumber(row['T5 Kills']),
                    Utils.parseNumber(row['Deads']), kp
                ];
            }
        });

        const normalizedData = Utils.normalizeData(dataMatrix);
        let vectors;
        try { vectors = PCA.getEigenVectors(normalizedData); } catch (e) { return; }

        let pc1 = vectors[0];
        let pc2 = vectors[1];

        if (pc1.vector[5] < 0) pc1.vector = pc1.vector.map(v => -v);
        if (pc2.vector[4] < 0) pc2.vector = pc2.vector.map(v => -v);

        const projectedData = normalizedData.map(row => ({
            x: Utils.dotProduct(row, pc1.vector),
            y: Utils.dotProduct(row, pc2.vector)
        }));

        const totalKP = validRows.reduce((sum, row) => sum + getAdjustedKP(row), 0);
        const totalDeads = validRows.reduce((sum, row) => sum + (row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads'])), 0);
        const avgKP = validRows.length > 0 ? totalKP / validRows.length : 0;
        const avgDeads = validRows.length > 0 ? totalDeads / validRows.length : 0;

        const points = validRows.map((row, index) => {
            const kp = getAdjustedKP(row);
            const deads = row.deads !== undefined ? row.deads : Utils.parseNumber(row['Deads']);
            const id = row['Governor ID'] || row.id;
            const name = row['Governor Name'] || row.name || 'Unknown';

            let color = '#9ca3af'; // Slacker
            // Logic updated to match Legend
            if (kp >= avgKP) color = '#10b981'; // Warrior/Hero (High KP = Green)
            else if (kp < avgKP && deads >= avgDeads) color = '#ef4444'; // Feeder

            return {
                x: projectedData[index].x,
                y: projectedData[index].y,
                r: 5,
                backgroundColor: color,
                borderColor: 'transparent',
                borderWidth: 0,
                name, id, rawKP: kp, deads
            };
        });

        if (kState.scatterChart) kState.scatterChart.destroy();

        kState.scatterChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Player Clusters',
                    data: points,
                    backgroundColor: points.map(p => p.backgroundColor),
                    borderColor: points.map(p => p.borderColor),
                    borderWidth: points.map(p => p.borderWidth)
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                    tooltip: { callbacks: { label: (context) => `${context.raw.name}(ID: ${context.raw.id}) | T4/T5 KP: ${context.raw.rawKP.toLocaleString()} | Deads: ${context.raw.deads.toLocaleString()}` } }
                },
                scales: {
                    x: { title: { display: true, text: 'Activity Volume (PC1)' } },
                    y: { title: { display: true, text: 'Efficiency (PC2)' } }
                }
            }
        });
    }

    updateScatterHighlight(kingdomId, searchTerm) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState.scatterChart) return;
        const chart = kState.scatterChart;
        const datasets = chart.data.datasets;

        datasets.forEach(dataset => {
            if (!dataset.data[0].originalColor) dataset.data.forEach(p => p.originalColor = p.backgroundColor);
            const newColors = dataset.data.map(p => {
                if (!searchTerm) return p.originalColor;
                const match = p.name.toLowerCase().includes(searchTerm) || p.id.toString().includes(searchTerm);
                return match ? p.originalColor : '#e5e7eb';
            });
            dataset.backgroundColor = newColors;
            dataset.borderColor = newColors;
        });
        chart.update();
    }

    renderPowerEfficiencyChart(kingdomId, data) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const ctx = container.querySelector('.efficiency-chart').getContext('2d');
        const kState = this.data.state.kingdoms[kingdomId];

        const validPoints = data.filter(r => r.startPower > 0 && r.totalDKPPercent > 0);
        if (validPoints.length === 0) return;

        const maxDeads = Math.max(...validPoints.map(p => p.deads));
        const points = validPoints.map(p => {
            let color = '#facc15';
            if (p.totalDKPPercent >= 100) color = '#10b981';
            else if (p.totalDKPPercent < 80) color = '#ef4444';
            const r = maxDeads > 0 ? 3 + (p.deads / maxDeads) * 17 : 5;
            return { x: p.startPower, y: p.totalDKPPercent, r, backgroundColor: color, name: p.name, id: p.id, deads: p.deads };
        });

        if (kState.efficiencyChart) kState.efficiencyChart.destroy();

        kState.efficiencyChart = new Chart(ctx, {
            type: 'bubble',
            data: { datasets: [{ label: 'Player Efficiency', data: points, backgroundColor: points.map(p => p.backgroundColor) }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                    tooltip: { callbacks: { label: (c) => `${c.raw.name} | Power: ${c.raw.x.toLocaleString()} | DKP: ${c.raw.y}%` } },
                    annotation: { annotations: { line1: { type: 'line', yMin: 100, yMax: 100, borderColor: 'rgba(255,255,255,0.5)', borderWidth: 2, borderDash: [6, 6] } } }
                },
                scales: {
                    x: { title: { display: true, text: 'Starting Power' }, ticks: { callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v.toLocaleString() } },
                    y: { title: { display: true, text: 'DKP Score %' }, suggestedMin: 0, suggestedMax: 150 }
                }
            }
        });
    }

    updateEfficiencyHighlight(kingdomId, searchTerm) {
        const kState = this.data.state.kingdoms[kingdomId];
        if (!kState.efficiencyChart) return;
        const chart = kState.efficiencyChart;
        chart.data.datasets.forEach(dataset => {
            if (!dataset.data[0].originalColor) dataset.data.forEach(p => p.originalColor = p.backgroundColor);
            dataset.backgroundColor = dataset.data.map(p => {
                if (!searchTerm) return p.originalColor;
                return (p.name.toLowerCase().includes(searchTerm) || p.id.toString().includes(searchTerm)) ? p.originalColor : '#e5e7eb';
            });
        });
        chart.update();
    }

    renderRosterAnalysis(kingdomId, data, useLogScale = false, limit = 300) {
        const kState = this.data.state.kingdoms[kingdomId];
        const container = document.getElementById(`kingdom-${kingdomId}`);

        const validPlayers = Utils.getFilteredData(data, this.data.state.filterTownHall25).filter(p => Utils.parseNumber(p.Power) > 1000000);

        if (validPlayers.length === 0) return;

        validPlayers.sort((a, b) => Utils.parseNumber(b.Power) - Utils.parseNumber(a.Power));
        const limitedPlayers = limit > 0 ? validPlayers.slice(0, limit) : validPlayers;

        const warriors = [], farmers = [], casuals = [];
        const config = kState.config;

        limitedPlayers.forEach(p => {
            const t4 = Utils.parseNumber(p['T4 Kills']);
            const t5 = Utils.parseNumber(p['T5 Kills']);
            const kp = (t4 * config.t4Points) + (t5 * config.t5Points);

            const power = Utils.parseNumber(p.Power), deads = Utils.parseNumber(p['Deads'] || p['Dead']);
            const gathered = Utils.parseNumber(p['Resources Gathered'] || 0);
            const kpRatio = power > 0 ? kp / power : 0;
            const point = { x: power, y: kp, r: Math.min(Math.max(2, Math.sqrt(deads) / 100), 15), name: p['Governor Name'] || p.Name || 'Unknown', id: p['Governor ID'], deads, gathered, type: 'Unknown' };

            if (kpRatio > 5) { point.type = 'Warrior'; warriors.push(point); }
            else if (kpRatio < 1) { point.type = 'Farmer'; farmers.push(point); }
            else { point.type = 'Casual'; casuals.push(point); }
        });

        const scatterCtx = container.querySelector('.roster-scatter-chart');
        if (scatterCtx) {
            const existingChart = Chart.getChart(scatterCtx);
            if (existingChart) existingChart.destroy();
            else if (kState.rosterScatterChart) kState.rosterScatterChart.destroy();

            kState.rosterScatterChart = new Chart(scatterCtx, {
                type: 'bubble',
                data: {
                    datasets: [
                        { label: 'Warriors (>5 KP/P)', data: warriors, backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: '#ef4444' },
                        { label: 'Casuals (1-5 KP/P)', data: casuals, backgroundColor: 'rgba(250, 204, 21, 0.6)', borderColor: '#facc15' },
                        { label: 'Farmers (<1 KP/P)', data: farmers, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        zoom: { pan: { enabled: true, mode: 'xy' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' } },
                        tooltip: { callbacks: { label: (c) => `${c.raw.name} (${c.raw.type}) | KP: ${c.raw.y.toLocaleString()}` } },
                        title: { display: true, text: `Lifetime KP vs Power (Top ${limit > 0 ? limit : 'All'})` }
                    },
                    scales: {
                        x: { type: useLogScale ? 'logarithmic' : 'linear', title: { display: true, text: 'Power' }, ticks: { callback: v => (v / 1000000).toFixed(1) + 'M' } },
                        y: { type: useLogScale ? 'logarithmic' : 'linear', title: { display: true, text: 'Kill Points' }, ticks: { callback: v => (v / 1000000).toFixed(1) + 'M' } }
                    }
                }
            });
        }

        const insightsEl = container.querySelector('#rosterInsights');
        if (insightsEl) {
            const total = validPlayers.length;
            insightsEl.innerHTML = `<p><strong>Analysis of Top ${total} Governors:</strong></p><ul><li><span style="color:#ef4444">■</span> <strong>Warriors:</strong> ${warriors.length} (${((warriors.length / total) * 100).toFixed(1)}%)</li><li><span style="color:#10b981">■</span> <strong>Farmers:</strong> ${farmers.length} (${((farmers.length / total) * 100).toFixed(1)}%)</li><li><span style="color:#facc15">■</span> <strong>Casuals:</strong> ${casuals.length} (${((casuals.length / total) * 100).toFixed(1)}%)</li></ul>`;
        }
    }

    filterOverviewTable(kingdomId, searchTerm) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const rows = container.querySelector('.overview-table tbody').querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const id = row.cells[0].textContent.toLowerCase();
            row.style.display = (name.includes(searchTerm) || id.includes(searchTerm)) ? '' : 'none';
        });
    }

    filterResultsTable(kingdomId, searchTerm) {
        const container = document.getElementById(`kingdom-${kingdomId}`);
        const rows = container.querySelector('.dkp-table tbody').querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const id = row.cells[0].textContent.toLowerCase();
            row.style.display = (name.includes(searchTerm) || id.includes(searchTerm)) ? '' : 'none';
        });
    }

    exportToCSV(kingdomId) {
        const data = this.data.state.kingdoms[kingdomId].calculatedData;
        if (!data || data.length === 0) return;
        const headers = ['Governor ID', 'Governor Name', 'Kingdom', 'Starting Power', 'Power +/-', 'Troop Power', 'T1 Kills', 'T2 Kills', 'T3 Kills', 'T4 Kills', 'T5 Kills', 'T4+T5 Combined', 'Kvk Deads', 'KVK KP', 'Target KP', 'KP % Complete', 'Target Deads', 'Dead% Complete', 'Total DKP %', 'Bonus/Punishment'];
        const csvContent = [headers.join(','), ...data.map(row => [row.id, `"${row.name}"`, row.kingdom, row.startPower, row.powerDiff, row.troopPowerDiff, row.t1, row.t2, row.t3, row.t4, row.t5, row.t4t5, row.deads, row.kvkKP, row.targetKP, row.kpPercent, row.targetDeads, row.deadPercent, row.totalDKPPercent, row.bonus].join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `dkp_results_kingdom_${kingdomId}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
}

// ==========================================
// 6. MAIN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const dataService = new DataService();
    // Global Access (optional, for debugging)
    window.UnityApp = dataService;

    dataService.loadState();

    const uiService = new UIService(dataService);
    uiService.init();

    // Attach File Upload Logic (Bridge between UI and Data)
    const setupUpload = (inputId, zoneId, type, msg) => {
        const input = document.getElementById(inputId);
        const zone = document.getElementById(zoneId);
        if (!input || !zone) return;

        zone.addEventListener('click', (e) => {
            // Provide a list of interactive elements we want to IGNORE clicks on
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a')) {
                return;
            }
            input.click();
        });

        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files, type, msg);
        });
        input.addEventListener('change', (e) => handleFiles(e.target.files, type, msg));
    };

    const handleFiles = async (fileList, type, successMsg) => {
        if (!fileList || fileList.length === 0) return;
        try {
            const results = await Promise.all(Array.from(fileList).map(file => dataService.parseFile(file)));

            results.forEach(result => {
                const { data, date, kingdoms } = result;
                if (type === 'start') { dataService.state.startScanDate = date; }
                else if (type === 'mid') { dataService.state.midScanDate = date; }
                else { dataService.state.endScanDate = date; }

                uiService.updateScanDetails(type, date, kingdoms);

                kingdoms.forEach(kId => {
                    dataService.initKingdom(kId);
                    const kState = dataService.state.kingdoms[kId];
                    if (type === 'start') kState.startData.push(...data.filter(r => r['_kingdom'] === kId));
                    else if (type === 'mid') kState.midData.push(...data.filter(r => r['_kingdom'] === kId));
                    else kState.endData.push(...data.filter(r => r['_kingdom'] === kId));
                });
            });

            dataService.saveState();
            uiService.renderKingdomTabs();

            dataService.state.loadedKingdoms.forEach(kId => {
                CalculationService.calculateKingdom(kId, dataService.state);
                // Auto-Render Results
                if (dataService.state.kingdoms[kId].calculatedData.length > 0) {
                    uiService.renderResultsTable(kId, dataService.state.kingdoms[kId].calculatedData);
                }
            });
            uiService.renderKingdomComparison();

        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    setupUpload('startScanInput', 'startScanZone', 'start', 'Start Scan Loaded');
    setupUpload('midScanInput', 'midScanZone', 'mid', 'Mid Scan Loaded');
    setupUpload('endScanInput', 'endScanZone', 'end', 'End Scan Loaded');
});
