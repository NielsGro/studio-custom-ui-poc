// Injects custom buttons into the Studio UI top toolbar (navbar).
//
// Studio UI has no API for custom toolbar items, so the buttons are added to its navbar <ul> as an
// extra <li>. Studio UI is a React app that can re-render the navbar, so a MutationObserver puts the
// buttons back whenever they disappear.

const NAVBAR_LIST_SELECTOR = 'nav[data-id*="navbar"] > ul, nav[data-testid*="navbar"] > ul';
const TOOLBAR_ID = 'poc-custom-toolbar';

let unmountPrevious = null;

const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
    frame: svg('<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 8v8M8 12h8"/>'),
    variable: svg(
        '<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3"/><path d="M10 9l4 6M14 9l-4 6"/>',
    ),
    text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
    chevron: svg('<path d="M6 9l6 6 6-6"/>'),
};

function makeButton(className, { label, icon }) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.innerHTML = `${ICONS[icon] ?? ''}<span class="${className}-label">${label}</span>`;
    return el;
}

/**
 * @typedef {{ id: string, label: string, icon: string, onClick: () => Promise<void> }} Action
 * @typedef {Action | { id: string, label: string, icon: string, items: Action[] }} ToolbarEntry
 *
 * @param {HTMLElement} container element Studio UI is rendered into
 * @param {ToolbarEntry[]} entries plain buttons, or buttons with `items` that open a dropdown menu on hover
 * @returns {{ setEnabled: (enabled: boolean) => void }}
 */
export function mountToolbar(container, entries) {
    let enabled = false;
    let busy = false;
    const controls = [];

    const item = document.createElement('li');
    item.id = TOOLBAR_ID;
    item.className = 'poc-toolbar';
    item.setAttribute('aria-label', 'Custom actions');

    const refresh = () => controls.forEach((el) => (el.disabled = !enabled || busy));

    // Runs one action at a time; all custom controls are disabled while it runs.
    const run = async (action) => {
        busy = true;
        refresh();
        try {
            await action.onClick();
        } finally {
            busy = false;
            refresh();
        }
    };

    entries.forEach((entry) => {
        if (!entry.items) {
            const button = makeButton('poc-toolbar__button', entry);
            button.dataset.pocAction = entry.id;
            button.title = entry.label;
            button.addEventListener('click', () => run(entry));
            controls.push(button);
            item.appendChild(button);
            return;
        }

        // Dropdown: opens on hover, on keyboard focus, and on click (for touch screens).
        const wrapper = document.createElement('div');
        wrapper.className = 'poc-dropdown';

        const trigger = makeButton('poc-toolbar__button', entry);
        trigger.dataset.pocAction = entry.id;
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.insertAdjacentHTML('beforeend', `<span class="poc-dropdown__chevron">${ICONS.chevron}</span>`);

        const menu = document.createElement('div');
        menu.className = 'poc-dropdown__menu';
        menu.setAttribute('role', 'menu');

        const setOpen = (open) => {
            const isOpen = open && enabled && !busy;
            wrapper.classList.toggle('poc-dropdown--open', isOpen);
            trigger.setAttribute('aria-expanded', String(isOpen));
        };

        entry.items.forEach((action) => {
            const option = makeButton('poc-dropdown__item', action);
            option.setAttribute('role', 'menuitem');
            option.dataset.pocAction = action.id;
            option.addEventListener('click', () => {
                setOpen(false);
                run(action);
            });
            controls.push(option);
            menu.appendChild(option);
        });

        wrapper.addEventListener('mouseenter', () => setOpen(true));
        wrapper.addEventListener('mouseleave', () => setOpen(false));
        wrapper.addEventListener('focusin', () => setOpen(true));
        wrapper.addEventListener('focusout', (e) => {
            if (!wrapper.contains(e.relatedTarget)) setOpen(false);
        });
        wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                trigger.focus();
            }
        });
        trigger.addEventListener('click', () => setOpen(!wrapper.classList.contains('poc-dropdown--open')));

        controls.push(trigger);
        wrapper.append(trigger, menu);
        item.appendChild(wrapper);
    });

    const inject = () => {
        if (item.isConnected) return;
        const list = container.querySelector(NAVBAR_LIST_SELECTOR);
        // Prepend: keeps the custom buttons on the left, Studio's own controls stay on the right.
        if (list) list.prepend(item);
    };

    // Mounting again replaces the earlier toolbar instead of adding a second one.
    unmountPrevious?.();
    const observer = new MutationObserver(inject);
    unmountPrevious = () => {
        observer.disconnect();
        item.remove();
    };
    observer.observe(container, { childList: true, subtree: true });
    inject();

    const setEnabled = (value) => {
        enabled = value;
        refresh();
    };
    setEnabled(false);

    return { setEnabled };
}
