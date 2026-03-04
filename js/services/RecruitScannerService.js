class RecruitScannerService {
    constructor() {
        this.dropZone = document.getElementById('recruitingDragZone');
        this.fileInput = document.getElementById('recruitingScanInput');
        this.loadingContainer = document.getElementById('recruitLoadingContainer');
        this.resultsContainer = document.getElementById('recruitResultsContainer');

        this.commitBtn = document.getElementById('recruitCommitBtn');

        // Settings / State
        this.apiKey = localStorage.getItem('geminiApiKey') || '';
        this.apiModel = localStorage.getItem('geminiApiModel') || 'gemini-2.5-flash';

        this.applicantData = this.getEmptyApplicant();

        if (this.dropZone && this.fileInput) {
            this.initListeners();
        }
    }

    getEmptyApplicant() {
        return {
            name: null, power: 0, killPoints: 0, dead: 0,
            t1Kills: 0, t2Kills: 0, t3Kills: 0, t4Kills: 0, t5Kills: 0,
            gearScoreValue: 0, armamentScoreValue: 0,
            images: [],
            rawResponses: []
        };
    }

    initListeners() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(236, 72, 153, 0.15)';
            this.dropZone.style.borderColor = 'var(--accent-primary)';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.background = 'rgba(236, 72, 153, 0.05)';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.background = 'rgba(236, 72, 153, 0.05)';
            if (e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files);
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleFiles(e.target.files);
        });

        if (this.commitBtn) {
            this.commitBtn.addEventListener('click', () => this.commitToDatabase());
        }

        const mailBtn = document.getElementById('recruitMailBtn');
        if (mailBtn) {
            mailBtn.addEventListener('click', () => this.exportToMailGenerator());
        }

        const fetchBtn = document.getElementById('fetchRecruitsBtn');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', () => this.fetchPastRecruits());
        }
    }

    async handleFiles(files) {
        if (!this.apiKey) {
            alert('Please enter your Gemini API key in Settings before scanning screenshots.');
            return;
        }

        this.loadingContainer.style.display = 'block';
        this.resultsContainer.style.display = 'none';
        this.applicantData = this.getEmptyApplicant();

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            await this.processImage(file);
        }

        this.loadingContainer.style.display = 'none';
        this.evaluateApplicant();
    }

    async processImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                this.applicantData.images.push(dataUrl);

                try {
                    const extracted = await this.callGeminiVision(dataUrl, file.type);
                    console.log('Gemini Extracted Applicant:', extracted);

                    const d = this.applicantData;

                    if (extracted.name && !d.name) d.name = extracted.name;

                    const numKeys = ['power', 'killPoints', 'dead', 't1Kills', 't2Kills', 't3Kills', 't4Kills', 't5Kills', 'gearScoreValue', 'armamentScoreValue'];
                    for (const key of numKeys) {
                        if (extracted[key] > 0) d[key] = Math.max(d[key] || 0, extracted[key]);
                    }

                    d.rawResponses.push(JSON.stringify(extracted, null, 2));
                } catch (err) {
                    console.error('Gemini OCR error:', err);
                    this.applicantData.rawResponses.push('ERROR: ' + err.message);
                }
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    async callGeminiVision(dataUrl, mimeType = 'image/jpeg') {
        const base64 = dataUrl.split(',')[1];
        const safeMime = mimeType || 'image/jpeg';

        const prompt = `This is a set of screenshots for a Rise of Kingdoms recruitment application.
Extract the following stats. Use null if missing. Keep all numbers as plain integers without commas (1.2M -> 1200000).

1. name: (Governor Username)
2. power: (Highest Power or Power)
3. killPoints: (Total Score or Kill Points)
4. dead: (Dead troops count)
5. t1Kills: (Tier 1 Kills from the 5-row list)
6. t2Kills: (Tier 2 Kills)
7. t3Kills: (Tier 3 Kills)
8. t4Kills: (Tier 4 Kills)
9. t5Kills: (Tier 5 Kills)
10. gearScoreValue: (Assess the main march gear. Scale 1-5. Give 5 if 6-8 legendary pieces with good refines. Give 1 if mostly epic/blue.)
11. armamentScoreValue: (Assess the armaments. Scale 1-5 based on visible Health/Defense/Attack stats.)

Respond ONLY with valid JSON:
{
  "name": null, "power": 0, "killPoints": 0, "dead": 0,
  "t1Kills": 0, "t2Kills": 0, "t3Kills": 0, "t4Kills": 0, "t5Kills": 0,
  "gearScoreValue": 0, "armamentScoreValue": 0
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
                generationConfig: { temperature: 0, responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) throw new Error(`Gemini failed: ${await response.text()}`);

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        let cleaned = rawText.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        let parsed = JSON.parse(cleaned || "{}");
        const toInt = v => {
            if (!v) return 0;
            const n = parseInt(String(v).replace(/,/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };

        return {
            name: parsed.name ? String(parsed.name).trim() : null,
            power: toInt(parsed.power),
            killPoints: toInt(parsed.killPoints),
            dead: toInt(parsed.dead),
            t1Kills: toInt(parsed.t1Kills),
            t2Kills: toInt(parsed.t2Kills),
            t3Kills: toInt(parsed.t3Kills),
            t4Kills: toInt(parsed.t4Kills),
            t5Kills: toInt(parsed.t5Kills),
            gearScoreValue: toInt(parsed.gearScoreValue),
            armamentScoreValue: toInt(parsed.armamentScoreValue)
        };
    }

    evaluateApplicant() {
        const d = this.applicantData;
        this.resultsContainer.style.display = 'block';

        // Update UI raw stats
        document.getElementById('rec-val-name').textContent = d.name || 'Unknown';
        document.getElementById('rec-val-power').textContent = d.power ? d.power.toLocaleString() : '0';
        document.getElementById('rec-val-kp').textContent = d.killPoints ? d.killPoints.toLocaleString() : '0';
        document.getElementById('rec-val-dead').textContent = d.dead ? d.dead.toLocaleString() : '0';

        const totalKills = d.t1Kills + d.t2Kills + d.t3Kills + d.t4Kills + d.t5Kills;
        const t45 = totalKills > 0 ? ((d.t4Kills + d.t5Kills) / totalKills * 100).toFixed(1) + '%' : '0%';
        const t123 = totalKills > 0 ? ((d.t1Kills + d.t2Kills + d.t3Kills) / totalKills * 100).toFixed(1) + '%' : '0%';

        document.getElementById('rec-val-t45').textContent = t45;
        document.getElementById('rec-val-t123').textContent = t123;

        // Render Thumbnails
        const thumbContainer = document.getElementById('recruitThumbnails');
        thumbContainer.innerHTML = d.images.map(img => `<img src="${img}" style="max-height: 40px; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="window.open('${img}', '_blank')">`).join('');

        // Apply 2426 v3.0 logic
        let totalScore = 0;
        let isAutoDecline = false;
        let rejectReasons = [];

        const scoresHtml = [];

        // 1. KP Ratio (Target 12:1 = 5pts, <6:1 = Auto Fail)
        const kpRatio = d.power > 0 ? (d.killPoints / d.power) : 0;
        let kpScore = 0;
        if (kpRatio >= 12) kpScore = 5;
        else if (kpRatio >= 10) kpScore = 4;
        else if (kpRatio >= 8) kpScore = 3;
        else if (kpRatio >= 6) kpScore = 2;
        else if (kpRatio > 0) { kpScore = 1; isAutoDecline = true; rejectReasons.push("KP Ratio below 6:1"); }
        totalScore += kpScore;
        scoresHtml.push(`<tr><td>KP:Power Ratio (${kpRatio.toFixed(1)}:1)</td><td style="text-align: center;">${kpScore}/5</td><td style="color: ${kpScore < 3 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${kpScore === 5 ? 'Excellent' : kpRatio < 6 ? 'Auto-decline threshold' : 'Average'}</td></tr>`);

        // 2. Dead Contribution (Target scale based on power)
        // Simplified target: 50% troop power as deaths
        const expectedDeads = Math.floor(d.power * 0.4); // Rough approximation of 50% troop power
        const deathRatio = expectedDeads > 0 ? (d.dead / expectedDeads) : 0;
        let deathScore = 0;
        if (deathRatio >= 1.2) deathScore = 5;
        else if (deathRatio >= 1.0) deathScore = 4;
        else if (deathRatio >= 0.8) deathScore = 3;
        else if (deathRatio >= 0.6) deathScore = 2;
        else if (deathRatio > 0) { deathScore = 1; isAutoDecline = true; rejectReasons.push("Deaths below 60% requirement"); }
        totalScore += deathScore;
        scoresHtml.push(`<tr><td>Dead Contribution</td><td style="text-align: center;">${deathScore}/5</td><td style="color: ${deathScore < 3 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${(deathRatio * 100).toFixed(0)}% of target</td></tr>`);

        // 3. Troop Quality (T4/T5 %)
        const highTierPct = totalKills > 0 ? (d.t4Kills + d.t5Kills) / totalKills : 0;
        let troopScore = 0;
        if (highTierPct >= 0.65) troopScore = 5;
        else if (highTierPct >= 0.55) troopScore = 4;
        else if (highTierPct >= 0.45) troopScore = 3;
        else if (highTierPct >= 0.35) troopScore = 2;
        else if (totalKills > 0) troopScore = 1;
        totalScore += troopScore;
        scoresHtml.push(`<tr><td>Troop Quality</td><td style="text-align: center;">${troopScore}/5</td><td style="color: ${troopScore < 3 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${(highTierPct * 100).toFixed(0)}% T4/T5 core</td></tr>`);

        // 4. Troop Burden (Low tier penalty)
        const lowTierPct = totalKills > 0 ? (d.t1Kills + d.t2Kills + d.t3Kills) / totalKills : 0;
        let burdenScore = 0;
        if (lowTierPct <= 0.35) burdenScore = 5;
        else if (lowTierPct <= 0.45) burdenScore = 4;
        else if (lowTierPct <= 0.55) burdenScore = 3;
        else if (lowTierPct <= 0.70) burdenScore = 2;
        else { burdenScore = 1; if (kpRatio < 6) { isAutoDecline = true; rejectReasons.push("High low-tier troops with poor KP ratio"); } }
        totalScore += burdenScore;
        scoresHtml.push(`<tr><td>Troop Burden (Seed Impact)</td><td style="text-align: center;">${burdenScore}/5</td><td style="color: ${burdenScore < 3 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${(lowTierPct * 100).toFixed(0)}% Padding</td></tr>`);

        // 5. Combat Efficiency (CVP)
        // Advanced calculation simplified for proof of concept
        let cvpScore = Math.min(5, Math.ceil(kpRatio / 3));
        totalScore += Math.max(1, cvpScore);
        scoresHtml.push(`<tr><td>Combat Efficiency</td><td style="text-align: center;">${cvpScore}/5</td><td style="color: var(--text-secondary)">Estimated value efficiency</td></tr>`);

        // 6. Gear Score (Provided by AI)
        const gearScore = d.gearScoreValue || 1;
        totalScore += gearScore;
        if (gearScore <= 2 && kpRatio < 8) { isAutoDecline = true; rejectReasons.push("Poor gear paired with mediocre KP"); }
        scoresHtml.push(`<tr><td>Gear Score</td><td style="text-align: center;">${gearScore}/5</td><td style="color: ${gearScore < 3 ? 'var(--warning-color)' : 'var(--text-secondary)'}">Based on AI visual scan</td></tr>`);

        // 7. Armament Score (Provided by AI)
        const armamentScore = d.armamentScoreValue || 1;
        totalScore += armamentScore;
        scoresHtml.push(`<tr><td>Armament Score</td><td style="text-align: center;">${armamentScore}/5</td><td style="color: var(--text-secondary)">Based on AI visual scan</td></tr>`);

        // Write breakdown
        document.getElementById('recruitTotalScore').textContent = `${totalScore} / 35`;
        document.getElementById('recruitScoresBody').innerHTML = scoresHtml.join('');

        // Final Verdict Logic
        const verdictBadge = document.getElementById('recruitFinalVerdict');
        if (isAutoDecline || totalScore <= 21) {
            verdictBadge.textContent = '❌ DECLINE';
            verdictBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            verdictBadge.style.color = '#ef4444';
            verdictBadge.title = rejectReasons.join(', ') || "Failed to meet minimum 21 point threshold.";
        } else if (totalScore >= 26) {
            verdictBadge.textContent = '✅ ACCEPT (S/A-Tier)';
            verdictBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            verdictBadge.style.color = '#10b981';
        } else {
            verdictBadge.textContent = '⚠️ CONDITIONAL (B-Tier)';
            verdictBadge.style.background = 'rgba(245, 158, 11, 0.2)';
            verdictBadge.style.color = '#f59e0b';
        }
    }

    async commitToDatabase() {
        const d = this.applicantData;
        if (!d.name) {
            alert('Cannot commit: Applicant name is missing. Please ensure the AI successfully extracted the name.');
            return;
        }

        const recruitUrl = localStorage.getItem('__unity_recruit_firebase_url') || 'https://recruitingroster-default-rtdb.firebaseio.com/';

        if (!recruitUrl) {
            alert('No Recruiting Database URL found. Set one in the Settings tab.');
            return;
        }

        this.commitBtn.disabled = true;
        this.commitBtn.textContent = 'Saving...';

        try {
            // Dynamically initialize the isolated database
            let recruitApp;
            try {
                recruitApp = firebase.app('RecruitingApp');
            } catch (e) {
                recruitApp = firebase.initializeApp({ databaseURL: recruitUrl }, 'RecruitingApp');
            }

            const db = recruitApp.database();

            // Generate a clean ID key
            const applicantKey = d.name.replace(/[\.\#\$\/\[\]]/g, '_');
            const timestamp = new Date().toISOString();

            const payload = {
                Name: d.name,
                Power: d.power || 0,
                KillPoints: d.killPoints || 0,
                Deads: d.dead || 0,
                Summary: document.getElementById('recruitFinalVerdict').textContent,
                Score: document.getElementById('recruitTotalScore').textContent,
                LastScanned: timestamp,
                Details: {
                    T1Kills: d.t1Kills || 0,
                    T2Kills: d.t2Kills || 0,
                    T3Kills: d.t3Kills || 0,
                    T4Kills: d.t4Kills || 0,
                    T5Kills: d.t5Kills || 0,
                    GearScore: d.gearScoreValue || 0,
                    ArmamentScore: d.armamentScoreValue || 0
                }
            };

            await db.ref('recruits/' + applicantKey).set(payload);

            this.commitBtn.style.background = '#10b981';
            this.commitBtn.textContent = '✅ Saved';

            setTimeout(() => {
                this.commitBtn.disabled = false;
                this.commitBtn.style.background = 'var(--accent-primary)';
                this.commitBtn.textContent = '☁️ Commit to Database';
            }, 2000);

        } catch (error) {
            console.error('Error committing recruit data to Firebase:', error);
            alert('Failed to save data. Check console.');
            this.commitBtn.disabled = false;
            this.commitBtn.textContent = '☁️ Commit to Database';
        }
    }

    exportToMailGenerator() {
        const d = this.applicantData;
        if (!d.name) {
            alert('No applicant data to export.');
            return;
        }

        const verdict = document.getElementById('recruitFinalVerdict').textContent;
        const score = document.getElementById('recruitTotalScore').textContent;
        const isAccepted = verdict.includes('ACCEPT');

        const titleText = isAccepted ? `<color=#10b981>Application Accepted</color>` : `<color=#ef4444>Application Denied</color>`;

        let bbCode = `<b><size=12>Kingdom Recruitment Council</size></b>
---------------------------------
Governor: <b>${d.name}</b>
${titleText}
---------------------------------
<b>Review Summary:</b>
We have finished reviewing your application via the 2426 v3.0 logic.
Your final assessment score was: <b><color=#3b82f6>${score}</color></b>

<b>Account Overview:</b>
• Power: ${d.power.toLocaleString()}
• Kill Points: ${d.killPoints.toLocaleString()}
• Deads: ${d.dead.toLocaleString()}
---------------------------------
`;

        if (isAccepted) {
            bbCode += `Congratulations! You have been <b><color=#10b981>Approved</color></b> for migration.
Please reach out to a King or council member for the next steps and passport clearance list.`;
        } else {
            bbCode += `Unfortunately, your application has been <b><color=#ef4444>Denied</color></b> at this time.
Reasoning: ${document.getElementById('recruitFinalVerdict').title || "Did not meet the strict statistical requirements."}

We wish you the best of luck in your future endeavors.`;
        }

        if (window.mailService) {
            const mailContainer = document.getElementById('mail-input');
            if (mailContainer) {
                mailContainer.value = bbCode;
                window.mailService.updatePreview();

                // Switch Tabs
                if (window.uiService && window.uiService.switchMainTab) {
                    window.uiService.switchMainTab('mail');
                } else {
                    document.querySelector('[data-tab="mail"]').click();
                }
            }
        }
    }

    async fetchPastRecruits() {
        const recruitUrl = localStorage.getItem('__unity_recruit_firebase_url') || 'https://recruitingroster-default-rtdb.firebaseio.com/';
        if (!recruitUrl) {
            alert('No Recruiting Database URL found. Set one in the Settings tab.');
            return;
        }

        const fetchBtn = document.getElementById('fetchRecruitsBtn');
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.textContent = '⏳ Fetching Database...';
        }

        try {
            // Dynamically initialize the isolated database
            let recruitApp;
            try {
                recruitApp = firebase.app('RecruitingApp');
            } catch (e) {
                recruitApp = firebase.initializeApp({ databaseURL: recruitUrl }, 'RecruitingApp');
            }

            const db = recruitApp.database();
            const snapshot = await db.ref('recruits').once('value');

            if (!snapshot.exists()) {
                alert('No recruits found in this database yet.');
            } else {
                const recruitsMap = snapshot.val();
                this.renderRecruitsTable(recruitsMap);
            }

        } catch (error) {
            console.error('Error fetching recruiting data:', error);
            alert('Failed to fetch data from custom database. Check console logs.');
        } finally {
            if (fetchBtn) {
                fetchBtn.disabled = false;
                fetchBtn.innerHTML = '⬇️ Refresh Past Recruits';
            }
        }
    }

    renderRecruitsTable(recruitsMap) {
        const listContainer = document.getElementById('recruitsListContainer');
        const listBody = document.getElementById('recruitsListBody');
        const dragZone = document.getElementById('recruitingDragZone');

        if (!listContainer || !listBody) return;

        // Hide upload zone to give table space (user can switch tabs to reset)
        if (dragZone) dragZone.style.display = 'none';
        listContainer.style.display = 'block';

        let html = '';
        const recruitsArray = Object.keys(recruitsMap).map(key => ({
            idKey: key,
            ...recruitsMap[key]
        }));

        // Sort mostly recent first
        recruitsArray.sort((a, b) => new Date(b.LastScanned || 0) - new Date(a.LastScanned || 0));

        recruitsArray.forEach(r => {
            const dateStr = r.LastScanned ? new Date(r.LastScanned).toLocaleDateString() : 'Unknown';
            let badgeColor = '#f59e0b'; // warning/orange
            if (r.Summary && r.Summary.includes('ACCEPT')) badgeColor = '#10b981'; // positive/green
            if (r.Summary && r.Summary.includes('DECLINE')) badgeColor = '#ef4444'; // danger/red

            html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px 5px; color: var(--text-muted); font-size: 0.9em;">${dateStr}</td>
                    <td style="padding: 10px 5px; font-weight: bold;">${r.Name || 'Unknown'}</td>
                    <td style="text-align: center; color: var(--text-muted); font-size: 0.85em;">${r.idKey.substring(0, 10)}...</td>
                    <td style="text-align: right; color: var(--text-secondary);">${(r.Power || 0).toLocaleString()}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${(r.KillPoints || 0).toLocaleString()}</td>
                    <td style="text-align: center; font-weight: bold; color: var(--accent-primary);">${r.Score || '0 / 35'}</td>
                    <td style="text-align: center;">
                        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor};">
                            ${r.Summary ? r.Summary.split(' ')[1] || r.Summary.split(' ')[0] : 'UNKNOWN'}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <button class="icon-btn" onclick="window.recruitScannerService.deleteRecruit('${r.idKey}')" title="Delete record" style="background: transparent; border: none; cursor: pointer; font-size: 1.1em; opacity: 0.7; transition: opacity 0.2s;">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        listBody.innerHTML = html;
    }

    async deleteRecruit(idKey) {
        if (!confirm('Are you sure you want to delete this applicant record?')) return;

        const recruitUrl = localStorage.getItem('__unity_recruit_firebase_url');
        if (!recruitUrl) return;

        try {
            let recruitApp;
            try {
                recruitApp = firebase.app('RecruitingApp');
            } catch (e) {
                recruitApp = firebase.initializeApp({ databaseURL: recruitUrl }, 'RecruitingApp');
            }

            const db = recruitApp.database();
            await db.ref('recruits/' + idKey).remove();

            // Refresh table
            this.fetchPastRecruits();
        } catch (error) {
            console.error("Failed to delete recruit:", error);
            alert("Delete failed. Check console.");
        }
    }
}

window.RecruitScannerService = RecruitScannerService;
