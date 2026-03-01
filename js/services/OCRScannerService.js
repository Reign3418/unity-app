class OCRScannerService {
    constructor() {
        this.container = document.querySelector('[data-content="upload-screenshots"]');

        this.dropZone = document.getElementById('ocrDragZone');
        this.fileInput = document.getElementById('ocrScanInput');
        this.previewTable = document.getElementById('ocrPreviewBody');
        this.statusBadge = document.getElementById('ocrStatusBadge');
        this.commitBtn = document.getElementById('ocrCommitBtn');
        this.stagingArea = document.getElementById('ocrResultsStaging');

        // Gemini API key — MUST be set via Settings tab (stored in localStorage).
        // Never hardcode keys in source files; GitHub secret scanning will reject the push.
        this.apiKey = localStorage.getItem('geminiApiKey') || '';
        this.apiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';

        // Single aggregated profile for the current batch of screenshots
        this.aggregatedData = null;
        this.aggregatedRow = null;

        // Tab switching runs immediately
        this.initTabSwitching();

        // Dropzone listeners only attached if elements exist
        if (this.dropZone && this.fileInput) {
            this.initDropzoneListeners();
        }

        this.updateStatusBadge();
    }

    // ----------------------------------------------------------------
    //  Status badge
    // ----------------------------------------------------------------
    updateStatusBadge() {
        if (!this.statusBadge) return;
        if (this.apiKey) {
            this.statusBadge.textContent = 'Gemini AI Ready 🟢';
            this.statusBadge.style.color = '#10B981';
        } else {
            this.statusBadge.textContent = 'No API Key ⚠️';
            this.statusBadge.style.color = 'var(--warning, #F59E0B)';
        }
    }

    // ----------------------------------------------------------------
    //  Tab switching
    // ----------------------------------------------------------------
    initTabSwitching() {
        const subTabs = document.querySelectorAll('.upload-tab-btn');
        subTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.subtab;

                subTabs.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                document.querySelectorAll('.upload-tab-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.dataset.content === targetId) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    // ----------------------------------------------------------------
    //  Dropzone listeners
    // ----------------------------------------------------------------
    initDropzoneListeners() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.15)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.05)';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(139, 92, 246, 0.05)';
            if (e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files);
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleFiles(e.target.files);
        });

        if (this.commitBtn) {
            this.commitBtn.addEventListener('click', async () => {
                if (!this.aggregatedData || !this.aggregatedData.name) {
                    alert('No valid profile name found to commit.');
                    return;
                }

                const kingdomSelect = document.getElementById('ocrKingdomSelect');
                const kingdomId = kingdomSelect ? kingdomSelect.value : null;

                if (!kingdomId) {
                    alert('Please select a Kingdom to upload this data to.');
                    return;
                }

                if (!window.uiMyAlliance || !window.uiMyAlliance.rosterService || !window.uiMyAlliance.rosterService.connected) {
                    alert('Not connected to Firebase. Please configure the database URL in Settings and refresh.');
                    return;
                }

                // Construct a player object
                const p = {
                    id: this.aggregatedData.id || `UNKNOWN_${Date.now()}`,
                    name: this.aggregatedData.name,
                    power: this.aggregatedData.power || 0,
                    killPoints: this.aggregatedData.killPoints || 0,
                    dead: this.aggregatedData.dead || 0,
                    alliance: this.aggregatedData.alliance || '',
                    t1Kills: this.aggregatedData.t1Kills || 0,
                    t2Kills: this.aggregatedData.t2Kills || 0,
                    t3Kills: this.aggregatedData.t3Kills || 0,
                    t4Kills: this.aggregatedData.t4Kills || 0,
                    t5Kills: this.aggregatedData.t5Kills || 0,
                    helps: this.aggregatedData.helps || 0,
                    rssGathered: this.aggregatedData.rssGathered || 0,
                    rssAssistance: this.aggregatedData.rssAssistance || 0,
                    troopPower: this.aggregatedData.troopPower || 0,
                    techPower: this.aggregatedData.techPower || 0,
                    buildingPower: this.aggregatedData.buildingPower || 0,
                    commanderPower: this.aggregatedData.commanderPower || 0,
                    acclaim: this.aggregatedData.acclaim || 0,
                    autarch: this.aggregatedData.autarch || 0,
                    status: 'Active'
                };

                this.commitBtn.textContent = '⏳ Uploading...';
                this.commitBtn.style.opacity = '0.7';

                try {
                    await window.uiMyAlliance.rosterService.pushPlayerScan(kingdomId, p);

                    // Visual Success state
                    this.commitBtn.textContent = '☁️ Published to Cloud!';
                    this.commitBtn.style.background = 'var(--success-color)';
                    this.commitBtn.style.opacity = '1';

                    setTimeout(() => {
                        this.commitBtn.textContent = '☁️ Upload to Cloud';
                        this.commitBtn.style.background = 'var(--accent-primary)';
                        this.stagingArea.style.display = 'none';
                        this.aggregatedData = null;
                    }, 2500);
                } catch (e) {
                    alert('Failed to push to Cloud Roster: ' + e.message);
                    this.commitBtn.textContent = '❌ Failed';
                    setTimeout(() => {
                        this.commitBtn.textContent = '☁️ Upload to Cloud';
                        this.commitBtn.style.opacity = '1';
                    }, 2000);
                }
            });
        }
    }

    // ----------------------------------------------------------------
    //  File handling — aggregation across multiple screenshots
    // ----------------------------------------------------------------
    async handleFiles(files) {
        if (!this.apiKey) {
            alert('Please enter your Gemini API key in Settings before scanning screenshots.');
            return;
        }

        if (this.stagingArea) this.stagingArea.style.display = 'block';

        // Reset aggregated profile for a new batch
        this.aggregatedData = {
            id: null, name: null, alliance: null, power: null, killPoints: null, dead: null,
            t1Kills: null, t2Kills: null, t3Kills: null, t4Kills: null, t5Kills: null,
            helps: null, rssGathered: null, rssAssistance: null, troopPower: null,
            techPower: null, buildingPower: null, commanderPower: null, acclaim: null, autarch: null,
            images: [],
            rawResponses: []
        };

        // Clear preview table and create the single master row
        if (this.previewTable) this.previewTable.innerHTML = '';
        this.aggregatedRow = document.createElement('tr');
        this.previewTable.appendChild(this.aggregatedRow);
        this.updateAggregatedRow(true);

        // Process all dropped images sequentially
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            await this.processImage(file);
        }

        // All images done — show final state
        this.updateAggregatedRow(false);

        // Enable commit button if we have at least some data
        const d = this.aggregatedData;
        if (this.commitBtn && (d.name || d.power || d.killPoints || d.dead)) {
            this.commitBtn.style.opacity = '1';
            this.commitBtn.style.cursor = 'pointer';
        }
    }

    async processImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;

                // Add thumbnail immediately
                this.aggregatedData.images.push(dataUrl);
                this.updateAggregatedRow(true);

                try {
                    const extracted = await this.callGeminiVision(dataUrl, file.type);
                    console.log('Gemini extracted:', extracted);

                    const d = this.aggregatedData;

                    // Merge — first non-null wins for text fields
                    if (extracted.id && !d.id) d.id = String(extracted.id);
                    if (extracted.name && !d.name) d.name = extracted.name;
                    if (extracted.alliance && !d.alliance) d.alliance = extracted.alliance;

                    // For numbers, take the largest valid number out of all the scanned images in the sequence
                    const numKeys = ['power', 'killPoints', 'dead', 't1Kills', 't2Kills', 't3Kills', 't4Kills', 't5Kills', 'helps', 'rssGathered', 'rssAssistance', 'troopPower', 'techPower', 'buildingPower', 'commanderPower', 'acclaim', 'autarch'];
                    for (const key of numKeys) {
                        if (extracted[key] > 0) d[key] = Math.max(d[key] || 0, extracted[key]);
                    }

                    d.rawResponses.push(JSON.stringify(extracted, null, 2));
                    this.updateAggregatedRow(true);

                } catch (err) {
                    console.error('Gemini OCR error:', err);
                    this.aggregatedData.rawResponses.push('ERROR: ' + err.message);
                }

                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    // ----------------------------------------------------------------
    //  Gemini Vision API call
    // ----------------------------------------------------------------
    async callGeminiVision(dataUrl, mimeType = 'image/jpeg') {
        // Strip the data:image/xxx;base64, prefix
        const base64 = dataUrl.split(',')[1];
        const safeMime = mimeType || 'image/jpeg';

        const prompt = `This is a Rise of Kingdoms mobile game screenshot. 
Extract the following governor stats. Use null if a metric is missing or not visible. Keep all numbers as plain integers, avoiding commas or K/M formatting (e.g. 1.2M -> 1200000, 500K -> 500000).

1. id (governor ID number — look for text like 'ID: 12345678' or '(ID: 12345678)' or 'Governor ID')
2. name (the governor's player username, NOT 'Governor', NOT a civilization name like China/Korea/France)
3. power (total power as a plain integer, usually labeled 'Highest Power' or 'Power' — a number over 1 million)
4. killPoints (kill points as a plain integer, usually labeled 'Kill Points', 'Total Score', or 'KP')
5. dead (dead troops count as a plain integer, usually labeled 'Dead')
6. alliance (the spelled out alliance tag inside brackets, e.g. '[ABCD]')
7. t1Kills (Tier 1 Kills. Look at the 'Kill Statistics' popup. There is a list of 5 rows with gold icons. Extract the FIRST number from the FIRST row. IGNORE the second number (Kill Points) in that row.)
8. t2Kills (Tier 2 Kills. Extract the FIRST number from the SECOND row in that list.)
9. t3Kills (Tier 3 Kills. Extract the FIRST number from the THIRD row in that list.)
10. t4Kills (Tier 4 Kills. Extract the FIRST number from the FOURTH row in that list.)
11. t5Kills (Tier 5 Kills. Extract the FIRST number from the FIFTH row in that list. This is usually 0.)
12. helps (Alliance Help Times, a number)
13. rssGathered (Resources Gathered, a number)
14. rssAssistance (Resource Assistance, a number)
15. troopPower (Troop Power, a number)
16. techPower (Technology Power, a number)
17. buildingPower (Building Power, a number)
18. commanderPower (Commander Power, a number)
19. acclaim (Acclaim points if visible, a number)
20. autarch (Autarch points/wins if visible, maybe near Ark of Osiris, a number)

Respond ONLY with a valid JSON object matching this structure identically:
{
  "id": null,
  "name": null,
  "power": 0,
  "killPoints": 0,
  "dead": 0,
  "alliance": null,
  "t1Kills": 0,
  "t2Kills": 0,
  "t3Kills": 0,
  "t4Kills": 0,
  "t5Kills": 0,
  "helps": 0,
  "rssGathered": 0,
  "rssAssistance": 0,
  "troopPower": 0,
  "techPower": 0,
  "buildingPower": 0,
  "commanderPower": 0,
  "acclaim": 0,
  "autarch": 0
}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.apiModel}:generateContent`;

        const response = await fetch(`${apiUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: safeMime, data: base64 } }
                    ]
                }],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: 'application/json',
                    maxOutputTokens: 1024
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${errText}`);
        }

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // Strip any accidental markdown code fences Gemini might add, and isolate the JSON block
        let cleaned = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            console.warn('Gemini returned non-JSON:', rawText);
            parsed = {};
        }

        // Coerce numbers and strip commas
        const toInt = v => {
            if (v === null || v === undefined) return 0;
            const n = parseInt(String(v).replace(/,/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };

        return {
            id: parsed.id ? String(parsed.id).trim() : null,
            name: parsed.name ? String(parsed.name).trim() : null,
            power: toInt(parsed.power),
            killPoints: toInt(parsed.killPoints),
            dead: toInt(parsed.dead),
            alliance: parsed.alliance ? String(parsed.alliance).trim() : null,
            t1Kills: toInt(parsed.t1Kills),
            t2Kills: toInt(parsed.t2Kills),
            t3Kills: toInt(parsed.t3Kills),
            t4Kills: toInt(parsed.t4Kills),
            t5Kills: toInt(parsed.t5Kills),
            helps: toInt(parsed.helps),
            rssGathered: toInt(parsed.rssGathered),
            rssAssistance: toInt(parsed.rssAssistance),
            troopPower: toInt(parsed.troopPower),
            techPower: toInt(parsed.techPower),
            buildingPower: toInt(parsed.buildingPower),
            commanderPower: toInt(parsed.commanderPower),
            acclaim: toInt(parsed.acclaim),
            autarch: toInt(parsed.autarch)
        };
    }

    // ----------------------------------------------------------------
    //  Row rendering
    // ----------------------------------------------------------------
    showRawModal(rawText) {
        const old = document.getElementById('ocrRawModal');
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'ocrRawModal';
        modal.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999;
            display:flex; align-items:center; justify-content:center; padding:20px;
        `;
        modal.innerHTML = `
            <div style="background:var(--bg-secondary,#1a1a2e); border:1px solid var(--border-color,#333);
                        border-radius:12px; width:600px; max-width:95vw; max-height:80vh;
                        display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:16px 20px; border-bottom:1px solid var(--border-color,#333);
                            display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--accent-primary,#8b5cf6);">Gemini Response</strong>
                    <button onclick="document.getElementById('ocrRawModal').remove()"
                        style="background:none;border:none;color:var(--text-secondary,#aaa);
                               font-size:1.4rem;cursor:pointer;line-height:1;">&times;</button>
                </div>
                <pre style="margin:0; padding:16px 20px; overflow-y:auto; flex:1;
                            font-size:0.8rem; line-height:1.6; white-space:pre-wrap;
                            color:var(--text-primary,#eee); font-family:monospace;
                            max-height:calc(80vh - 60px);">${rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </div>
        `;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    updateAggregatedRow(isLoading) {
        if (!this.aggregatedRow) return;

        const d = this.aggregatedData;
        const hasData = d.name || d.power || d.killPoints || d.dead;

        let badge = '';
        if (isLoading) {
            badge = `<span style="color:var(--accent-primary)">⏳ Scanning...</span>`;
        } else {
            badge = hasData
                ? `<span style="color:#10B981">✅ Complete</span>`
                : `<span style="color:var(--text-muted)">⚠️ Empty</span>`;
        }

        const thumbs = d.images.map(img =>
            `<img src="${img}" style="max-height:40px; border-radius:4px; border:1px solid #444;">`
        ).join('');

        const combinedRaw = d.rawResponses.map((r, i) => `--- IMAGE ${i + 1} ---\n${r}`).join('\n\n');

        this.aggregatedRow.innerHTML = `
            <td style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; max-width:200px;">
                ${thumbs || '<em>Loading...</em>'}
                <div style="width:100%; margin-top:4px; font-size:0.75rem;">${badge}</div>
            </td>
            <td>${d.id || 'Pending'}</td>
            <td style="font-weight:bold; color:var(--text-primary);">${d.name || 'Unknown'}</td>
            <td>${d.alliance || '-'}</td>
            <td>${d.power ? d.power.toLocaleString() : '-'}</td>
            <td>${d.killPoints ? d.killPoints.toLocaleString() : '-'}</td>
            <td>${d.dead ? d.dead.toLocaleString() : '-'}</td>
            <td style="display:flex;gap:6px;">
                <button class="icon-btn" style="color:var(--danger);"
                    onclick="this.closest('tr').remove()">🗑️</button>
                <button class="icon-btn" title="Show Gemini JSON responses"
                    style="font-size:0.75rem; padding:2px 8px; opacity:0.7;"
                    onclick="window.ocrService.showRawModal(this.closest('tr')._rawOCR || 'N/A')">📋 Raw</button>
            </td>
        `;

        // Re-attach raw data after innerHTML wipe
        this.aggregatedRow._rawOCR = combinedRaw;
    }
}

window.OCRScannerService = OCRScannerService;
