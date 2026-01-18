// ==========================================
// SERVICE: CALCULATION
// ==========================================
class CalculationService {
    static formatNumber(num) {
        if (num === undefined || num === null) return '0';
        return num.toLocaleString();
    }

    static safeInt(val) {
        return Utils.parseNumber(val);
    }

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
}
