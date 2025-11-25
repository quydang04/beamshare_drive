// Theme toggling and persistence (light / dark / system)
(function () {
    const STORAGE_KEY = 'beamshare-theme';
    const SUPPORTED = ['light', 'dark', 'system'];
    const root = document.documentElement;
    let hasManualPreference = false;

    const t = (key) => {
        try {
            if (window.i18n && typeof window.i18n.t === 'function') {
                const translated = window.i18n.t(key);
                if (translated && translated !== key) {
                    return translated;
                }
            }
        } catch (_error) {
            // ignore
        }
        return key;
    };

    const normalise = (value) => (SUPPORTED.includes(value) ? value : 'light');

    const getStoredTheme = () => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to read saved theme:', error);
            return null;
        }
    };

    const saveTheme = (theme) => {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
            hasManualPreference = true;
        } catch (error) {
            console.warn('Unable to persist theme:', error);
        }
    };

    const getSystemTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const resolveTheme = (mode) => (mode === 'system' ? getSystemTheme() : mode);

    const getLabelText = (mode) => {
        if (mode === 'system') {
            return t('theme.system');
        }
        if (mode === 'dark') {
            return t('theme.dark');
        }
        return t('theme.light');
    };

    const updateToggleUi = (mode) => {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        const icon = toggle.querySelector('.theme-toggle__icon');
        const label = toggle.querySelector('.theme-toggle__label');
        const isDark = resolveTheme(mode) === 'dark';

        const labelText = getLabelText(mode);
        const iconClass = mode === 'system' ? 'fa-desktop' : (isDark ? 'fa-moon' : 'fa-sun');

        toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        toggle.dataset.theme = mode;

        if (icon) {
            icon.className = `fas ${iconClass} theme-toggle__icon`;
        }
        if (label) {
            label.textContent = labelText;
        }

        const options = document.querySelectorAll('.theme-option');
        options.forEach((option) => {
            const optValue = option.getAttribute('data-theme-option');
            option.classList.toggle('is-active', optValue === mode);
            option.setAttribute('aria-checked', optValue === mode ? 'true' : 'false');
            const textNode = option.querySelector('span');
            if (textNode) {
                textNode.textContent = getLabelText(optValue);
            }
            const optIcon = option.querySelector('i');
            if (optIcon) {
                const optIsDark = resolveTheme(optValue) === 'dark';
                const cls = optValue === 'system' ? 'fa-desktop' : (optIsDark ? 'fa-moon' : 'fa-sun');
                optIcon.className = `fas ${cls}`;
            }
        });

        const toggleText = document.getElementById('theme-toggle-text');
        if (toggleText) {
            toggleText.textContent = labelText;
        }
    };

    const applyTheme = (mode, { persist } = { persist: false }) => {
        const currentMode = normalise(mode);
        const effective = resolveTheme(currentMode);
        root.setAttribute('data-theme', effective);
        root.setAttribute('data-theme-mode', currentMode);
        if (document.body) {
            document.body.setAttribute('data-theme', effective);
            document.body.setAttribute('data-theme-mode', currentMode);
        }
        root.style.colorScheme = effective;

        if (persist) {
            saveTheme(currentMode);
        }

        updateToggleUi(currentMode);
        document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: effective, mode: currentMode } }));
    };

    const initTheme = () => {
        const stored = getStoredTheme();
        const initial = normalise(stored || 'system');
        hasManualPreference = Boolean(stored);
        applyTheme(initial, { persist: Boolean(stored) });

        const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = () => {
            const currentMode = root.getAttribute('data-theme-mode') || initial;
            if (currentMode !== 'system') {
                return;
            }
            applyTheme(currentMode, { persist: false });
        };

        if (mediaQuery) {
            if (typeof mediaQuery.addEventListener === 'function') {
                mediaQuery.addEventListener('change', handleSystemChange);
            } else if (typeof mediaQuery.addListener === 'function') {
                mediaQuery.addListener(handleSystemChange);
            }
        }
    };

    initTheme();

    const refreshLabels = () => {
        const mode = normalise(root.getAttribute('data-theme-mode') || root.getAttribute('data-theme'));
        updateToggleUi(mode);
    };

    if (window.i18nReady && typeof window.i18nReady.then === 'function') {
        window.i18nReady.then(refreshLabels).catch(() => {
            refreshLabels();
        });
    }

    // Function to close theme menu
    function closeThemeMenu() {
        const menu = document.querySelector('.theme-menu');
        const wrapper = document.querySelector('.theme-toggle-wrapper');
        menu?.classList.remove('is-open');
        wrapper?.classList.remove('is-open');
    }

    // Function to open theme menu
    function openThemeMenu() {
        const menu = document.querySelector('.theme-menu');
        const wrapper = document.querySelector('.theme-toggle-wrapper');
        wrapper?.classList.add('is-open');
        menu?.classList.add('is-open');
        
        // Dispatch event to notify other menus to close
        document.dispatchEvent(new CustomEvent('menu:opened', { detail: { menuId: 'theme-menu' } }));
    }

    // Expose close function globally for other scripts
    window.closeThemeMenu = closeThemeMenu;

    document.addEventListener('DOMContentLoaded', () => {
        updateToggleUi(normalise(root.getAttribute('data-theme-mode') || root.getAttribute('data-theme')));

        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                const wrapper = toggle.closest('.theme-toggle-wrapper');
                const isOpen = wrapper?.classList.contains('is-open');
                
                if (isOpen) {
                    closeThemeMenu();
                } else {
                    openThemeMenu();
                }
            });
        }

        const options = document.querySelectorAll('.theme-option');
        options.forEach((option) => {
            option.addEventListener('click', (event) => {
                event.stopPropagation();
                const value = option.getAttribute('data-theme-option');
                if (!value) return;
                applyTheme(normalise(value), { persist: true });
                
                // Close menu after selection
                closeThemeMenu();
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            const wrapper = document.querySelector('.theme-toggle-wrapper');
            if (!wrapper) return;
            const isInside = wrapper.contains(event.target);
            if (!isInside) {
                closeThemeMenu();
            }
        });

        // Close menu when pressing Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeThemeMenu();
            }
        });

        // Listen for other menus opening and close this one
        document.addEventListener('menu:opened', (event) => {
            if (event.detail?.menuId !== 'theme-menu') {
                closeThemeMenu();
            }
        });
    });

    document.addEventListener('language:changed', refreshLabels);
})();
