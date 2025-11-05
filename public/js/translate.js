// Translation utilities and language manager setup
(function() {
    const LanguageManager = (() => {
        const STORAGE_KEY = 'beamshare:language';
        const LANGUAGE_FILES = {
            vi: '/modules/translate/viet.json',
            en: '/modules/translate/eng.json'
        };
        const DEFAULT_LANGUAGE = 'vi';
        const LOCALE_MAP = {
            vi: 'vi-VN',
            en: 'en-US'
        };
        const caches = {};
        let translations = {};
        let fallbackTranslations = {};
        let currentLanguage = DEFAULT_LANGUAGE;
        let initPromise = null;

        function normalizeLanguage(language) {
            if (!language) {
                return DEFAULT_LANGUAGE;
            }
            const lower = String(language).trim().toLowerCase();
            if (lower.startsWith('en')) {
                return 'en';
            }
            if (lower.startsWith('vi')) {
                return 'vi';
            }
            return DEFAULT_LANGUAGE;
        }

        async function fetchLanguage(language) {
            const normalized = normalizeLanguage(language);
            if (!LANGUAGE_FILES[normalized]) {
                return {};
            }
            if (!caches[normalized]) {
                caches[normalized] = fetch(LANGUAGE_FILES[normalized], {
                    credentials: 'same-origin'
                })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Failed to load language ${normalized} (${response.status})`);
                        }
                        return response.json();
                    })
                    .catch((error) => {
                        console.error('Failed to load language pack:', normalized, error);
                        return {};
                    });
            }
            return caches[normalized];
        }

        function getValueByPath(source, path) {
            if (!source || !path) {
                return undefined;
            }
            const segments = path.split('.');
            let cursor = source;
            for (const segment of segments) {
                if (cursor && Object.prototype.hasOwnProperty.call(cursor, segment)) {
                    cursor = cursor[segment];
                } else {
                    return undefined;
                }
            }
            return cursor;
        }

        function interpolate(template, params = {}) {
            if (typeof template !== 'string') {
                return template;
            }
            return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
                if (Object.prototype.hasOwnProperty.call(params, key)) {
                    const value = params[key];
                    return value == null ? '' : String(value);
                }
                return '';
            });
        }

        function parseOptions(optionText) {
            if (!optionText) {
                return {};
            }
            try {
                return JSON.parse(optionText);
            } catch (_error) {
                return {};
            }
        }

        function translate(key, params = {}) {
            if (!key) {
                return '';
            }

            const fromCurrent = getValueByPath(translations, key);
            let template = typeof fromCurrent === 'string' ? fromCurrent : fromCurrent?.toString?.() ?? undefined;

            if (template == null && currentLanguage !== DEFAULT_LANGUAGE) {
                const fromFallback = getValueByPath(fallbackTranslations, key);
                template = typeof fromFallback === 'string' ? fromFallback : fromFallback?.toString?.() ?? undefined;
            }

            if (template == null) {
                return interpolate(key, params);
            }

            return interpolate(template, params);
        }

        function applyTranslations(root = document) {
            if (!root) {
                return;
            }

            const elements = [];
            if (root instanceof Element || root instanceof DocumentFragment) {
                if (root instanceof Element && root.hasAttribute('data-i18n')) {
                    elements.push(root);
                }
                root.querySelectorAll?.('[data-i18n]').forEach((node) => {
                    elements.push(node);
                });
            } else {
                document.querySelectorAll('[data-i18n]').forEach((node) => {
                    elements.push(node);
                });
            }

            elements.forEach((element) => {
                const key = element.getAttribute('data-i18n');
                if (!key) {
                    return;
                }

                const options = parseOptions(element.getAttribute('data-i18n-options'));
                const text = translate(key, options);

                const attrListRaw = element.getAttribute('data-i18n-attr');
                if (attrListRaw) {
                    const attrs = attrListRaw.split(',').map((attr) => attr.trim()).filter(Boolean);
                    attrs.forEach((attr) => {
                        element.setAttribute(attr, text);
                    });
                    return;
                }

                if (element.getAttribute('data-i18n-html') === 'true') {
                    element.innerHTML = text;
                    return;
                }

                element.textContent = text;
            });
        }

        async function setLanguage(language, options = {}) {
            const target = normalizeLanguage(language);
            const [langMessages, fallbackMessages] = await Promise.all([
                fetchLanguage(target),
                fetchLanguage(DEFAULT_LANGUAGE)
            ]);

            translations = langMessages || {};
            fallbackTranslations = fallbackMessages || {};
            currentLanguage = target;

            try {
                localStorage.setItem(STORAGE_KEY, target);
            } catch (_error) {
                // Ignore storage failures
            }

            const locale = LOCALE_MAP[target] || target;
            document.documentElement.setAttribute('lang', locale);

            applyTranslations(options.root || document);

            document.dispatchEvent(new CustomEvent('language:changed', {
                detail: { language: target }
            }));

            return target;
        }

        async function init() {
            if (initPromise) {
                return initPromise;
            }

            const stored = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
            const preferred = stored || normalizeLanguage(document.documentElement.getAttribute('lang'));

            initPromise = setLanguage(preferred).catch(async () => {
                if (preferred !== DEFAULT_LANGUAGE) {
                    return setLanguage(DEFAULT_LANGUAGE);
                }
                return DEFAULT_LANGUAGE;
            });

            return initPromise;
        }

        function getLanguage() {
            return currentLanguage;
        }

        function getLocale() {
            return LOCALE_MAP[currentLanguage] || 'vi-VN';
        }

        function formatNumber(value, options = {}) {
            try {
                return new Intl.NumberFormat(getLocale(), options).format(value);
            } catch (_error) {
                return typeof value === 'number' ? value.toString() : String(value || '');
            }
        }

        function formatDate(dateValue, options = {}) {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            const formatOptions = Object.keys(options).length ? options : {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            };
            try {
                return new Intl.DateTimeFormat(getLocale(), formatOptions).format(date);
            } catch (_error) {
                return date.toLocaleDateString();
            }
        }

        function formatDateTime(dateValue, options = {}) {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            const formatOptions = Object.keys(options).length ? options : {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            try {
                return new Intl.DateTimeFormat(getLocale(), formatOptions).format(date);
            } catch (_error) {
                return date.toLocaleString();
            }
        }

        function formatRelativeTime(dateValue) {
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
            if (Number.isNaN(date.getTime())) {
                return '';
            }

            const now = new Date();
            const diff = date.getTime() - now.getTime();
            const absDiff = Math.abs(diff);

            const DIVISIONS = [
                { amount: 60, unit: 'second' },
                { amount: 60, unit: 'minute' },
                { amount: 24, unit: 'hour' },
                { amount: 7, unit: 'day' },
                { amount: 4.34524, unit: 'week' },
                { amount: 12, unit: 'month' },
                { amount: Number.POSITIVE_INFINITY, unit: 'year' }
            ];

            let duration = absDiff / 1000;
            let unit = 'second';

            for (const division of DIVISIONS) {
                if (duration < division.amount) {
                    unit = division.unit;
                    break;
                }
                duration /= division.amount;
            }

            const value = Math.round(duration) * Math.sign(diff);

            try {
                return new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(value, unit);
            } catch (_error) {
                return date.toLocaleString();
            }
        }

        function assignTranslation(element, key, params = {}, options = {}) {
            if (!element || !key) {
                return;
            }
            element.setAttribute('data-i18n', key);
            if (params && Object.keys(params).length) {
                element.setAttribute('data-i18n-options', JSON.stringify(params));
            } else {
                element.removeAttribute('data-i18n-options');
            }
            if (options.attr) {
                const attrValue = Array.isArray(options.attr) ? options.attr.join(',') : String(options.attr);
                element.setAttribute('data-i18n-attr', attrValue);
            }
            if (options.html === true) {
                element.setAttribute('data-i18n-html', 'true');
            } else if (options.html === false) {
                element.removeAttribute('data-i18n-html');
            }
            applyTranslations(element);
        }

        function updateTranslationParams(element, params = {}) {
            if (!element || !element.dataset || !element.dataset.i18n) {
                return;
            }
            if (params && Object.keys(params).length) {
                element.dataset.i18nOptions = JSON.stringify(params);
            } else {
                delete element.dataset.i18nOptions;
            }
            applyTranslations(element);
        }

        return {
            init,
            setLanguage,
            getLanguage,
            applyTranslations,
            t: translate,
            formatNumber,
            formatDate,
            formatDateTime,
            formatRelativeTime,
            getLocale,
            assignTranslation,
            updateTranslationParams
        };
    })();

    window.i18n = LanguageManager;

    const readyPromise = new Promise((resolve) => {
        async function initialiseLanguage() {
            try {
                await LanguageManager.init();
                LanguageManager.applyTranslations(document);
            } catch (error) {
                console.error('Language initialisation failed:', error);
            } finally {
                resolve();
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialiseLanguage, { once: true });
        } else {
            initialiseLanguage();
        }
    });

    window.i18nReady = readyPromise;

    window.addEventListener('storage', (event) => {
        if (!event || event.key !== 'beamshare:language') {
            return;
        }

        const nextLanguage = event.newValue;
        if (!nextLanguage || !window.i18n || typeof window.i18n.setLanguage !== 'function') {
            return;
        }

        if (typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === nextLanguage) {
            return;
        }

        try {
            window.i18n.setLanguage(nextLanguage).catch((error) => {
                console.error('Language sync failed:', error);
            });
        } catch (error) {
            console.error('Failed to sync language preference:', error);
        }
    });
})();
