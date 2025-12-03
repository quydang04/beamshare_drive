'use strict';

(function initLogoutModule(globalScope) {
    if (!globalScope) {
        return;
    }

    const LOGOUT_ENDPOINT = '/api/auth/logout';

    const t = (key, fallback = '') => {
        const lang = globalScope.LanguageManager;
        if (lang && typeof lang.translate === 'function') {
            return lang.translate(key) || fallback;
        }
        return fallback;
    };

    async function callLogoutApi(fetchImpl) {
        const fetchFn = typeof fetchImpl === 'function' ? fetchImpl : globalScope.fetch;
        if (typeof fetchFn !== 'function') {
            throw new Error('Fetch API is not available.');
        }

        const response = await fetchFn(LOGOUT_ENDPOINT, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Logout failed with status ${response.status}`);
        }

        return response.json().catch(() => ({}));
    }

    async function performLogout(options = {}) {
        const {
            origin = 'sidebar',
            triggerButton = null,
            labelElement = null,
            defaultLabelText = '',
            toastSystem = globalScope.toastSystem,
            fetchImpl = globalScope.fetch,
            onSuccess
        } = options;

        if (triggerButton && triggerButton.disabled) {
            return;
        }

        if (triggerButton) {
            triggerButton.disabled = true;
            triggerButton.setAttribute('aria-busy', 'true');
        }

        const inProgressText = t('info.logout.inProgress', 'Đang đăng xuất...');
        if (labelElement) {
            labelElement.textContent = inProgressText;
        } else if (origin === 'menu' && toastSystem && typeof toastSystem.info === 'function') {
            toastSystem.info(inProgressText, { duration: 2000 });
        }

        let logoutSucceeded = false;

        try {
            await callLogoutApi(fetchImpl);
            logoutSucceeded = true;
            if (typeof onSuccess === 'function') {
                onSuccess();
            }
        } catch (error) {
            console.error(t('info.logout.errorLog', 'Đăng xuất thất bại:'), error);
            if (toastSystem && typeof toastSystem.error === 'function') {
                toastSystem.error(t('info.logout.errorToast', 'Không thể đăng xuất. Vui lòng thử lại.'), { duration: 3200 });
            }
            throw error;
        } finally {
            if (!logoutSucceeded) {
                if (labelElement) {
                    labelElement.textContent = defaultLabelText || '';
                }
                if (triggerButton) {
                    triggerButton.disabled = false;
                    triggerButton.removeAttribute('aria-busy');
                }
            }
        }
    }

    globalScope.logoutModule = {
        performLogout
    };
})(typeof window !== 'undefined' ? window : undefined);
