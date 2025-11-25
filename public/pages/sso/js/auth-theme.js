// Theme sync for auth pages
// Syncs with main app theme from localStorage
(function() {
    const STORAGE_KEY = 'beamshare-theme';
    const html = document.documentElement;

    // Get system preference
    const getSystemTheme = () => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Resolve theme (handle 'system' mode)
    const resolveTheme = (mode) => {
        if (mode === 'system') {
            return getSystemTheme();
        }
        return mode === 'dark' ? 'dark' : 'light';
    };

    // Get label for mode
    const getLabel = (mode) => {
        const labels = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' };
        return labels[mode] || 'Sáng';
    };

    // Get icon class for mode
    const getIcon = (mode) => {
        const icons = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-desktop' };
        return icons[mode] || 'fa-sun';
    };

    // Update toggle button UI
    const updateToggleUI = (mode) => {
        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        const options = document.querySelectorAll('.theme-option');

        if (icon) {
            icon.className = `fas ${getIcon(mode)} theme-toggle__icon`;
        }
        if (label) {
            label.textContent = getLabel(mode);
        }

        options.forEach(opt => {
            const optTheme = opt.getAttribute('data-theme-option');
            opt.classList.toggle('is-active', optTheme === mode);
            opt.setAttribute('aria-checked', optTheme === mode ? 'true' : 'false');
        });
    };

    // Apply theme to page
    const applyTheme = (mode, persist = false) => {
        const effective = resolveTheme(mode);
        html.setAttribute('data-theme', effective);
        html.setAttribute('data-theme-mode', mode);
        
        if (document.body) {
            document.body.setAttribute('data-theme', effective);
        }

        updateToggleUI(mode);

        if (persist) {
            saveTheme(mode);
        }
    };

    // Save theme preference
    const saveTheme = (mode) => {
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch (e) {
            console.warn('Unable to save theme preference:', e);
        }
    };

    // Get stored theme
    const getStoredTheme = () => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    };

    // Initialize theme on page load (before DOM ready)
    const initTheme = () => {
        const stored = getStoredTheme();
        const initial = stored || 'system';
        applyTheme(initial, false);
    };

    // Run immediately to prevent flash
    initTheme();

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const currentMode = html.getAttribute('data-theme-mode') || 'system';
            if (currentMode === 'system') {
                applyTheme('system', false);
            }
        });
    }

    // Setup dropdown after DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.getElementById('themeWrapper');
        const toggleBtn = document.getElementById('themeToggle');
        const menu = document.getElementById('themeMenu');
        const options = document.querySelectorAll('.theme-option');

        // Open/close menu
        const openMenu = () => {
            wrapper?.classList.add('is-open');
        };

        const closeMenu = () => {
            wrapper?.classList.remove('is-open');
        };

        const toggleMenu = () => {
            if (wrapper?.classList.contains('is-open')) {
                closeMenu();
            } else {
                openMenu();
            }
        };

        // Toggle button click
        toggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        // Option clicks - use data-theme-option attribute like dashboard
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = opt.getAttribute('data-theme-option');
                if (theme) {
                    applyTheme(theme, true);
                    closeMenu();
                }
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper?.contains(e.target)) {
                closeMenu();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });

        // Re-apply theme after DOM ready
        const stored = getStoredTheme();
        const initial = stored || 'system';
        applyTheme(initial, false);
    });
})();
