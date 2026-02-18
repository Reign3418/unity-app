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
            applyColorBtn: document.getElementById('apply-color')
        };

        if (!this.elements.inputArea) {
            console.warn("MailService: Elements not found (Has HTML been injected?)");
            return;
        }

        this.setupEventListeners();
        this.initialized = true;
    }

    setupEventListeners() {
        const els = this.elements;

        // Live Preview
        els.inputArea.addEventListener('input', () => this.updatePreview());

        // Color Picker State
        els.colorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
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
                els.inputArea.value = '';
                this.updatePreview();
            }
        });
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

        let html = safeText;
        // 2. Transform Tags
        html = html.replace(/&lt;color=(#[0-9a-fA-F]{6})&gt;/g, '<span style="color: $1">');
        html = html.replace(/&lt;\/color&gt;/g, '</span>');

        html = html.replace(/&lt;size=(\d+)&gt;/g, '<span style="font-size: $1px">');
        html = html.replace(/&lt;\/size&gt;/g, '</span>');

        html = html.replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
        html = html.replace(/&lt;i&gt;/g, '<i>').replace(/&lt;\/i&gt;/g, '</i>');

        html = html.replace(/\n/g, '<br>');
        return html;
    }
}
