document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Starting Unity Init...");
        const dataService = new DataService();
        window.UnityApp = dataService;

        dataService.loadState();

        const uiService = new UIService(dataService);
        await uiService.init();

        try {
            if (uiService.initSOC) uiService.initSOC();
        } catch (socError) {
            console.error("SOC Init Failed:", socError);
        }

        // Attach Filter Listener
        document.getElementById('socFilterSelect')?.addEventListener('change', () => {
            uiService.calculateStratagemsStats();
        });


        // Attach File Upload Logic
        const setupUpload = (inputId, zoneId, type, msg) => {
            const input = document.getElementById(inputId);
            const zone = document.getElementById(zoneId);
            if (!input || !zone) {
                if (!input) console.warn(`SETUP ERROR: Input not found for ${zoneId} (ID: ${inputId})`);
                if (!zone) console.warn(`SETUP ERROR: Zone not found for ${zoneId} (ID: ${zoneId})`);
                return;
            }

            zone.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a') || e.target.closest('.cloud-link')) {
                    return;
                }
                input.click();
            });

            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                // Check if this is an SOC zone or Main zone
                if (zoneId.startsWith('soc')) {
                    uiService.handleSOCUpload(e.dataTransfer.files[0], type);
                } else {
                    handleFiles(e.dataTransfer.files, type, msg);
                }
            });

            input.addEventListener('change', (e) => {
                if (zoneId.startsWith('soc')) {
                    uiService.handleSOCUpload(e.target.files[0], type);
                } else {
                    handleFiles(e.target.files, type, msg);
                }
            });
        };

        const handleFiles = async (fileList, type, successMsg) => {
            if (!fileList || fileList.length === 0) return;
            try {
                const results = await Promise.all(Array.from(fileList).map(file => dataService.parseFile(file)));

                results.forEach(result => {
                    const { data, date, kingdoms } = result;
                    if (type === 'start') { dataService.state.startScanDate = date; }
                    else if (type === 'mid') { dataService.state.midScanDate = date; }
                    else { dataService.state.endScanDate = date; }

                    uiService.updateScanDetails(type, date, kingdoms);

                    kingdoms.forEach(kId => {
                        dataService.initKingdom(kId);
                        const kState = dataService.state.kingdoms[kId];
                        if (type === 'start') kState.startData.push(...data.filter(r => r['_kingdom'] === kId));
                        else if (type === 'mid') kState.midData.push(...data.filter(r => r['_kingdom'] === kId));
                        else kState.endData.push(...data.filter(r => r['_kingdom'] === kId));
                    });
                });

                await dataService.saveState();
                uiService.renderKingdomTabs();

                dataService.state.loadedKingdoms.forEach(kId => {
                    CalculationService.calculateKingdom(kId, dataService.state);
                    if (dataService.state.kingdoms[kId].calculatedData.length > 0) {
                        uiService.renderResultsTable(kId, dataService.state.kingdoms[kId].calculatedData);
                    }
                });
                uiService.renderKingdomComparison();
                if (successMsg) alert(successMsg);

            } catch (error) {
                console.error(error);
                alert(`Error during file processing: ${error.message}`);
            }
        };
        window.handleFilesGlobal = handleFiles;

        setupUpload('startScanInput', 'startScanZone', 'start', 'Start Scan Loaded');
        setupUpload('midScanInput', 'midScanZone', 'mid', 'Mid Scan Loaded');
        setupUpload('endScanInput', 'endScanZone', 'end', 'End Scan Loaded');

        // SOC Uploads
        setupUpload('socStartInput', 'socStartZone', 'socStart', 'SOC Start');
        setupUpload('socPass4Input', 'socPass4Zone', 'socPass4', 'SOC Pass 4');
        setupUpload('socPass5Input', 'socPass5Zone', 'socPass5', 'SOC Pass 5');
        setupUpload('socPass6Input', 'socPass6Zone', 'socPass6', 'SOC Pass 6');
        setupUpload('socPass7Input', 'socPass7Zone', 'socPass7', 'SOC Pass 7');
        setupUpload('socPass8Input', 'socPass8Zone', 'socPass8', 'SOC Pass 8');
        setupUpload('socEndInput', 'socEndZone', 'socEnd', 'SOC End');

        // Main Tab Save Buttons
        const bindSave = (id, type) => {
            const btn = document.getElementById(id);
            if (btn) btn.onclick = (e) => {
                e.stopPropagation();
                if (uiService) uiService.handleMainCloudSave(type);
            };
        };
        bindSave('cloudUploadStartBtn', 'start');
        bindSave('cloudUploadMidBtn', 'mid');
        bindSave('cloudUploadEndBtn', 'end');

        console.log("Unity Init Complete.");

    } catch (criticalError) {
        console.error("CRITICAL INIT ERROR:", criticalError);
        alert(`CRITICAL ERROR: The application failed to start.\n\n${criticalError.message}\n\nCheck console for details.`);
    }
});
