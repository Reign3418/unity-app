class UIFlagBuilder {
    constructor() {
        this.container = document.getElementById('calc-flag-builder');
        this.canvasContainer = document.getElementById('fb-canvas-container');
        this.canvas = document.getElementById('flagBuilderCanvas');
        if (!this.canvas || !this.container) return;

        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Opaque background for performance

        // Grid State
        this.gridSize = 100; // 100x100 logical tiles
        this.tileSize = 20;  // pixels per tile

        // Camera / Viewport State
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.cameraStart = { x: 0, y: 0 };

        // Tool State
        this.currentTool = 'select';

        // Objects State
        this.fortresses = []; // { x, y } - 4x4, projects 12x12
        this.flags = [];      // { x, y } - 1x1, projects 7x7
        this.targetPin = null; // { x, y } - 1x1
        this.bgImage = null;
        this.bgScale = 1.0;
        this.bgOpacity = 0.5;

        this.colors = {
            bg: '#2a2a2e',
            gridLine: 'rgba(255, 255, 255, 0.05)',
            gridLineDark: 'rgba(255, 255, 255, 0.15)',
            fortress: '#d97706', // amber
            flag: '#9333ea',    // purple
            target: '#ef4444',  // red
            territory: 'rgba(34, 197, 94, 0.2)' // green, semi-transparent
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.resizeCanvas();
        this.centerCamera();

        // Start render loop
        requestAnimationFrame(() => this.render());
    }

    bindEvents() {
        // Resize observer to keep canvas sharp
        const observer = new ResizeObserver(() => this.resizeCanvas());
        observer.observe(this.canvasContainer);

        // Tool Selection
        const toolRadios = document.querySelectorAll('input[name="flag-tool"]');
        toolRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentTool = e.target.value;
                this.canvas.style.cursor = this.getCursorForTool();
            });
        });

        // Mouse Events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

        // Buttons
        document.getElementById('fb-zoom-in')?.addEventListener('click', () => this.setZoom(this.camera.zoom * 1.2));
        document.getElementById('fb-zoom-out')?.addEventListener('click', () => this.setZoom(this.camera.zoom / 1.2));
        document.getElementById('fb-zoom-reset')?.addEventListener('click', () => {
            this.setZoom(1);
            this.centerCamera();
        });
        document.getElementById('fb-clear-btn')?.addEventListener('click', () => {
            if (confirm('Clear the entire Territory Grid?')) {
                this.fortresses = [];
                this.flags = [];
                this.targetPin = null;
                this.updateStats();
            }
        });

        // Map Upload
        const uploadBtn = document.getElementById('fb-btn-upload-map');
        const fileInput = document.getElementById('fb-map-upload');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        this.bgImage = img;
                        this.render(); // force render
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // Map Adjustment Controls
        const scaleSlider = document.getElementById('fb-map-scale');
        const opacitySlider = document.getElementById('fb-map-opacity');
        const scaleVal = document.getElementById('fb-scale-val');
        const opacityVal = document.getElementById('fb-opacity-val');

        if (scaleSlider && scaleVal) {
            scaleSlider.addEventListener('input', (e) => {
                this.bgScale = parseInt(e.target.value) / 100;
                scaleVal.textContent = `${e.target.value}%`;
                // No need to force render since requestAnimationFrame is running, 
                // but we can just let the next frame pick it up
            });
        }

        if (opacitySlider && opacityVal) {
            opacitySlider.addEventListener('input', (e) => {
                this.bgOpacity = parseInt(e.target.value) / 100;
                opacityVal.textContent = `${e.target.value}%`;
            });
        }

        // Tab listener to trigger resize if opened while hidden
        const tabs = document.querySelectorAll('[data-subtab="calc-flag-builder"], [data-tab="calculators"]');
        tabs.forEach(t => t.addEventListener('click', () => {
            setTimeout(() => this.resizeCanvas(), 50);
        }));
    }

    getCursorForTool() {
        switch (this.currentTool) {
            case 'select': return 'grab';
            case 'fortress': return 'alias';
            case 'flag': return 'crosshair';
            case 'target': return 'crosshair';
            case 'erase': return 'no-drop';
            default: return 'default';
        }
    }

    resizeCanvas() {
        const rect = this.canvasContainer.getBoundingClientRect();
        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        // Force a render
        this.render();
    }

    centerCamera() {
        const rect = this.canvasContainer.getBoundingClientRect();
        // The total world size
        const worldWidth = this.gridSize * this.tileSize;
        const worldHeight = this.gridSize * this.tileSize;

        // Center the camera on the middle of the world
        this.camera.x = (rect.width / 2) - ((worldWidth / 2) * this.camera.zoom);
        this.camera.y = (rect.height / 2) - ((worldHeight / 2) * this.camera.zoom);
    }

    setZoom(level, mouseX = null, mouseY = null) {
        // Map constrained zoom level
        const newZoom = Math.min(Math.max(0.2, level), 3);
        const oldZoom = this.camera.zoom;

        // If zooming with mouse, zoom towards mouse pointer
        if (mouseX !== null && mouseY !== null) {
            const worldX = (mouseX - this.camera.x) / oldZoom;
            const worldY = (mouseY - this.camera.y) / oldZoom;

            this.camera.x = mouseX - (worldX * newZoom);
            this.camera.y = mouseY - (worldY * newZoom);
        } else {
            // Otherwise zoom towards center of screen
            const rect = this.canvasContainer.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const worldCenterOldX = (centerX - this.camera.x) / oldZoom;
            const worldCenterOldY = (centerY - this.camera.y) / oldZoom;

            this.camera.x = centerX - (worldCenterOldX * newZoom);
            this.camera.y = centerY - (worldCenterOldY * newZoom);
        }

        this.camera.zoom = newZoom;
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.camera.x) / this.camera.zoom,
            y: (screenY - this.camera.y) / this.camera.zoom
        };
    }

    worldToGrid(worldX, worldY) {
        return {
            col: Math.floor(worldX / this.tileSize),
            row: Math.floor(worldY / this.tileSize)
        };
    }

    isWithinGrid(col, row, width = 1, height = 1) {
        return col >= 0 && row >= 0 && (col + width) <= this.gridSize && (row + height) <= this.gridSize;
    }

    // --- Interaction Handlers ---

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // If using select tool, handle dragging camera
        if (this.currentTool === 'select' || e.button === 1 || e.button === 2) {
            this.isDragging = true;
            this.dragStart = { x: mouseX, y: mouseY };
            this.cameraStart = { x: this.camera.x, y: this.camera.y };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0) {
            this.handleGridClick(mouseX, mouseY);
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (this.isDragging) {
            const dx = mouseX - this.dragStart.x;
            const dy = mouseY - this.dragStart.y;
            this.camera.x = this.cameraStart.x + dx;
            this.camera.y = this.cameraStart.y + dy;
        }

        // Store hover position for drawing preview
        this.hoverWorld = this.screenToWorld(mouseX, mouseY);
        this.hoverGrid = this.worldToGrid(this.hoverWorld.x, this.hoverWorld.y);
    }

    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = this.getCursorForTool();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let zoomAmount = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in
        this.setZoom(this.camera.zoom * zoomAmount, mouseX, mouseY);
    }

    handleGridClick(screenX, screenY) {
        const world = this.screenToWorld(screenX, screenY);
        const grid = this.worldToGrid(world.x, world.y);

        if (!this.isWithinGrid(grid.col, grid.row)) return;

        switch (this.currentTool) {
            case 'fortress':
                if (this.isWithinGrid(grid.col, grid.row, 4, 4)) {
                    this.fortresses.push({ col: grid.col, row: grid.row });
                    this.enforceOneTargetIfNoTerritory();
                }
                break;
            case 'flag':
                this.flags.push({ col: grid.col, row: grid.row });
                this.enforceOneTargetIfNoTerritory();
                break;
            case 'target':
                this.targetPin = { col: grid.col, row: grid.row };
                break;
            case 'erase':
                this.eraseAt(grid.col, grid.row);
                break;
        }

        this.updateStats();
    }

    eraseAt(col, row) {
        // Check target pin
        if (this.targetPin && this.targetPin.col === col && this.targetPin.row === row) {
            this.targetPin = null;
            return;
        }

        // Check flags
        const flagIdx = this.flags.findIndex(f => f.col === col && f.row === row);
        if (flagIdx !== -1) {
            this.flags.splice(flagIdx, 1);
            return;
        }

        // Check fortresses (they occupy 4x4)
        for (let i = 0; i < this.fortresses.length; i++) {
            const f = this.fortresses[i];
            if (col >= f.col && col < f.col + 4 && row >= f.row && row < f.row + 4) {
                this.fortresses.splice(i, 1);
                return;
            }
        }
    }

    enforceOneTargetIfNoTerritory() {
        // Helper to ensure logic is safe. No-op for now.
    }

    // --- Math & Pathfinding ---

    updateStats() {
        document.getElementById('fb-placed-count').textContent = this.flags.length;

        let estimate = 0;
        if (this.targetPin && (this.fortresses.length > 0 || this.flags.length > 0)) {
            estimate = this.calculateFlagsToTarget();
        }
        document.getElementById('fb-target-estimate').textContent = estimate;
    }

    calculateFlagsToTarget() {
        if (!this.targetPin) return 0;

        const targetCol = this.targetPin.col;
        const targetRow = this.targetPin.row;

        let minDistance = Infinity;

        // Helper to measure Chebyshev distance (max of dx, dy)
        // because RoK territory is square grids
        const getDistance = (col, row, terrRad) => {
            // Find closest point on territory boundary to target
            // Territory spans [col - terrRad, col + terrRad]
            let closestX = Math.max(col - terrRad, Math.min(targetCol, col + terrRad));
            let closestY = Math.max(row - terrRad, Math.min(targetRow, row + terrRad));

            let dx = Math.abs(targetCol - closestX);
            let dy = Math.abs(targetRow - closestY);
            return Math.max(dx, dy); // Square distance
        };

        // Check distance from all fortresses (Territory radius = 6 around connection)
        // A fortress is 4x4. Let's assume its center is col+1.5, row+1.5
        // Total territory is 12x12. So radius from its 4x4 center is roughly 4 out on each side.
        for (const fort of this.fortresses) {
            // Fortress territory bounds: fort.col - 4 to fort.col + 7
            let boundLeft = fort.col - 4;
            let boundRight = fort.col + 7;
            let boundTop = fort.row - 4;
            let boundBottom = fort.row + 7;

            let closestX = Math.max(boundLeft, Math.min(targetCol, boundRight));
            let closestY = Math.max(boundTop, Math.min(targetRow, boundBottom));

            let dist = Math.max(Math.abs(targetCol - closestX), Math.abs(targetRow - closestY));
            minDistance = Math.min(minDistance, dist);
        }

        // Check distance from all flags
        // A flag is 1x1. Territory is 7x7. Bounds: flag.col - 3 to col + 3
        for (const flag of this.flags) {
            let boundLeft = flag.col - 3;
            let boundRight = flag.col + 3;
            let boundTop = flag.row - 3;
            let boundBottom = flag.row + 3;

            let closestX = Math.max(boundLeft, Math.min(targetCol, boundRight));
            let closestY = Math.max(boundTop, Math.min(targetRow, boundBottom));

            let dist = Math.max(Math.abs(targetCol - closestX), Math.abs(targetRow - closestY));
            minDistance = Math.min(minDistance, dist);
        }

        // If we are already inside territory
        if (minDistance <= 0) return 0;

        // Each new flag extends territory by 7 cells linearly (since their 7x7 squares attach to edges)
        // Wait, if an existing edge is at X, we place next flag at X + 1. It projects out to X + 4.
        // A chain of flags connected linearly spaced optimally covers 7 tiles each jump.
        // Actually, distance covered by one flag jump = 7 squares.
        return Math.ceil(minDistance / 7);
    }

    // --- Rendering ---

    render() {
        const rect = this.canvasContainer.getBoundingClientRect();

        // Clear background
        this.ctx.fillStyle = this.colors.bg;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        this.ctx.save();

        // Apply Camera Transform
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Draw Map Background if present
        if (this.bgImage) {
            // Apply scale explicitly to the base dimensions
            const targetWidth = this.bgImage.width * this.bgScale;
            const targetHeight = this.bgImage.height * this.bgScale;

            this.ctx.globalAlpha = this.bgOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0, targetWidth, targetHeight);
            this.ctx.globalAlpha = 1.0;
        }

        this.drawGrid(rect);

        // Draw standard overlaps correctly:
        // By drawing territories with alpha, overlapping regions will natively 
        // accumulate alpha channels to become "dark green/nutrient dense".
        this.drawTerritories();

        this.drawStructures();
        this.drawTargetPin();

        this.drawPreview();

        this.ctx.restore();

        requestAnimationFrame(() => this.render());
    }

    drawGrid(rect) {
        const ts = this.tileSize;
        const totalSize = this.gridSize * ts;

        this.ctx.beginPath();
        for (let x = 0; x <= this.gridSize; x++) {
            this.ctx.moveTo(x * ts, 0);
            this.ctx.lineTo(x * ts, totalSize);
        }
        for (let y = 0; y <= this.gridSize; y++) {
            this.ctx.moveTo(0, y * ts);
            this.ctx.lineTo(totalSize, y * ts);
        }
        this.ctx.strokeStyle = this.colors.gridLine;
        this.ctx.lineWidth = 1 / this.camera.zoom; // Keep lines 1px thick regardless of zoom
        this.ctx.stroke();

        // Thicker lines every 10 blocks
        this.ctx.beginPath();
        for (let x = 0; x <= this.gridSize; x += 10) {
            this.ctx.moveTo(x * ts, 0);
            this.ctx.lineTo(x * ts, totalSize);
        }
        for (let y = 0; y <= this.gridSize; y += 10) {
            this.ctx.moveTo(0, y * ts);
            this.ctx.lineTo(totalSize, y * ts);
        }
        this.ctx.strokeStyle = this.colors.gridLineDark;
        this.ctx.lineWidth = 2 / this.camera.zoom;
        this.ctx.stroke();

        // Border around the entire grid
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3 / this.camera.zoom;
        this.ctx.strokeRect(0, 0, totalSize, totalSize);
    }

    drawTerritories() {
        // Feature disabled by user request: Do not draw green territory borders
    }

    drawStructures() {
        const ts = this.tileSize;

        // Target Path (Optional visual dotted line to target)
        if (this.targetPin && (this.flags.length > 0 || this.fortresses.length > 0) && this.currentTool === 'target') {
            this.drawPredictedPath();
        }

        // Fortresses
        for (const fort of this.fortresses) {
            this.ctx.fillStyle = this.colors.fortress;
            this.ctx.fillRect(fort.col * ts, fort.row * ts, 4 * ts, 4 * ts);

            // Icon
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${ts * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🏰', (fort.col + 2) * ts, (fort.row + 2) * ts);
        }

        // Flags
        for (const flag of this.flags) {
            this.ctx.fillStyle = this.colors.flag;
            this.ctx.fillRect(flag.col * ts, flag.row * ts, ts, ts);
        }
    }

    drawTargetPin() {
        if (!this.targetPin) return;
        const ts = this.tileSize;
        this.ctx.fillStyle = this.colors.target;
        this.ctx.fillRect(this.targetPin.col * ts, this.targetPin.row * ts, ts, ts);

        // Ring around target
        this.ctx.strokeStyle = this.colors.target;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc((this.targetPin.col + 0.5) * ts, (this.targetPin.row + 0.5) * ts, ts * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawPredictedPath() {
        // Find nearest territory edge to target and draw a dashed line
        // A complex sweeping pathfinding algorithm would be needed for a perfect visual, 
        // since distance math just does a square box. But this is visually helpful.
        const ts = this.tileSize;
        let startPoint = null;
        let minDistSq = Infinity;

        let tX = (this.targetPin.col + 0.5) * ts;
        let tY = (this.targetPin.row + 0.5) * ts;

        const checkDist = (col, row) => {
            let cx = (col + 0.5) * ts;
            let cy = (row + 0.5) * ts;
            let dist = Math.pow(tX - cx, 2) + Math.pow(tY - cy, 2);
            if (dist < minDistSq) {
                minDistSq = dist;
                startPoint = { x: cx, y: cy };
            }
        };

        this.fortresses.forEach(f => checkDist(f.col + 1.5, f.row + 1.5));
        this.flags.forEach(f => checkDist(f.col, f.row));

        if (startPoint) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x, startPoint.y);
            this.ctx.lineTo(tX, tY);
            this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // target line red
            this.ctx.lineWidth = 3 / this.camera.zoom;
            this.ctx.setLineDash([10 / this.camera.zoom, 10 / this.camera.zoom]);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    drawPreview() {
        if (!this.hoverGrid || this.currentTool === 'select' || window.innerWidth < 768) return;

        const c = this.hoverGrid.col;
        const r = this.hoverGrid.row;
        const ts = this.tileSize;

        if (!this.isWithinGrid(c, r)) return;

        this.ctx.save();
        this.ctx.globalAlpha = 0.5;

        // "Erase" has a red crosshair
        if (this.currentTool === 'erase') {
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(c * ts, r * ts, ts, ts);
            this.ctx.beginPath();
            this.ctx.moveTo(c * ts, r * ts);
            this.ctx.lineTo((c + 1) * ts, (r + 1) * ts);
            this.ctx.moveTo((c + 1) * ts, r * ts);
            this.ctx.lineTo(c * ts, (r + 1) * ts);
            this.ctx.stroke();
            this.ctx.restore();
            return;
        }

        let width = 1, height = 1, terrBounds = 3, fillColor = this.colors.flag;

        if (this.currentTool === 'fortress') {
            width = 4; height = 4; terrBounds = 4; fillColor = this.colors.fortress;
        } else if (this.currentTool === 'target') {
            fillColor = this.colors.target;
            terrBounds = 0;
        }

        // Draw object box
        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(c * ts, r * ts, width * ts, height * ts);

        this.ctx.restore();
    }
}

// Initialize on DOMContentLoaded and tie to the global scope
document.addEventListener('DOMContentLoaded', () => {
    window.uiFlagBuilder = new UIFlagBuilder();
});
