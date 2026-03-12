class ThemeController {
    constructor() {
        this.themes = ['theme-sidebar', 'theme-minimalist', 'theme-floating'];
        this.currentTheme = localStorage.getItem('unity_ui_theme') || 'theme-sidebar';
        this.themeLink = document.getElementById('theme-stylesheet');
        this.init();
    }

    init() {
        // Create the link element if it doesn't exist
        if (!this.themeLink) {
            this.themeLink = document.createElement('link');
            this.themeLink.id = 'theme-stylesheet';
            this.themeLink.rel = 'stylesheet';
            document.head.appendChild(this.themeLink);
        }
        
        // Initial application
        this.applyTheme(this.currentTheme);

        // Bind settings dropdown if exists
        const themeSelect = document.getElementById('ui-theme-select');
        if (themeSelect) {
            themeSelect.value = this.currentTheme;
            themeSelect.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });
        }
    }

    applyTheme(themeName) {
        if (!this.themes.includes(themeName)) return;

        // Remove all theme classes from body
        document.body.classList.remove(...this.themes);
        
        // Add new theme class
        document.body.classList.add(themeName);
        
        // Update stylesheet reference
        this.themeLink.href = `css/themes/${themeName}.css`;
        
        // Save preference
        this.currentTheme = themeName;
        localStorage.setItem('unity_ui_theme', themeName);
        
        // Dispatch event for other components that might need to redraw (charts etc)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: themeName } }));
    }
}
