// ==========================================
// SERVICE: UI NAVIGATION
// ==========================================
Object.assign(UIService.prototype, {
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
    },

    switchMainTab(tabId) {
        console.log("Switching Main Tab to:", tabId);
        if (this.elements.mainTabs) {
            this.elements.mainTabs.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabId);
            });
        }
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
            targetContent.style.display = 'block';
        }

        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');
        if (this.elements.kingdomTabs) this.elements.kingdomTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

        const tabsWithSubtabs = ['prekvk-analysis', 'all-kingdom-results', 'prekvk-ranking'];
        if (this.elements.kingdomTabs) {
            if (tabsWithSubtabs.includes(tabId) && this.data.state.loadedKingdoms.size > 0) {
                this.elements.kingdomTabs.classList.remove('hidden');
            } else {
                this.elements.kingdomTabs.classList.add('hidden');
            }
        }

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
        } else if (tabId === 'command-center') {
            this.renderCommandCenter();
        } else if (tabId === 'soc') {
            this.switchSOCSubTab('storm-of-stratagems');
        }
        this.data.state.activeKingdomId = null;
    },

    switchKingdom(kingdomId) {
        this.data.state.activeKingdomId = kingdomId;
        if (this.elements.mainTabs) this.elements.mainTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        if (this.elements.kingdomTabs) this.elements.kingdomTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });
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
    },

    switchSubTab(kingdomId, subTabId) {
        const kingdomContainer = document.getElementById(`kingdom-${kingdomId}`);
        if (!kingdomContainer) return;
        this._activateTab(kingdomContainer, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        if (subTabId === 'overview') this.syncOverviewScroll(kingdomId);
        else if (subTabId === 'growth') {
            if (window.uiGrowth) window.uiGrowth.renderGrowthTab(kingdomId);
        }
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
    },

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
    },

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
});
