(function() {
    const DEFAULT_FEATURE_COUNT = 5;
    const DEFAULT_STORAGE_QUOTA = '10 GB';
    let activeAnimationIds = [];

    const clearAnimations = () => {
        activeAnimationIds.forEach((id) => cancelAnimationFrame(id));
        activeAnimationIds = [];
    };

    const formatDateTime = (value) => {
        if (!value) {
            return '-';
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '-';
        }
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const animateNumber = (element, targetValue) => {
        if (!element) {
            return;
        }
        const numericTarget = typeof targetValue === 'number' ? targetValue : parseFloat(String(targetValue).replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numericTarget)) {
            element.textContent = String(targetValue);
            return;
        }

        const start = performance.now();
        const duration = 900;
        const startValue = 0;

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + eased * (numericTarget - startValue));
            element.textContent = current.toLocaleString('vi-VN');
            if (progress < 1) {
                const nextId = requestAnimationFrame(tick);
                activeAnimationIds.push(nextId);
            }
        };

        const initialId = requestAnimationFrame(tick);
        activeAnimationIds.push(initialId);
    };

    const readModuleCount = () => {
        const navItems = document.querySelectorAll('.nav-menu .nav-item');
        if (!navItems.length) {
            return 6;
        }
        let moduleCount = 0;
        navItems.forEach((item) => {
            if (!item.hasAttribute('target')) {
                moduleCount += 1;
            }
        });
        return moduleCount || navItems.length;
    };

    const updateMetaInfo = (root) => {
        const versionTarget = root.querySelector('[data-info="version"]');
        const lastUpdatedTarget = root.querySelector('[data-info="last-updated"]');

        if (versionTarget) {
            const version = window.APP_VERSION || versionTarget.textContent || 'v1.0.0';
            versionTarget.textContent = version;
        }

        if (lastUpdatedTarget) {
            const lastModified = document.lastModified || new Date().toISOString();
            lastUpdatedTarget.textContent = formatDateTime(lastModified);
        }
    };

    const updateStats = (root) => {
        const moduleCountTarget = root.querySelector('[data-info="module-count"]');
        const featureCountTarget = root.querySelector('[data-info="feature-count"]');
        const storageQuotaTarget = root.querySelector('[data-info="storage-quota"]');

        const moduleCount = readModuleCount();
        animateNumber(moduleCountTarget, moduleCount);
        animateNumber(featureCountTarget, DEFAULT_FEATURE_COUNT);

        if (storageQuotaTarget) {
            const quota = window.DEFAULT_STORAGE_QUOTA || DEFAULT_STORAGE_QUOTA;
            storageQuotaTarget.textContent = quota;
        }
    };

    window.initInfoPage = function initInfoPage() {
        clearAnimations();
        const root = document.querySelector('[data-page-root]');
        if (!root) {
            return;
        }
        updateMetaInfo(root);
        updateStats(root);
        root.classList.add('info-page--ready');
    };

    window.cleanupInfoPage = function cleanupInfoPage() {
        clearAnimations();
    };
})();
