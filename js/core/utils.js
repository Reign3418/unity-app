// ==========================================
// 2. UTILITIES
// ==========================================
class Utils {
    static parseNumber(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
    }

    static formatNumber(val) {
        if (!val) return '0';
        return parseInt(val).toLocaleString();
    }

    static formatCompactNumber(val) {
        if (!val) return '0';
        return new Intl.NumberFormat('en-US', {
            notation: "compact",
            maximumFractionDigits: 1
        }).format(val);
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
