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

        // Memoize static maths to prevent redundant calculation
        const t4MixRatio = 1 - config.t5MixRatio;
        const kpTargetMultiplier = (((config.t5MixRatio * config.t5Points) + (t4MixRatio * config.t4Points)) * config.kpMultiplier) / config.kpPowerDivisor;

        kState.calculatedData = [];

        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};
            const midRow = midMap.get(id) || {};

            const name = endRow['Governor Name'] || startRow['Governor Name'] || 'Unknown';
            const kingdom = endRow['_kingdom'] || startRow['_kingdom'] || kingdomId;
            const alliance = endRow['Alliance Tag'] || startRow['Alliance Tag'] || '-';

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
            const assistanceDiff = Math.max(0, Utils.parseNumber(endRow['Assistance']) - Utils.parseNumber(startRow['Assistance']));

            // Detailed Power Logic
            const cmdPowerStart = Utils.parseNumber(startRow['Commander Power']);
            const cmdPowerEnd = Utils.parseNumber(endRow['Commander Power']);
            const cmdPowerDiff = cmdPowerEnd - cmdPowerStart;

            const techPowerStart = Utils.parseNumber(startRow['Tech Power']);
            const techPowerEnd = Utils.parseNumber(endRow['Tech Power']);
            const techPowerDiff = techPowerEnd - techPowerStart;

            const bldPowerStart = Utils.parseNumber(startRow['Building Power']);
            const bldPowerEnd = Utils.parseNumber(endRow['Building Power']);
            const bldPowerDiff = bldPowerEnd - bldPowerStart;

            let kvkKP = 0;
            let targetKP = 0;
            let targetDeads = 0;
            let kpPercent = 0;
            let deadPercent = 0;
            let totalDKPPercent = 0;
            let basicTotalDKP = 0;

            if (config.dkpSystem === 'basic') {
                kvkKP = (t4Diff * config.basicT4Points) + (t5Diff * config.basicT5Points);
                basicTotalDKP = kvkKP + (deadsDiff * config.basicDeadsPoints);
            } else {
                kvkKP = (t4Diff * config.t4Points) + (t5Diff * config.t5Points);
                targetKP = startPower * kpTargetMultiplier;
                targetDeads = startPower * config.deadsMultiplier;

                kpPercent = targetKP > 0 ? (kvkKP / targetKP) * 100 : 0;
                deadPercent = targetDeads > 0 ? (deadsDiff / targetDeads) * 100 : 0;

                if (targetKP > 0 && targetDeads > 0) totalDKPPercent = (kpPercent + deadPercent) / 2;
                else if (targetKP > 0) totalDKPPercent = kpPercent;
                else if (targetDeads > 0) totalDKPPercent = deadPercent;
            }

            // Status Logic (Refined)
            let status = 'Sleeper';
            if (rawKPDiff > 0) status = 'Fighter';
            else if (rssDiff > 0) status = 'Farmer';
            else if (powerDiff > 0) status = 'Grower';
            else if (powerDiff < 0) status = 'Dropped';

            kState.calculatedData.push({
                id, name, kingdom, alliance, startPower, powerDiff, troopPowerDiff, rawKP: rawKPDiff,
                status, rssGathered: rssDiff,
                t1: Math.max(0, Utils.parseNumber(endRow['T1 Kills']) - Utils.parseNumber(startRow['T1 Kills'])),
                t2: Math.max(0, Utils.parseNumber(endRow['T2 Kills']) - Utils.parseNumber(startRow['T2 Kills'])),
                t3: Math.max(0, Utils.parseNumber(endRow['T3 Kills']) - Utils.parseNumber(startRow['T3 Kills'])),
                t4: t4Diff, t5: t5Diff, t4t5: t4t5Combined,
                t4: t4Diff, t5: t5Diff, t4t5: t4t5Combined,
                deads: deadsDiff, healed: healedDiff, kvkKP, targetKP,
                kpPercent: parseFloat(kpPercent.toFixed(2)),
                rssAssistance: assistanceDiff,
                cmdPower: { start: cmdPowerStart, end: cmdPowerEnd, diff: cmdPowerDiff },
                techPower: { start: techPowerStart, end: techPowerEnd, diff: techPowerDiff },
                bldPower: { start: bldPowerStart, end: bldPowerEnd, diff: bldPowerDiff },
                targetDeads,
                deadPercent: parseFloat(deadPercent.toFixed(2)),
                totalDKPPercent: parseFloat(totalDKPPercent.toFixed(2)),
                basicTotalDKP: Math.round(basicTotalDKP),
                bonus: 0
            });
        });

    }

    static calculateOverviewDiff(startData, endData) {
        const startMap = new Map(startData.map(row => [row['Governor ID'], row]));
        const endMap = new Map(endData.map(row => [row['Governor ID'], row]));

        // Union of all IDs to show everyone (dropped or new)
        const allIds = new Set([...startMap.keys(), ...endMap.keys()]);

        const detailedData = [];

        // Define metrics to expand with Start/End/Delta
        const numericMetrics = [
            'Power', 'Troop Power',
            'Commander Power', 'Tech Power', 'Building Power',
            'Resources Gathered', 'Assistance',
            'Deads', 'Kill Points',
            'T1 Kills', 'T2 Kills', 'T3 Kills', 'T4 Kills', 'T5 Kills'
        ];

        // Static columns to keep
        const staticCols = ['Governor ID', 'Governor Name', 'Alliance Tag', 'Town Hall'];

        allIds.forEach(id => {
            const startRow = startMap.get(id) || {};
            const endRow = endMap.get(id) || {};
            const newRow = {};

            // 1. Static Info (Prefer End, fallback to Start)
            staticCols.forEach(col => {
                newRow[col] = endRow[col] || startRow[col] || '-';
            });
            newRow['Status'] = endRow['_kingdom'] ? (startRow['_kingdom'] ? 'Active' : 'New') : 'Dropped';

            // 2. Numeric Metrics
            numericMetrics.forEach(metric => {
                const startVal = Utils.parseNumber(startRow[metric]);
                const endVal = Utils.parseNumber(endRow[metric]);
                const diff = endVal - startVal;

                // Store RAW values instead of pre-formatted HTML 
                // This saves memory and separates Data from UI Layer
                newRow[`_raw_${metric}_Start`] = startVal;
                newRow[`_raw_${metric}_End`] = endVal;
                newRow[`_raw_${metric}_Delta`] = diff;

                // Provide clean, raw data for the UI to format
                newRow[`${metric} (Start)`] = startVal;
                newRow[`${metric} (End)`] = endVal;
                newRow[`${metric} (Δ)`] = diff;
            });

            detailedData.push(newRow);
        });

        // Sort by Power (End) descending by default
        detailedData.sort((a, b) => {
            const pa = Utils.parseNumber(a['_raw_Power_End']);
            const pb = Utils.parseNumber(b['_raw_Power_End']);
            return pb - pa;
        });

        return detailedData;
    }

    static calculateAchievements(data) {
        if (!data || data.length === 0) return {};

        const getTop = (metricKey, count = 3) => {
            return [...data]
                .sort((a, b) => {
                    const valA = typeof a[metricKey] === 'number' ? a[metricKey] : Utils.parseNumber(a[metricKey]);
                    const valB = typeof b[metricKey] === 'number' ? b[metricKey] : Utils.parseNumber(b[metricKey]);
                    return valB - valA;
                })
                .slice(0, count)
                .map(r => ({
                    name: r['Governor Name'],
                    id: r['Governor ID'],
                    alliance: r['Alliance Tag'],
                    value: typeof r[metricKey] === 'number' ? r[metricKey] : Utils.parseNumber(r[metricKey])
                }));
        };

        return {
            butcher: getTop('_raw_Kill Points_Delta', 3), // Top KP
            shield: getTop('_raw_Deads_Delta', 3), // Top Deads
            warlord: getTop('_raw_Commander Power_Delta', 3),
            architect: getTop('_raw_Building Power_Delta', 3),
            scientist: getTop('_raw_Tech Power_Delta', 3),
            titan: getTop('_raw_Power_Delta', 3), // Top Growth
            healer: getTop('_raw_Assistance_Delta', 3), // Assistance (Heals/Help)
            broker: getTop('_raw_Resources Gathered_Delta', 3) // RSS Gathering
        };
    }
}
