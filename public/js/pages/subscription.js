(() => {
    const state = {
        overview: null
    };

    const BYTES_IN_GIB = 1024 * 1024 * 1024;

    const PLAN_DEFAULTS = {
        basic: {
            id: 'basic',
            title: 'Basic',
            currency: 'VND',
            storageBytes: 5 * BYTES_IN_GIB,
            storageLabel: '5 GB',
            beamshareLimitLabel: 'BeamShare Live: 10 lượt gửi mỗi 1 giờ',
            beamshareWindowMs: 60 * 60 * 1000,
            beamshareMaxTransfers: 10
        },
        premium: {
            id: 'premium',
            title: 'Premium',
            currency: 'VND',
            storageBytes: 15 * BYTES_IN_GIB,
            storageLabel: '15 GB',
            beamshareLimitLabel: 'BeamShare Live: Không giới hạn',
            beamshareWindowMs: 0,
            beamshareMaxTransfers: 0
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
        beamshareGuest: '[data-beamshare-guest-limit]'
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
                storageEl.textContent = `Dung lượng lưu trữ ${defaults.storageLabel}`;
            }
            const beamshareEl = card.querySelector(selectors.planBeamshare);
            if (beamshareEl) {
                beamshareEl.textContent = defaults.beamshareLimitLabel;
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

    function formatWindow(windowMs) {
        if (!windowMs || windowMs <= 0) {
            return 'Không giới hạn';
        }

        const minutes = Math.round(windowMs / 60000);
        if (minutes % 60 === 0) {
            const hours = minutes / 60;
            if (hours % 24 === 0) {
                const days = hours / 24;
                return `${days} ngày`;
            }
            return `${hours} giờ`;
        }

        if (minutes >= 60) {
            const hoursValue = (minutes / 60).toFixed(1).replace(/\.0$/, '');
            return `${hoursValue} giờ`;
        }

        return `${minutes} phút`;
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
                        storageElFallback.textContent = `Dung lượng lưu trữ ${defaults.storageLabel}`;
                    }
                    const beamshareFallback = card.querySelector(selectors.planBeamshare);
                    if (beamshareFallback) {
                        beamshareFallback.textContent = defaults.beamshareLimitLabel;
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
                    : '0đ';
            }

            if (storageEl) {
                const storageLabel = plan.storageLabel || defaults.storageLabel;
                storageEl.textContent = storageLabel
                    ? `Dung lượng lưu trữ ${storageLabel}`
                    : 'Dung lượng lưu trữ đang cập nhật';
            }

            if (beamshareEl) {
                const limitLabel = plan.beamshare?.limitLabel;
                beamshareEl.textContent = limitLabel
                    ? `BeamShare Live: ${limitLabel}`
                    : defaults.beamshareLimitLabel;
            }

            const isCurrent = normalizePlanId(overview.currentPlan) === planId;
            card.classList.toggle('is-current', isCurrent);

            const cta = card.querySelector('button[data-action]');
            if (cta) {
                cta.disabled = isCurrent;
                if (planId === 'premium') {
                    cta.textContent = isCurrent
                        ? 'Đã ở gói Premium'
                        : overview.authenticated ? 'Nâng cấp ngay' : 'Đăng nhập để nâng cấp';
                } else {
                    cta.textContent = isCurrent
                        ? 'Đang sử dụng'
                        : overview.authenticated ? 'Liên hệ hỗ trợ để chuyển về Basic' : 'Đăng nhập để sử dụng';
                }
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

        if (!overview.authenticated) {
            const basicDefaults = PLAN_DEFAULTS.basic;
            if (planLabel) {
                planLabel.textContent = 'Bạn đang khám phá BeamShare ở chế độ khách.';
            }
            if (usageText) {
                usageText.textContent = `0 B / ${basicDefaults.storageLabel}`;
            }
            if (usageProgress) {
                usageProgress.style.width = '0%';
            }
            if (beamshareSummary) {
                beamshareSummary.textContent = overview.beamshare?.limit?.limitLabel
                    ? `Giới hạn BeamShare hiện tại: ${overview.beamshare.limit.limitLabel}`
                    : 'Giới hạn BeamShare hiện tại: 5 lượt mỗi 5 giờ';
            }
            return;
        }

        const normalizedPlan = normalizePlanId(overview.currentPlan);
        const planDefaults = getPlanDefaults(normalizedPlan);

        if (planLabel) {
            planLabel.textContent = `Gói hiện tại: ${planDefaults.title}`;
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
            if (overview.beamshare?.limit) {
                const remaining = Number.isFinite(overview.beamshare.remaining)
                    ? `, còn ${overview.beamshare.remaining} lượt trong cửa sổ hiện tại`
                    : '';
                beamshareSummary.textContent = `BeamShare Live: ${overview.beamshare.limit.limitLabel}${remaining}`;
            } else {
                beamshareSummary.textContent = planDefaults.beamshareLimitLabel || 'BeamShare Live: Không giới hạn.';
            }
        }
    }

    function updateBeamshareTable(overview) {
        if (!elements.beamshareTable) {
            return;
        }

        const guestCell = elements.beamshareTable.querySelector(selectors.beamshareGuest);
        const guestWindowCell = elements.beamshareTable.querySelector('[data-beamshare-guest-window]');
        if (guestCell) {
            if (overview.guestBeamshare) {
                guestCell.textContent = `${overview.guestBeamshare.maxTransfers} lượt`;
                if (guestWindowCell) {
                    guestWindowCell.textContent = formatWindow(overview.guestBeamshare.windowMs);
                }
            } else {
                guestCell.textContent = '5 lượt';
                if (guestWindowCell) {
                    guestWindowCell.textContent = '5 giờ';
                }
            }
        }

        const basicCell = elements.beamshareTable.querySelector('[data-beamshare-basic-limit]');
        const basicWindowCell = elements.beamshareTable.querySelector('[data-beamshare-basic-window]');
        if (basicCell && overview.plans) {
            const basicPlan = overview.plans.find((plan) => normalizePlanId(plan.id) === 'basic');
            if (basicPlan?.beamshare) {
                basicCell.textContent = `${basicPlan.beamshare.maxTransfers} lượt`;
                if (basicWindowCell) {
                    basicWindowCell.textContent = formatWindow(basicPlan.beamshare.windowMs);
                }
                return;
            }
        }
        if (basicCell) {
            const basicDefaults = PLAN_DEFAULTS.basic;
            basicCell.textContent = `${basicDefaults.beamshareMaxTransfers} lượt`;
            if (basicWindowCell) {
                basicWindowCell.textContent = formatWindow(basicDefaults.beamshareWindowMs);
            }
        }
    }

    async function loadOverview() {
        try {
            const response = await fetch('/api/subscriptions/overview', {
                credentials: 'include'
            });

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
            console.error('Không thể tải thông tin gói:', error);
            pushToast('error', 'Không thể tải thông tin gói đăng ký.', { duration: 4000 });
            applyDefaultPlanDetails();
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
                    pushToast('success', 'Bạn đang ở gói Premium.', { duration: 3000 });
                    return;
                }

                upgradeBtn.disabled = true;
                const originalText = upgradeBtn.textContent;
                upgradeBtn.textContent = 'Đang khởi tạo VNPay...';

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

                    throw new Error('Không nhận được đường dẫn thanh toán.');
                } catch (error) {
                    console.error('VNPay init error:', error);
                    pushToast('error', error.message || 'Không thể khởi tạo thanh toán.', { duration: 4000 });
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
            button.addEventListener('click', () => {
                if (!state.overview?.authenticated) {
                    window.location.href = '/auth/login';
                    return;
                }

                if (state.overview.currentPlan === 'basic') {
                    pushToast('success', 'Bạn đang ở gói Basic.', { duration: 2500 });
                } else {
                    pushToast('info', 'Liên hệ hỗ trợ để chuyển về gói Basic.', { duration: 3500 });
                }
            });
        });
    }

    function handlePaymentStatus() {
        const url = new URL(window.location.href);
        const status = url.searchParams.get('paymentStatus');
        const message = url.searchParams.get('message');

        if (status) {
            const toastType = status === 'success' ? 'success' : 'error';
            const fallbackMessage = status === 'success' ? 'Thanh toán thành công.' : 'Thanh toán thất bại.';
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
})();