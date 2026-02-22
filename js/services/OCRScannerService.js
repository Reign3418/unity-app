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
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

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
            id: null,
            name: null,
            power: null,
            killPoints: null,
            dead: null,
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

                    // Merge — first non-null wins, except numbers where we take the largest
                    if (extracted.id && !d.id) d.id = String(extracted.id);
                    if (extracted.name && !d.name) d.name = extracted.name;

                    if (extracted.power > 0) d.power = Math.max(d.power || 0, extracted.power);
                    if (extracted.killPoints > 0) d.killPoints = Math.max(d.killPoints || 0, extracted.killPoints);
                    if (extracted.dead > 0) d.dead = Math.max(d.dead || 0, extracted.dead);

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
Extract the following governor stats and return ONLY a valid JSON object with these exact keys (use null if not found):
{
  "id": "governor ID number — look for text like 'ID: 12345678' or '(ID: 12345678)' or 'Governor ID'",
  "name": "the governor's player username (NOT 'Governor', NOT a civilization name like China/Korea/France)",
  "power": <total power as a plain integer, usually labeled 'Highest Power' or 'Power' — a number over 1 million>,
  "killPoints": <kill points as a plain integer, usually labeled 'Kill Points', 'Total Score', or 'KP'>,
  "dead": <dead troops count as a plain integer, usually labeled 'Dead'>
}
Return ONLY the raw JSON. No markdown, no explanation, no code fences.`;

        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
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
                    maxOutputTokens: 256
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${errText}`);
        }

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // Strip any accidental markdown code fences Gemini might add
        const cleaned = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();

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
            dead: toInt(parsed.dead)
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
