// Auth Pages Translation System
(function () {
    'use strict';

    const STORAGE_KEY = 'beamshare_language';
    const DEFAULT_LANG = 'vi';
    const SUPPORTED_LANGS = ['vi', 'en'];

    let translations = {};
    let currentLang = DEFAULT_LANG;

    // Get saved language or default
    function getSavedLanguage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && SUPPORTED_LANGS.includes(saved)) {
                return saved;
            }
        } catch (e) {
            console.warn('Cannot access localStorage:', e);
        }
        return DEFAULT_LANG;
    }

    // Save language preference to localStorage and cookie
    function saveLanguage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
            // Also set a cookie for server-side language detection
            document.cookie = `${STORAGE_KEY}=${lang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
        } catch (e) {
            console.warn('Cannot save language preference:', e);
        }
    }

    // Load translation file
    async function loadTranslations(lang) {
        const file = lang === 'vi' ? 'viet.json' : 'eng.json';
        try {
            const response = await fetch(`/modules/translate/${file}`);
            if (!response.ok) throw new Error('Failed to load translations');
            return await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            return null;
        }
    }

    // Get nested translation value
    function getTranslation(key, data = translations) {
        const keys = key.split('.');
        let value = data;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return null;
            }
        }
        return typeof value === 'string' ? value : null;
    }

    // Apply translations to page
    function applyTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = getTranslation(key);
            if (text) {
                el.textContent = text;
            }
        });

        // Update placeholders with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = getTranslation(key);
            if (text) {
                el.setAttribute('placeholder', text);
            }
        });

        // Update aria-labels with data-i18n-aria
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const text = getTranslation(key);
            if (text) {
                el.setAttribute('aria-label', text);
            }
        });

        // Update page title
        const pageType = document.querySelector('[data-page]')?.getAttribute('data-page');
        if (pageType) {
            const titleKey = {
                'login': 'auth.login.title',
                'register': 'auth.register.title',
                'forgot': 'auth.forgotPassword.title',
                'reset': 'auth.resetPassword.title'
            }[pageType];
            if (titleKey) {
                const title = getTranslation(titleKey);
                if (title) {
                    document.title = `BeamShare - ${title}`;
                }
            }
        }

        // Update HTML lang attribute
        document.documentElement.lang = currentLang === 'vi' ? 'vi' : 'en';

        // Update language toggle button text
        updateLanguageToggle();
    }

    // Update language toggle button
    function updateLanguageToggle() {
        const langLabel = document.getElementById('langLabel');
        const langOptions = document.querySelectorAll('.lang-option');

        if (langLabel) {
            langLabel.textContent = currentLang === 'vi' ? 'VI' : 'EN';
        }

        langOptions.forEach(option => {
            const optionLang = option.getAttribute('data-lang');
            option.classList.toggle('is-active', optionLang === currentLang);
            option.setAttribute('aria-checked', optionLang === currentLang);
        });
    }

    // Switch language
    async function switchLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) {
            return;
        }

        const newTranslations = await loadTranslations(lang);
        if (newTranslations) {
            translations = newTranslations;
            currentLang = lang;
            saveLanguage(lang);
            applyTranslations();
        }
    }

    // Setup language toggle UI
    function setupLanguageToggle() {
        const wrapper = document.getElementById('langWrapper');
        const toggle = document.getElementById('langToggle');
        const menu = document.getElementById('langMenu');

        if (!toggle || !menu) return;

        // Toggle menu
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen);
        });

        // Handle language selection
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.lang-option');
            if (option) {
                const lang = option.getAttribute('data-lang');
                switchLanguage(lang);
                wrapper.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && wrapper.classList.contains('is-open')) {
                wrapper.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Initialize
    async function init() {
        currentLang = getSavedLanguage();
        translations = await loadTranslations(currentLang);

        // Sync cookie with localStorage on init
        saveLanguage(currentLang);

        if (translations) {
            applyTranslations();
        }

        setupLanguageToggle();
    }

    // Expose for external use
    window.authTranslate = {
        t: (key) => getTranslation(key) || key,
        switchLanguage,
        getCurrentLang: () => currentLang
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
