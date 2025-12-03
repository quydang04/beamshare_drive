/**
 * BeamShare i18n (Internationalization) Engine
 * Centralized translation system for backend services
 */

const fs = require('fs');
const path = require('path');

// Cache for loaded translations
let translationsCache = {
    vi: null,
    en: null
};

const SUPPORTED_LANGS = ['vi', 'en'];
const DEFAULT_LANG = 'vi';

/**
 * Load translations from JSON file
 * @param {string} lang - Language code ('vi' or 'en')
 * @returns {object} - Translations object
 */
function loadTranslations(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) {
        lang = DEFAULT_LANG;
    }

    // Return cached if available
    if (translationsCache[lang]) {
        return translationsCache[lang];
    }

    const filename = lang === 'vi' ? 'viet.json' : 'eng.json';
    const filePath = path.join(__dirname, filename);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        translationsCache[lang] = JSON.parse(content);
        return translationsCache[lang];
    } catch (error) {
        console.error(`Failed to load translations for ${lang}:`, error.message);
        return {};
    }
}

/**
 * Clear translation cache (useful for development/hot-reload)
 */
function clearCache() {
    translationsCache = { vi: null, en: null };
}

/**
 * Get nested value from object using dot notation key
 * @param {object} obj - Object to search
 * @param {string} key - Dot notation key (e.g., 'auth.messages.loginSuccess')
 * @returns {string|null} - Value or null if not found
 */
function getNestedValue(obj, key) {
    if (!obj || !key) return null;
    
    const keys = key.split('.');
    let value = obj;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return null;
        }
    }
    
    return typeof value === 'string' ? value : null;
}

/**
 * Get translation by key
 * @param {string} lang - Language code
 * @param {string} key - Translation key (dot notation)
 * @param {string} [fallback] - Fallback value if key not found
 * @returns {string} - Translated text
 */
function t(lang, key, fallback = '') {
    const translations = loadTranslations(lang);
    const value = getNestedValue(translations, key);
    
    if (value) {
        return value;
    }
    
    // Try fallback language
    if (lang !== DEFAULT_LANG) {
        const fallbackTranslations = loadTranslations(DEFAULT_LANG);
        const fallbackValue = getNestedValue(fallbackTranslations, key);
        if (fallbackValue) {
            return fallbackValue;
        }
    }
    
    return fallback || key;
}

/**
 * Extract language from Express request
 * Priority: body.lang > query.lang > cookie > Accept-Language header > default
 * @param {object} req - Express request object
 * @returns {string} - Language code
 */
function getLangFromRequest(req) {
    // Check body
    const bodyLang = req.body?.lang;
    if (bodyLang && SUPPORTED_LANGS.includes(bodyLang)) {
        return bodyLang;
    }

    // Check query
    const queryLang = req.query?.lang;
    if (queryLang && SUPPORTED_LANGS.includes(queryLang)) {
        return queryLang;
    }

    // Check cookie
    const cookieLang = req.cookies?.beamshare_language;
    if (cookieLang && SUPPORTED_LANGS.includes(cookieLang)) {
        return cookieLang;
    }

    // Check Accept-Language header
    const acceptLang = req.headers?.['accept-language'];
    if (acceptLang) {
        const primary = acceptLang.split(',')[0]?.toLowerCase();
        if (primary?.startsWith('en')) {
            return 'en';
        }
        if (primary?.startsWith('vi')) {
            return 'vi';
        }
    }

    return DEFAULT_LANG;
}

/**
 * Create a translator function bound to a specific language
 * @param {string} lang - Language code
 * @returns {function} - Translator function
 */
function createTranslator(lang) {
    return (key, fallback) => t(lang, key, fallback);
}

/**
 * Replace placeholders in translation string
 * @param {string} text - Text with placeholders like {{name}}
 * @param {object} params - Object with values to replace
 * @returns {string} - Text with replaced placeholders
 */
function interpolate(text, params = {}) {
    if (!text || typeof text !== 'string') return text;
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return params.hasOwnProperty(key) ? params[key] : match;
    });
}

module.exports = {
    t,
    getLangFromRequest,
    loadTranslations,
    createTranslator,
    interpolate,
    clearCache,
    SUPPORTED_LANGS,
    DEFAULT_LANG
};
