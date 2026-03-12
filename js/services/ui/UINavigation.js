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
        
        // Handle Sidebar Navigation highlighting
        const sidebarMenu = document.querySelector('.sidebar-menu');
        if (sidebarMenu) {
            // Remove active from all sidebar buttons
            sidebarMenu.querySelectorAll('.nav-btn, .nav-category-btn, .subtab-btn, .kingdom-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active to the clicked button if it's a direct nav link
            const targetBtn = sidebarMenu.querySelector(`[data-tab="${tabId}"]`);
            if (targetBtn) {
                targetBtn.classList.add('active');
            }
        }

        // Hide all content areas
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.classList.add('hidden');
            c.style.display = ''; // Clear inline display, rely on CSS classes
        });
        
        // Show target content area
        const targetContent = document.getElementById(tabId);
        if (targetContent) {
            targetContent.classList.remove('hidden');
            
            // Re-trigger animation by forcing reflow
            void targetContent.offsetWidth; 
            targetContent.classList.add('active');
            
            // Set current page title in the top bar
            const titleEl = document.getElementById('current-page-title');
            if (titleEl) {
                // Find the human readable title from the clicked button or use fallback
                const sourceBtn = document.querySelector(`.sidebar-menu [data-tab="${tabId}"]`);
                if (sourceBtn) {
                     // Extract text, ignoring icons if present
                     let titleText = sourceBtn.textContent.trim();
                     // Basic cleanup for known icons (could be better)
                     titleText = titleText.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '');
                     titleEl.textContent = titleText;
                } else {
                     // Fallback title formatting based on ID
                     titleEl.textContent = tabId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                }
            }
        }

        document.querySelectorAll('.kingdom-content').forEach(c => c.style.display = 'none');

        // Dynamic Kingdom Tabs in Header Logic
        const dynamicTabsContainer = document.getElementById('dynamic-kingdom-tabs');
        const tabsWithSubtabs = ['prekvk-analysis', 'all-kingdom-results', 'prekvk-ranking'];
        
        if (dynamicTabsContainer) {
             if (tabsWithSubtabs.includes(tabId) && this.data.state.loadedKingdoms.size > 0) {
                 dynamicTabsContainer.style.display = 'flex';
                 // Ensure active state is cleared locally if switching major modes
                 dynamicTabsContainer.querySelectorAll('.kingdom-tab-btn').forEach(t => t.classList.remove('active'));
             } else {
                 dynamicTabsContainer.style.display = 'none';
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
        }

        // Stop race chart if leaving
        if (window.UIRaceChart && tabId !== 'race-to-glory') {
            window.UIRaceChart.pause();
            if (window.UIRaceChart.chart) {
                window.UIRaceChart.chart.destroy();
                window.UIRaceChart.chart = null;
            }
        }

        if (tabId === 'soc') {
            this.switchSOCSubTab('storm-of-stratagems');
        } else if (tabId === 'race-to-glory') {
            if (window.UIRaceChart) window.UIRaceChart.render();
        } else if (tabId === 'all-kingdom-analysis') {
            if (window.uiKingdomAnalysis) {
                window.uiKingdomAnalysis.renderAllKingdoms(this.data, 'all-kingdom-analysis-container');
            }
        } else if (tabId === 'camps') {
            if (window.uiCamps) {
                window.uiCamps.updateCampKingdomSelects();
                window.uiCamps.renderCampsDashboard();
            }
        }
        this.data.state.activeKingdomId = null;
    },

    switchKingdom(kingdomId) {
        this.data.state.activeKingdomId = kingdomId;
        
        // Remove active from Main Tabs (Sidebar Menu)
        const sidebarMenu = document.querySelector('.sidebar-menu');
        if (sidebarMenu) {
            sidebarMenu.querySelectorAll('.nav-btn, .nav-category-btn, .subtab-btn, .kingdom-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
        }
        
        // Remove active from dynamic kingdom tabs
        if (this.elements['dynamic-kingdom-tabs']) this.elements['dynamic-kingdom-tabs'].querySelectorAll('.kingdom-tab-btn').forEach(t => t.classList.remove('active'));

        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.classList.add('hidden');
            c.style.display = '';
        });
        document.querySelectorAll('.kingdom-content').forEach(c => {
            c.classList.remove('active');
            c.classList.add('hidden');
            c.style.display = '';
        });

        const btn = this.elements['dynamic-kingdom-tabs'] ? this.elements['dynamic-kingdom-tabs'].querySelector(`[data-tab="kingdom-${kingdomId}"]`) : null;
        if (btn) btn.classList.add('active');

        // Update the top bar title
        const titleEl = document.getElementById('current-page-title');
        if (titleEl) {
            titleEl.textContent = `Kingdom ${kingdomId}`;
        }

        const content = document.getElementById(`kingdom-${kingdomId}`);
        if (content) {
            content.classList.remove('hidden');
            content.classList.add('active');
            
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

        } else if (subTabId === 'alliance-duel') {
            this.renderAllianceDuel(kingdomId);
        } else if (subTabId === 'hall-of-legends') {
            this.renderHallOfLegends(kingdomId);
        } else if (subTabId === 'war-council') {
            if (window.UIWarCouncil) {
                window.UIWarCouncil.init(this.data, kingdomId);
            }
        } else if (subTabId === 'alliance-merge') {
            if (window.UIAllianceMerge) {
                window.UIAllianceMerge.init(this.data, kingdomId);
            }
        } else if (subTabId === 'mge-planner') {
            if (window.uiMGEPlanner) {
                window.uiMGEPlanner.init(this.data, kingdomId);
            }
        } else if (subTabId === 'kingdom-analysis') {
            if (window.uiKingdomAnalysis) {
                window.uiKingdomAnalysis.init(this.data, kingdomId);
            }
        }
    },

    renderKingdomTabs() {
        if (!this.elements['dynamic-kingdom-tabs']) return;
        this.elements['dynamic-kingdom-tabs'].innerHTML = '';

        const kingdoms = Array.from(this.data.state.loadedKingdoms);
        if (kingdoms.length > 0) {
            this.elements['dynamic-kingdom-tabs'].classList.remove('hidden');
            this.elements['dynamic-kingdom-tabs'].style.display = 'flex';
        } else {
            this.elements['dynamic-kingdom-tabs'].classList.add('hidden');
            this.elements['dynamic-kingdom-tabs'].style.display = 'none';
        }

        kingdoms.forEach(kId => {
            const btn = document.createElement('button');
            btn.className = 'kingdom-tab-btn';
            btn.dataset.tab = `kingdom-${kId}`;
            btn.dataset.tooltip = `Analysis and calculations for Kingdom ${kId}`;
            btn.textContent = `Kingdom ${kId}`;
            this.elements['dynamic-kingdom-tabs'].appendChild(btn);

            if (!document.getElementById(`kingdom-${kId}`)) this.createKingdomContent(kId);
        });
        this.updatePrekvkDropdown();
        this.updateNPWDDropdown();
        if (this.updateHoHScannerDropdown) this.updateHoHScannerDropdown();
    },

    switchPrekvkSubTab(subTabId) {
        const container = document.getElementById('prekvk-analysis');
        if (!container) return;
        this._activateTab(container, '.subtab-btn', '.subtab-content', subTabId, 'subtab');

        const select = this.elements.prekvkKingdomSelect;
        const govCountSelect = this.elements.prekvkGovCountSelect;

        if (select) {
            select.classList.remove('hidden');
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
