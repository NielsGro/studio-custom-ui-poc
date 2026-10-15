// Themes for the POC. Pick one with "theme" in config.json.
//
// Each theme has two parts:
// - `studio`: passed to Studio UI as `uiOptions.theme`; see the "uiOptions, theme" section of the
//   Studio UI advanced integration guide.
// - `css`: CSS variables for the parts the POC adds itself (top bar, custom buttons, dropdown, toast).

export const themes = {
    // White & yellow
    default: {
        studio: {
            fontFamily: 'inherit',
            colors: {
                brandBackgroundColor: '#FFD200', // primary buttons, checkboxes, toggles, timeline
                primaryButtonTextColor: '#1A1A1A', // dark text on yellow for contrast
                primaryButtonHoverColor: '#E6B800',
                panelBackgroundColor: '#FFFFFF',
                dropdownMenuBackgroundColor: '#FFFFFF',
                inputBackgroundColor: '#FFFFFF',
                inputBorderColor: '#D9D9D9',
                inputFocusBorderColor: '#E6B800',
                canvasBackgroundColor: '#FFF9DB', // soft yellow behind the page
                highlightedElementsColor: '#FFF1A8',
                disabledElementsColor: '#B5B5B5',
                placeholderTextColor: '#8C8C8C',
                primaryTextColor: '#1A1A1A',
                secondaryTextColor: '#5C5C5C',
            },
        },
        css: {
            '--poc-font': "Roboto, 'Segoe UI', system-ui, -apple-system, sans-serif",
            '--poc-text': '#1A1A1A',
            '--poc-border': '#D9D9D9',
            '--poc-navbar-bg': '#FFFFFF', // top bar
            '--poc-navbar-border': '#FFF1A8',
            '--poc-button-bg': '#FFFFFF', // custom toolbar buttons
            '--poc-button-text': '#1A1A1A',
            '--poc-button-border': '#E6B800',
            '--poc-button-hover-bg': '#FFF1A8',
            '--poc-button-hover-text': '#1A1A1A',
            '--poc-accent': '#FFD200', // dropdown, toast and error accents
            '--poc-accent-strong': '#E6B800',
            '--poc-accent-soft': '#FFF1A8',
        },
    },

    // DHL corporate colours: DHL yellow #FFCC00 and DHL red #D40511.
    // DHL's own typeface ("Delivery") is licensed; Arial/Helvetica is the usual fallback.
    dhl: {
        studio: {
            fontFamily: 'inherit',
            colors: {
                brandBackgroundColor: '#D40511', // red primary buttons with white text, as on dhl.com
                primaryButtonTextColor: '#FFFFFF',
                primaryButtonHoverColor: '#A9040E',
                panelBackgroundColor: '#FFFFFF',
                dropdownMenuBackgroundColor: '#FFFFFF',
                inputBackgroundColor: '#FFFFFF',
                inputBorderColor: '#CCCCCC',
                inputFocusBorderColor: '#D40511',
                canvasBackgroundColor: '#F2F2F2', // neutral grey behind the page
                highlightedElementsColor: '#FFF0B3',
                disabledElementsColor: '#B2B2B2',
                placeholderTextColor: '#8C8C8C',
                primaryTextColor: '#1A1A1A',
                secondaryTextColor: '#666666',
            },
        },
        css: {
            '--poc-font': 'Delivery, Arial, Helvetica, sans-serif',
            '--poc-text': '#1A1A1A',
            '--poc-border': '#CCCCCC',
            '--poc-navbar-bg': '#FFCC00', // DHL yellow top bar
            '--poc-navbar-border': '#FFCC00',
            '--poc-button-bg': '#FFFFFF',
            '--poc-button-text': '#D40511',
            '--poc-button-border': '#D40511',
            '--poc-button-hover-bg': '#D40511',
            '--poc-button-hover-text': '#FFFFFF',
            '--poc-accent': '#D40511',
            '--poc-accent-strong': '#A9040E',
            '--poc-accent-soft': '#FFF0B3',
        },
    },
};

export function getTheme(name) {
    return themes[name] ?? themes.default;
}

// Applies the theme's CSS variables to the page.
export function applyPageTheme(name) {
    const theme = getTheme(name);
    document.documentElement.dataset.theme = themes[name] ? name : 'default';
    Object.entries(theme.css).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    return theme;
}
