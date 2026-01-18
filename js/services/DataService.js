// ==========================================
// SERVICE: DATA (STATE & PARSING)
// ==========================================
class DataService {
    constructor() {
        this.storage = new StorageService();
        this.state = {
            kingdoms: {}, // Map<KingdomID, KingdomData>
            loadedKingdoms: new Set(),
            startScanDate: null,
            midScanDate: null,
            endScanDate: null,
            soc: {
                activeSubTab: 'overview',
                zones: {} // Use 'socStart', 'socPass4', etc.
            }
        };
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

    async loadState() {
        try {
            const savedState = await this.storage.getAppState();
            if (savedState) {
                // Restore kingdoms
                this.state.kingdoms = savedState.kingdoms || {};

                // Restore loadedKingdoms (Set)
                if (savedState.loadedKingdoms) {
                    this.state.loadedKingdoms = new Set(savedState.loadedKingdoms);
                }

                // Restore Dates
                this.state.startScanDate = savedState.startScanDate;
                this.state.midScanDate = savedState.midScanDate;
                this.state.endScanDate = savedState.endScanDate;

                // Restore SOC
                if (savedState.soc) {
                    this.state.soc = savedState.soc;
                }
            } else {
                console.log("No saved state found in IndexedDB.");
            }
        } catch (e) {
            console.error('Failed to load state:', e);
            // Fallback to localStorage just for migration? 
            // Or just fail. Let's log.
        }
    }

    async saveState() {
        try {
            // Avoid circular references if charts are stored in state
            const cleanKingdoms = {};
            for (const [kId, kData] of Object.entries(this.state.kingdoms)) {
                cleanKingdoms[kId] = { ...kData, scatterChart: null, efficiencyChart: null, rosterScatterChart: null };
            }

            const stateToSave = {
                kingdoms: cleanKingdoms,
                loadedKingdoms: Array.from(this.state.loadedKingdoms),
                startScanDate: this.state.startScanDate,
                midScanDate: this.state.midScanDate,
                endScanDate: this.state.endScanDate,
                soc: this.state.soc
            };

            await this.storage.saveAppState(stateToSave);
            console.log("State saved to IndexedDB");
        } catch (e) { console.error('Failed to save state:', e); }
    }

    parseFile(file) {
        return new Promise((resolve, reject) => {
            // Handle JSON files directly
            if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        let data = [], date = null, kingdoms = [];

                        if (Array.isArray(json)) {
                            data = json;
                        } else if (json.data && Array.isArray(json.data)) {
                            data = json.data;
                            date = json.date;
                            kingdoms = json.kingdoms || [];
                        } else {
                            reject(new Error('Invalid JSON format. Expected array or {data: []}'));
                            return;
                        }

                        // Normalize Keys using Config.COLUMN_MAPPING
                        const normalize = (str) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, ' ') : '';
                        data = data.map(row => {
                            const newRow = {};
                            Object.keys(row).forEach(key => {
                                const normKey = normalize(key);
                                let mapped = false;
                                for (const [stdKey, variants] of Object.entries(Config.COLUMN_MAPPING)) {
                                    if (variants.includes(normKey)) {
                                        newRow[stdKey] = row[key];
                                        mapped = true;
                                        break;
                                    }
                                }
                                if (!mapped) newRow[key] = row[key]; // Keep original if no map
                            });
                            return newRow;
                        });

                        // Auto-detect kingdoms from data if missing
                        if (kingdoms.length === 0) {
                            const distinctKingdoms = new Set(data.map(r => r['_kingdom']).filter(k => k));
                            if (distinctKingdoms.size > 0) {
                                kingdoms = Array.from(distinctKingdoms);
                            } else {
                                // Fallback if no _kingdom property: Assign default
                                const defaultKingdom = 'Unknown Kingdom';
                                data.forEach(r => r['_kingdom'] = defaultKingdom);
                                kingdoms = [defaultKingdom];
                            }
                        }

                        // [Fix] StatsExport format: Calculate Deads if missing but components exist
                        data.forEach(row => {
                            if (!row['Deads']) {
                                let totalDead = 0;
                                let foundComponents = false;
                                // Check for direct T* Deaths keys (statsExport format uses 'T5 Deaths', 'T4 Deaths' etc)
                                // We need to check the RAW keys because config mapping handles 'Deads' but not 'T4 Deaths' -> 'Deads' (n-to-1)
                                // Actually, we should check normalized keys.
                                ['T1 Deaths', 'T2 Deaths', 'T3 Deaths', 'T4 Deaths', 'T5 Deaths'].forEach(k => {
                                    // Check normalized variations
                                    const val = row[k] || row[k.toLowerCase()] || row[k.replace(' ', '')];
                                    if (val !== undefined) {
                                        totalDead += Utils.parseNumber(val);
                                        foundComponents = true;
                                    }
                                });

                                if (foundComponents) {
                                    row['Deads'] = totalDead;
                                }
                            }
                        });

                        resolve({ data, date, kingdoms });
                    } catch (err) { reject(err); }
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsText(file);
                return;
            }

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
                                if (hasData && rowObj['Governor ID']) {
                                    rowObj['_kingdom'] = rowObj['Kingdom'] || sheetName;
                                    allData.push(rowObj);
                                }
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
