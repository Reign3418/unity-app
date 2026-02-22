// ==========================================
// SERVICE: UI (BASE)
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
            'kingdomComparisonLimit', 'kingdomComparisonTable',
            'allKingdomT4Weight', 'allKingdomT5Weight', 'allKingdomDeadWeight'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.elements[id] = el;
        });
    }

    async init() {
        this.setupEventListeners();

        await this.data.loadState();

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

    updateScanDetails(type, date, kingdoms) {
        let detailsEl;
        if (type === 'start') detailsEl = this.elements.startScanDetails;
        else if (type === 'mid') detailsEl = document.getElementById('midScanDetails');
        else detailsEl = this.elements.endScanDetails;

        if (!detailsEl) return;
        let html = '';
        if (date) html += `<div class="scan-date">Date: ${date}</div>`;
        if (kingdoms && kingdoms.length > 0) {
            html += `<div class="scan-kingdoms">Kingdoms: ${kingdoms.join(', ')}</div>`;
        }
        detailsEl.innerHTML = html;
        detailsEl.style.display = 'block';
    }
}
