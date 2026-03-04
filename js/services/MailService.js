class MailService {
    constructor() {
        this.initialized = false;
        this.currentColor = '#ffffff';
    }

    init() {
        if (this.initialized) return;

        console.log("Initializing MailService...");
        this.elements = {
            inputArea: document.getElementById('mail-input'),
            previewArea: document.getElementById('preview-render'),
            colorPicker: document.getElementById('color-picker'),
            sizeSelect: document.getElementById('size-select'),
            symbolBtn: document.getElementById('btn-symbols'),
            symbolMenu: document.getElementById('symbol-menu'),
            copyBtn: document.getElementById('copy-btn'),
            clearBtn: document.getElementById('clear-btn'),
            capsBtn: document.getElementById('btn-caps'),
            applyColorBtn: document.getElementById('color-btn-display'),
            btnUndo: document.getElementById('btn-undo'),
            btnGradient: document.getElementById('btn-gradient'),
            // Global Variables
            kingdomInput: document.getElementById('globalKingdomInput'),
            allianceInput: document.getElementById('globalAllianceInput'),
            // Template Modal Elements
            btnLoadTemplate: document.getElementById('btn-load-template'),
            templateModal: document.getElementById('mailTemplateModal'),
            templateSelect: document.getElementById('mailTemplateSelect'),
            btnCancelTemplate: document.getElementById('btn-cancel-template'),
            btnApplyTemplate: document.getElementById('btn-apply-template')
        };

        if (!this.elements.inputArea) {
            console.warn("MailService: Elements not found (Has HTML been injected?)");
            return;
        }

        // Setup undo history stack
        this.history = [];
        this.saveState();

        this.setupEventListeners();
        this.populateTemplates();

        // Load persist logic
        const savedKingdom = localStorage.getItem('unity_mail_kingdom');
        if (savedKingdom && this.elements.kingdomInput) this.elements.kingdomInput.value = savedKingdom;
        const savedAlliance = localStorage.getItem('unity_mail_alliance');
        if (savedAlliance && this.elements.allianceInput) this.elements.allianceInput.value = savedAlliance;

        this.initialized = true;
    }

    populateTemplates() {
        if (!this.elements.templateSelect || !window.ROK_MAIL_TEMPLATES) return;

        Object.keys(window.ROK_MAIL_TEMPLATES).forEach(key => {
            const tmpl = window.ROK_MAIL_TEMPLATES[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = tmpl.title;
            this.elements.templateSelect.appendChild(opt);
        });
    }

    setupEventListeners() {
        const els = this.elements;

        // Live Preview
        els.inputArea.addEventListener('input', () => {
            this.saveState();
            this.updatePreview();
        });

        // Global Inputs update preview live
        if (els.kingdomInput) {
            els.kingdomInput.addEventListener('input', () => {
                localStorage.setItem('unity_mail_kingdom', els.kingdomInput.value);
                this.updatePreview();
            });
        }
        if (els.allianceInput) {
            els.allianceInput.addEventListener('input', () => {
                localStorage.setItem('unity_mail_alliance', els.allianceInput.value);
                this.updatePreview();
            });
        }

        // Color Picker Display Sync
        els.colorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            // Also update the icon color to match
            if (els.applyColorBtn) els.applyColorBtn.querySelector('span').style.color = this.currentColor;
        });

        // Toolbar Buttons (Bold, Italic)
        document.querySelectorAll('.tool-btn[data-tag]').forEach(btn => {
            btn.addEventListener('click', () => this.insertTag(btn.dataset.tag));
        });

        // Caps
        els.capsBtn.addEventListener('click', () => this.transformSelection(text => text.toUpperCase()));

        // Apply Color
        els.applyColorBtn.addEventListener('click', () => this.insertColor(this.currentColor));

        // Size Select
        els.sizeSelect.addEventListener('change', () => {
            if (els.sizeSelect.value) {
                this.insertSize(els.sizeSelect.value);
                els.sizeSelect.value = "";
            }
        });

        // Symbol Menu Toggle
        els.symbolBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            els.symbolMenu.classList.toggle('hidden');
        });

        // Symbol Menu Tabs
        // Symbol Menu Tabs
        const symbolTabs = els.symbolMenu.querySelectorAll('.tab-btn');
        symbolTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                // UI Update
                symbolTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Content Switch
                const targetId = `tab-${tab.dataset.tab}`;
                document.querySelectorAll('.symbol-content').forEach(content => {
                    content.classList.toggle('hidden', content.id !== targetId);
                    content.classList.toggle('active', content.id === targetId);
                });
            });
        });

        // Symbol Insertion
        els.symbolMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('.symbol-btn');
            if (btn) {
                this.insertTextAtCursor(btn.dataset.insert);
                if (btn.classList.contains('full-width')) els.symbolMenu.classList.add('hidden');
            }
        });

        // Close Menu on Click Outside
        document.addEventListener('click', (e) => {
            if (els.symbolMenu && !els.symbolMenu.contains(e.target) && e.target !== els.symbolBtn) {
                els.symbolMenu.classList.add('hidden');
            }
        });

        // Copy
        els.copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(els.inputArea.value).then(() => {
                alert('Mail code copied to clipboard! 📋');
            });
        });

        // Clear
        els.clearBtn.addEventListener('click', () => {
            if (confirm('Clear entire mail?')) {
                this.saveState();
                els.inputArea.value = '';
                this.updatePreview();
            }
        });

        // Undo
        if (els.btnUndo) {
            els.btnUndo.addEventListener('click', () => this.performUndo());
        }

        // Default Gradient Action
        if (els.btnGradient) {
            els.btnGradient.addEventListener('click', () => this.insertGradient());
        }

        // Dropdown Gradient Templates
        document.querySelectorAll('.gradient-list-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent bubbling up to the container
                if (btn.dataset.colors) {
                    const colors = btn.dataset.colors.split(',');
                    this.insertGradient(colors);
                }
            });
        });

        // Templates Modal
        if (els.btnLoadTemplate) {
            els.btnLoadTemplate.addEventListener('click', () => {
                els.templateModal.classList.remove('hidden');
            });
        }
        if (els.btnCancelTemplate) {
            els.btnCancelTemplate.addEventListener('click', () => {
                els.templateModal.classList.add('hidden');
                els.templateSelect.value = '';
            });
        }
        if (els.btnApplyTemplate) {
            els.btnApplyTemplate.addEventListener('click', () => this.applyTemplate());
        }
    }

    // Logic Methods
    insertTag(tag) {
        this.wrapSelection(`<${tag}>`, `</${tag}>`);
    }

    insertColor(hex) {
        this.wrapSelection(`<color=${hex}>`, `</color>`);
    }

    insertSize(size) {
        this.wrapSelection(`<size=${size}>`, `</size>`);
    }

    wrapSelection(startTag, endTag) {
        const input = this.elements.inputArea;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + startTag + selectedText + endTag + text.substring(end);
        input.value = newText;
        this.updatePreview();

        input.focus();
        input.setSelectionRange(start + startTag.length, end + startTag.length);
    }

    transformSelection(transformFn) {
        const input = this.elements.inputArea;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const selectedText = text.substring(start, end);

        if (!selectedText) return;

        const newText = text.substring(0, start) + transformFn(selectedText) + text.substring(end);
        input.value = newText;
        this.updatePreview();
        input.focus();
        input.setSelectionRange(start, end);
    }

    insertTextAtCursor(textToInsert) {
        const input = this.elements.inputArea;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;

        const newText = text.substring(0, start) + textToInsert + text.substring(end);
        input.value = newText;
        this.updatePreview();

        const newPos = start + textToInsert.length;
        input.focus();
        input.setSelectionRange(newPos, newPos);
    }

    updatePreview() {
        if (!this.elements.inputArea) return;
        const rawText = this.elements.inputArea.value;
        const parsedHtml = this.parseRokTags(rawText);
        this.elements.previewArea.innerHTML = parsedHtml;
    }

    parseRokTags(text) {
        // 1. Escape HTML
        let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Dynamic Variables Inject
        const kingdomNum = this.elements.kingdomInput ? (this.elements.kingdomInput.value.trim() || "3155") : "3155";
        const allianceTag = this.elements.allianceInput ? (this.elements.allianceInput.value.trim() || "[5-MS]") : "[5-MS]";
        safeText = safeText.replace(/\{KINGDOM_NUMBER\}/g, kingdomNum);
        safeText = safeText.replace(/\{ALLIANCE_TAG\}/g, allianceTag);

        let html = safeText;
        // 2. Transform Tags
        // Support #ffffff and #fff, optionally surrounded by " or '
        html = html.replace(/&lt;color=(?:&quot;|'|")?(#[0-9a-fA-F]{3,6})(?:&quot;|'|")?&gt;/gi, '<span style="color: $1">');
        html = html.replace(/&lt;\/color&gt;/gi, '</span>');

        html = html.replace(/&lt;size=(\d+)&gt;/g, '<span style="font-size: $1px">');
        html = html.replace(/&lt;\/size&gt;/g, '</span>');

        html = html.replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
        html = html.replace(/&lt;i&gt;/g, '<i>').replace(/&lt;\/i&gt;/g, '</i>');

        html = html.replace(/\n/g, '<br>');
        return html;
    }

    applyTemplate() {
        const els = this.elements;
        const selectedKey = els.templateSelect.value;

        if (!selectedKey) {
            alert("Please select a template first.");
            return;
        }

        let layout = window.ROK_MAIL_TEMPLATES[selectedKey].content;

        this.saveState(); // Save before overwriting

        // Inject into textarea
        els.inputArea.value = layout;
        this.updatePreview();

        // Close modal
        els.templateModal.classList.add('hidden');
        els.templateSelect.value = '';
    }

    // --- New Overhaul Features ---
    saveState() {
        if (!this.elements.inputArea) return;
        const currentVal = this.elements.inputArea.value;
        // Don't save if it's identical to the last state
        if (this.history.length === 0 || this.history[this.history.length - 1] !== currentVal) {
            this.history.push(currentVal);
            if (this.history.length > 50) this.history.shift(); // Max 50 undos
        }
    }

    performUndo() {
        if (this.history.length > 1) {
            this.history.pop(); // Remove current state
            const previousState = this.history[this.history.length - 1];
            this.elements.inputArea.value = previousState;
            this.updatePreview();
        } else if (this.history.length === 1) {
            // Revert to completely empty if history is drained
            this.history.pop();
            this.elements.inputArea.value = "";
            this.updatePreview();
        }
    }

    insertGradient(customColors = null) {
        const input = this.elements.inputArea;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const selectedText = text.substring(start, end);

        if (!selectedText) {
            alert("Please select some text to apply a gradient to.");
            return;
        }

        // Extremely simple built in red-to-yellow-to-blue gradient
        // You could expand this to prompt the user for colors
        const colors = customColors || [
            "#ff0000", "#ff3300", "#ff6600", "#ff9900", "#ffcc00", "#ffff00",
            "#ccff00", "#99ff00", "#66ff00", "#33ff00", "#00ff00", "#00ff33",
            "#00ff66", "#00ff99", "#00ffcc", "#00ffff", "#00ccff", "#0099ff",
            "#0066ff", "#0033ff", "#0000ff"
        ];

        // Interpolate colors dynamically based on string length to ensure smooth transitions
        let finalColors = colors;

        // If they provided a small template like ["#ff0000", "#ffff00", "#00ff00"], we should probably stretch it
        // across the selection length for optimal smoothness, but for now we'll just loop it simply if short, 
        // or step it.
        const step = Math.max(1, Math.floor(finalColors.length / selectedText.length));

        let gradientAppliedText = "";
        let colorIndex = 0;

        for (let i = 0; i < selectedText.length; i++) {
            const char = selectedText[i];
            if (char === ' ' || char === '\n') {
                gradientAppliedText += char; // Don't colorize whitespace
            } else {
                const hex = finalColors[colorIndex];
                gradientAppliedText += `<color=${hex}>${char}</color>`;
                // For a custom palette like Fire (3 colors) on a 10 char string, we want to smoothly
                // step. Instead of complex color math, just distribute indices evenly.
                colorIndex = Math.min(finalColors.length - 1, Math.floor((i / Math.max(1, selectedText.length - 1)) * (finalColors.length - 1)));
            }
        }

        const newText = text.substring(0, start) + gradientAppliedText + text.substring(end);

        this.saveState();
        input.value = newText;
        this.updatePreview();

        // Restore focus
        input.focus();
    }
}
