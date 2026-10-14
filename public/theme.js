// White & yellow theme for Studio UI.
// Passed to Studio UI as `uiOptions.theme`; see the "uiOptions, theme" section of the Studio UI advanced integration guide.
export const YELLOW = '#FFD200';
export const YELLOW_DARK = '#E6B800';

export const theme = {
    fontFamily: 'inherit',
    colors: {
        brandBackgroundColor: YELLOW, // primary buttons, checkboxes, toggles, timeline
        primaryButtonTextColor: '#1A1A1A', // dark text on yellow for contrast
        primaryButtonHoverColor: YELLOW_DARK,
        panelBackgroundColor: '#FFFFFF',
        dropdownMenuBackgroundColor: '#FFFFFF',
        inputBackgroundColor: '#FFFFFF',
        inputBorderColor: '#D9D9D9',
        inputFocusBorderColor: YELLOW_DARK,
        canvasBackgroundColor: '#FFF9DB', // soft yellow behind the page
        highlightedElementsColor: '#FFF1A8',
        disabledElementsColor: '#B5B5B5',
        placeholderTextColor: '#8C8C8C',
        primaryTextColor: '#1A1A1A',
        secondaryTextColor: '#5C5C5C',
    },
};
