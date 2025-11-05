(() => {
    const state = {
        overview: null
    };

    const i18nApi = window.i18n || null;

    function translate(key, params = {}, fallback) {
        if (i18nApi && typeof i18nApi.t === 'function') {
            try {
                const result = i18nApi.t(key, params);
                if (typeof result === 'string' && result !== key) {
                    return result;
                }
            } catch (error) {
                console.warn('Subscription translation failed for key:', key, error);
            }
        }

        if (typeof fallback === 'function') {
            return fallback(params || {});
        }

        if (typeof fallback === 'string') {
            return fallback.replace(/\{\{(\w+)\}\}/g, (_match, paramKey) => {
                if (Object.prototype.hasOwnProperty.call(params || {}, paramKey)) {
                    const value = params[paramKey];
                    return value == null ? '' : String(value);
                }
                return '';
            });
        }

        return key;
    }

    const runtime = (suffix, params = {}, fallback) => translate(`pages.subscription.runtime.${suffix}`, params, fallback);

    const BYTES_IN_GIB = 1024 * 1024 * 1024;

    const PLAN_DEFAULTS = {
        basic: {
            id: 'basic',
            title: 'Basic',
            currency: 'VND',
            storageBytes: 5 * BYTES_IN_GIB,
            storageLabel: '5 GB',
            beamshareFileSizeBytes: 200 * 1024 * 1024
        },
        premium: {
            id: 'premium',
            title: 'Premium',
            currency: 'VND',
            storageBytes: 15 * BYTES_IN_GIB,
            storageLabel: '15 GB',
            beamshareFileSizeBytes: null
        }
    };

    const selectors = {
        planCards: '[data-plan]',
        planPrice: '[data-plan-price]',
        planStorage: '[data-plan-storage]',
        planBeamshare: '[data-plan-beamshare]',
        usageProgress: '[data-usage-progress]',
        usageText: '[data-usage-text]',
        currentPlan: '[data-current-plan]',
        beamshareSummary: '[data-beamshare-summary]',
        upgradeButton: '[data-action="upgrade"]',
        switchPlanButtons: '[data-action="switch-plan"]',
        beamshareBasicSends: '[data-beamshare-basic-sends]',
        beamshareBasicFileSize: '[data-beamshare-basic-filesize]',
        beamsharePremiumSends: '[data-beamshare-premium-sends]',
        beamsharePremiumFileSize: '[data-beamshare-premium-filesize]'
    };

    const elements = {
        get plansContainer() {
            return document.querySelector('[data-subscription="plans"]');
        },
        get usageCard() {
            return document.querySelector('[data-subscription="usage"]');
        },
        get beamshareTable() {
            return document.querySelector('[data-subscription="beamshare-table"]');
        }
    };

    function shouldUseProvidedLabel(label) {
        if (!label) {
            return false;
        }
        if (!i18nApi || typeof i18nApi.getLanguage !== 'function') {
            return true;
        }
        const language = i18nApi.getLanguage();
        if (language === 'en') {
            return /^[\x00-\x7F]+$/.test(label);
        }
        return true;
    }

    function formatPlanStorageLabel(amount) {
        return runtime('storageLabel', { amount }, (params) => {
            const value = params.amount || amount || '';
            return value ? `Storage capacity ${value}` : 'Storage information is updating';
        });
    }

    function getDefaultBeamshareLabelValue(planId = 'basic') {
        const normalized = normalizePlanId(planId);
        if (normalized === 'premium') {
            return runtime('labels.beamsharePremium', {}, 'Unlimited');
        }
        return runtime('labels.beamshareBasic', {}, 'Unlimited sends, up to 200MB per file');
    }

    function formatBeamshareSummary(planId, limitLabel) {
        const label = shouldUseProvidedLabel(limitLabel) ? limitLabel : getDefaultBeamshareLabelValue(planId);
        return runtime('beamshareSummary', { label }, (params) => `BeamShare Live: ${params.label}`);
    }

    function formatBeamshareSummaryWithRemaining(planId, limitLabel, remaining) {
        const label = shouldUseProvidedLabel(limitLabel) ? limitLabel : getDefaultBeamshareLabelValue(planId);
        const remainingText = runtime('messages.beamshareRemaining', { count: remaining }, (params) => `${params.count} sends remaining in the current window`);
        return runtime('beamshareSummaryRemaining', { label, remaining: remainingText }, (params) => `BeamShare Live: ${params.label}, ${params.remaining}`);
    }

    function formatFileSizeDisplay(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return runtime('labels.beamshareUnlimited', {}, 'Unlimited');
        }
        const formatted = formatBytes(bytes);
        return runtime('labels.beamsharePerFile', { value: formatted }, (params) => `${params.value} per file`);
    }

    function resolveFileSizeLabel(providedLabel, defaultBytes) {
        if (shouldUseProvidedLabel(providedLabel)) {
            return providedLabel;
        }
        return formatFileSizeDisplay(defaultBytes);
    }

    function getPlanCtaLabel(planId, isCurrent, isAuthenticated) {
        const normalized = normalizePlanId(planId);
        if (normalized === 'premium') {
            if (isCurrent) {
                return runtime('cta.premiumCurrent', {}, 'Already on Premium');
            }
            return isAuthenticated
                ? runtime('cta.premiumUpgrade', {}, 'Upgrade now')
                : runtime('cta.premiumLogin', {}, 'Sign in to upgrade');
        }

        if (isCurrent) {
            return runtime('cta.basicCurrent', {}, 'Currently active');
        }

        return isAuthenticated
            ? runtime('cta.basicSwitch', {}, 'Switch to Basic')
            : runtime('cta.basicLogin', {}, 'Sign in to use');
    }

    function getPlanDisplayName(planId) {
        const normalized = normalizePlanId(planId);
        if (normalized === 'premium') {
            return translate('pages.subscription.plans.premium.title', {}, 'Premium Plan');
        }
        return translate('pages.subscription.plans.basic.title', {}, 'Basic Plan');
    }

    function normalizePlanId(planId) {
        return (planId || 'basic').toString().trim().toLowerCase();
    }

    function getPlanDefaults(planId) {
        return PLAN_DEFAULTS[normalizePlanId(planId)] || PLAN_DEFAULTS.basic;
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        const value = bytes / Math.pow(k, i);
        const precision = value >= 10 || i === 0 ? 0 : 1;
        return `${value.toFixed(precision)} ${sizes[i]}`;
    }

    function applyDefaultPlanDetails() {
        if (!elements.plansContainer) {
            return;
        }
        const cards = elements.plansContainer.querySelectorAll(selectors.planCards);
        cards.forEach((card) => {
            const planId = normalizePlanId(card.dataset.plan);
            const defaults = PLAN_DEFAULTS[planId];
            if (!defaults) {
                return;
            }
            const storageEl = card.querySelector(selectors.planStorage);
            if (storageEl) {
                storageEl.textContent = formatPlanStorageLabel(defaults.storageLabel);
            }
            const beamshareEl = card.querySelector(selectors.planBeamshare);
            if (beamshareEl) {
                beamshareEl.textContent = formatBeamshareSummary(planId, null);
            }
        });
    }

    applyDefaultPlanDetails();

    function formatCurrency(value = 0, currency = 'VND') {
        try {
            return new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency
            }).format(value);
        } catch (_error) {
            return `${value} ${currency}`;
        }
    }

    function pushToast(type, message, options) {
        const system = window.toastSystem;
        if (system && typeof system[type] === 'function') {
            system[type](message, options);
            return;
        }
        if (type === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    function updatePlanCards(overview) {
        if (!elements.plansContainer || !overview?.plans) {
            return;
        }

        const cards = elements.plansContainer.querySelectorAll(selectors.planCards);
        cards.forEach((card) => {
            const planId = normalizePlanId(card.dataset.plan);
            const plan = overview.plans.find((item) => normalizePlanId(item.id) === planId);
            const defaults = getPlanDefaults(planId);
            if (!plan) {
                if (defaults) {
                    const storageElFallback = card.querySelector(selectors.planStorage);
                    if (storageElFallback) {
                        storageElFallback.textContent = formatPlanStorageLabel(defaults.storageLabel);
                    }
                    const beamshareFallback = card.querySelector(selectors.planBeamshare);
                    if (beamshareFallback) {
                        beamshareFallback.textContent = formatBeamshareSummary(planId, null);
                    }
                }
                return;
            }

            const priceEl = card.querySelector(selectors.planPrice);
            const storageEl = card.querySelector(selectors.planStorage);
            const beamshareEl = card.querySelector(selectors.planBeamshare);

            if (priceEl) {
                const hasPrice = Number.isFinite(plan.monthlyPrice) && plan.monthlyPrice > 0;
                priceEl.textContent = hasPrice
                    ? formatCurrency(plan.monthlyPrice, plan.currency || defaults.currency || 'VND')
                    : runtime('priceFree', {}, 'Free');
            }

            if (storageEl) {
                const storageLabel = plan.storageLabel || defaults.storageLabel;
                storageEl.textContent = storageLabel
                    ? formatPlanStorageLabel(storageLabel)
                    : runtime('storageUpdating', {}, 'Storage information is updating');
            }

            if (beamshareEl) {
                const limitLabel = plan.beamshare?.limitLabel;
                beamshareEl.textContent = formatBeamshareSummary(planId, limitLabel);
            }

            const isCurrent = normalizePlanId(overview.currentPlan) === planId;
            card.classList.toggle('is-current', isCurrent);

            const cta = card.querySelector('button[data-action]');
            if (cta) {
                cta.disabled = isCurrent;
                cta.textContent = getPlanCtaLabel(planId, isCurrent, Boolean(overview.authenticated));
            }
        });
    }

    function updateUsageCard(overview) {
        if (!elements.usageCard) {
            return;
        }

        const planLabel = elements.usageCard.querySelector(selectors.currentPlan);
        const usageText = elements.usageCard.querySelector(selectors.usageText);
        const usageProgress = elements.usageCard.querySelector(selectors.usageProgress);
        const beamshareSummary = elements.usageCard.querySelector(selectors.beamshareSummary);

        if (!overview?.authenticated) {
            if (planLabel) {
                planLabel.textContent = runtime('messages.loginRequired', {}, 'Please sign in to view plan information.');
            }
            if (usageText) {
                usageText.textContent = '0 B / 0 B';
            }
            if (usageProgress) {
                usageProgress.style.width = '0%';
            }
            if (beamshareSummary) {
                beamshareSummary.textContent = runtime('messages.beamshareLoginRequired', {}, 'BeamShare Live requires sign-in.');
            }
            return;
        }

        const normalizedPlan = normalizePlanId(overview.currentPlan);
        const planDefaults = getPlanDefaults(normalizedPlan);

        if (planLabel) {
            const displayName = getPlanDisplayName(normalizedPlan);
            planLabel.textContent = runtime('messages.currentPlan', { plan: displayName }, (params) => `Current plan: ${params.plan}`);
        }

        if (usageText) {
            const totalLabel = overview.storage?.formattedTotal || formatBytes(overview.storage?.totalBytes) || '0 B';
            const limitLabel = overview.storage?.formattedLimit || planDefaults.storageLabel;
            usageText.textContent = `${totalLabel} / ${limitLabel}`;
        }

        if (usageProgress) {
            const percentFromApi = overview.storage?.percent;
            let percent = Number.isFinite(percentFromApi) ? percentFromApi : 0;
            if (!Number.isFinite(percentFromApi) && Number.isFinite(overview.storage?.totalBytes) && planDefaults.storageBytes) {
                percent = Math.min(100, Math.round((overview.storage.totalBytes / planDefaults.storageBytes) * 100));
            }
            usageProgress.style.width = `${percent}%`;
        }

        if (beamshareSummary) {
            const limitLabel = overview.beamshare?.limit?.limitLabel || null;
            const remaining = Number.isFinite(overview.beamshare?.remaining) ? overview.beamshare.remaining : null;

            if (Number.isFinite(remaining)) {
                beamshareSummary.textContent = formatBeamshareSummaryWithRemaining(normalizedPlan, limitLabel, remaining);
            } else if (limitLabel) {
                beamshareSummary.textContent = formatBeamshareSummary(normalizedPlan, limitLabel);
            } else {
                beamshareSummary.textContent = formatBeamshareSummary(normalizedPlan, null);
            }
        }
    }

    function updateBeamshareTable(overview) {
        if (!elements.beamshareTable) {
            return;
        }

        const plans = Array.isArray(overview.plans) ? overview.plans : [];
        const basicPlan = plans.find((plan) => normalizePlanId(plan.id) === 'basic');
        const premiumPlan = plans.find((plan) => normalizePlanId(plan.id) === 'premium');

        const basicSendCell = elements.beamshareTable.querySelector(selectors.beamshareBasicSends);
        if (basicSendCell) {
            basicSendCell.textContent = runtime('labels.beamshareUnlimited', {}, 'Unlimited');
        }

        const premiumSendCell = elements.beamshareTable.querySelector(selectors.beamsharePremiumSends);
        if (premiumSendCell) {
            premiumSendCell.textContent = runtime('labels.beamshareUnlimited', {}, 'Unlimited');
        }

        const basicFileCell = elements.beamshareTable.querySelector(selectors.beamshareBasicFileSize);
        if (basicFileCell) {
            const raw = basicPlan?.beamshare?.fileSizeLimitLabel || null;
            basicFileCell.textContent = resolveFileSizeLabel(raw, PLAN_DEFAULTS.basic.beamshareFileSizeBytes);
        }

        const premiumFileCell = elements.beamshareTable.querySelector(selectors.beamsharePremiumFileSize);
        if (premiumFileCell) {
            const raw = premiumPlan?.beamshare?.fileSizeLimitLabel || null;
            premiumFileCell.textContent = resolveFileSizeLabel(raw, PLAN_DEFAULTS.premium.beamshareFileSizeBytes);
        }
    }

    async function loadOverview() {
        try {
            const response = await fetch('/api/subscriptions/overview', {
                credentials: 'include'
            });

            if (response.status === 401) {
                window.location.href = '/auth/login';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const overview = await response.json();
            overview.currentPlan = normalizePlanId(overview.currentPlan);
            if (Array.isArray(overview.plans)) {
                overview.plans = overview.plans.map((plan) => ({
                    ...plan,
                    id: normalizePlanId(plan.id)
                }));
            }
            state.overview = overview;
            updatePlanCards(state.overview);
            updateUsageCard(state.overview);
            updateBeamshareTable(state.overview);
        } catch (error) {
            const errorMessage = runtime('messages.loadError', {}, 'Unable to load subscription data.');
            console.error(errorMessage, error);
            pushToast('error', errorMessage, { duration: 4000 });
            applyDefaultPlanDetails();
        }
    }

    async function confirmBasicDowngrade() {
        const modal = window.modalSystem;
        const warningMessage = runtime('dialogs.downgradeMessage', {}, () => (
            '<p>You are about to move from Premium back to Basic.</p>'
            + '<p>You will lose Premium perks such as higher storage and unlimited BeamShare limits.</p>'
            + '<p>Do you want to continue?</p>'
        ));

        if (modal && typeof modal.confirm === 'function') {
            return modal.confirm({
                title: runtime('dialogs.downgradeTitle', {}, 'Confirm switch to Basic'),
                message: warningMessage,
                confirmText: runtime('dialogs.downgradeConfirm', {}, 'Switch to Basic'),
                confirmClass: 'btn-danger',
                cancelText: runtime('dialogs.downgradeCancel', {}, 'Cancel')
            });
        }

        return window.confirm(runtime('dialogs.downgradePrompt', {}, 'You are about to switch from Premium to Basic and will lose Premium benefits. Do you want to continue?'));
    }

    async function requestPlanSwitch(targetPlan) {
        const planId = normalizePlanId(targetPlan);
        const selector = `[data-action="switch-plan"][data-target="${planId}"]`;
        const button = elements.plansContainer?.querySelector(selector) || null;

        if (button) {
            button.dataset.loadingSwitch = 'true';
            button.dataset.originalLabel = button.textContent || '';
            button.disabled = true;
            button.textContent = runtime('cta.switching', {}, 'Switching...');
        }

        try {
            const response = await fetch('/api/subscriptions/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan: planId })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = payload?.error || runtime('messages.toastSwitchError', {}, 'Unable to change plan.');
                throw new Error(message);
            }

            pushToast('success', payload?.message || runtime('messages.toastSwitchSuccess', {}, 'Switched back to the Basic plan.'), { duration: 3000 });
            await loadOverview();
        } catch (error) {
            console.error('Switch plan error:', error);
            pushToast('error', error.message || runtime('messages.toastSwitchError', {}, 'Unable to change plan.'), { duration: 4000 });
        } finally {
            if (button && document.body.contains(button) && button.dataset.loadingSwitch === 'true') {
                button.disabled = false;
                if (state.overview) {
                    const latestIsCurrent = normalizePlanId(state.overview.currentPlan) === planId;
                    button.textContent = getPlanCtaLabel(planId, latestIsCurrent, Boolean(state.overview.authenticated));
                } else if (button.dataset.originalLabel) {
                    button.textContent = button.dataset.originalLabel;
                } else {
                    button.textContent = getPlanCtaLabel(planId, false, true);
                }
                delete button.dataset.loadingSwitch;
                delete button.dataset.originalLabel;
            }
        }
    }

    function bindActions() {
        const upgradeBtn = document.querySelector(selectors.upgradeButton);
        if (upgradeBtn && !upgradeBtn.dataset.bound) {
            upgradeBtn.dataset.bound = 'true';
            upgradeBtn.addEventListener('click', async () => {
                if (!state.overview?.authenticated) {
                    window.location.href = '/auth/login';
                    return;
                }

                if (state.overview?.currentPlan === 'premium') {
                    pushToast('success', runtime('messages.toastCurrentPremium', {}, 'You are already on the Premium plan.'), { duration: 3000 });
                    return;
                }

                upgradeBtn.disabled = true;
                const originalText = upgradeBtn.textContent;
                upgradeBtn.textContent = runtime('messages.toastPaymentInit', {}, 'Initialising VNPay...');

                try {
                    const response = await fetch('/api/subscriptions/payments/vnpay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ plan: 'premium' })
                    });

                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({}));
                        throw new Error(payload.error || `HTTP ${response.status}`);
                    }

                    const payload = await response.json();
                    if (payload?.paymentUrl) {
                        window.location.href = payload.paymentUrl;
                        return;
                    }

                    throw new Error(runtime('messages.toastPaymentMissing', {}, 'Payment link was not returned.'));
                } catch (error) {
                    console.error('VNPay init error:', error);
                    pushToast('error', error.message || runtime('messages.toastPaymentError', {}, 'Unable to start the payment process.'), { duration: 4000 });
                } finally {
                    upgradeBtn.disabled = false;
                    upgradeBtn.textContent = originalText;
                }
            });
        }

        document.querySelectorAll(selectors.switchPlanButtons).forEach((button) => {
            if (button.dataset.bound) {
                return;
            }
            button.dataset.bound = 'true';
            button.addEventListener('click', async () => {
                if (!state.overview) {
                    pushToast('info', runtime('messages.toastLoading', {}, 'Loading plan information. Please try again shortly.'), { duration: 2500 });
                    return;
                }

                if (!state.overview.authenticated) {
                    window.location.href = '/auth/login';
                    return;
                }

                const targetPlan = normalizePlanId(button.dataset.target);

                if (state.overview.currentPlan === targetPlan) {
                    pushToast('success', runtime('messages.toastCurrentBasic', {}, 'You are already on the Basic plan.'), { duration: 2500 });
                    return;
                }

                if (targetPlan === 'basic') {
                    if (state.overview.currentPlan === 'premium') {
                        const confirmed = await confirmBasicDowngrade();
                        if (!confirmed) {
                            return;
                        }
                    }

                    await requestPlanSwitch('basic');
                    return;
                }

                pushToast('info', runtime('messages.toastSwitchUnsupported', {}, 'Switching to this plan is not supported yet.'), { duration: 3500 });
            });
        });
    }

    function handlePaymentStatus() {
        const url = new URL(window.location.href);
        const status = url.searchParams.get('paymentStatus');
        const message = url.searchParams.get('message');

        if (status) {
            const toastType = status === 'success' ? 'success' : 'error';
            const fallbackMessage = status === 'success'
                ? runtime('messages.toastPaymentSuccess', {}, 'Payment successful.')
                : runtime('messages.toastPaymentFailure', {}, 'Payment failed.');
            const safeMessage = message || fallbackMessage;

            pushToast(toastType, safeMessage, {
                duration: 5000
            });

            url.searchParams.delete('paymentStatus');
            url.searchParams.delete('message');
            window.history.replaceState({}, document.title, url.toString());
        }
    }

    window.initSubscription = async function initSubscription() {
        applyDefaultPlanDetails();
        bindActions();
        handlePaymentStatus();
        await loadOverview();
    };

    window.cleanupSubscription = function cleanupSubscription() {
        // No persistent listeners yet; placeholder for future cleanups.
    };

    document.addEventListener('DOMContentLoaded', () => {
        const subscriptionPage = document.getElementById('subscription-page');
        if (subscriptionPage && subscriptionPage.classList.contains('active')) {
            window.initSubscription();
        }
    });

    document.addEventListener('language:changed', () => {
        if (state.overview) {
            updatePlanCards(state.overview);
            updateUsageCard(state.overview);
            updateBeamshareTable(state.overview);
        } else {
            applyDefaultPlanDetails();
        }
    });
})();