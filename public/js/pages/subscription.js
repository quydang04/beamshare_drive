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
            beamshareLimitLabel: 'BeamShare Live: Không giới hạn lượt gửi, tối đa 200MB mỗi file',
            beamshareFileSizeBytes: 200 * 1024 * 1024,
            beamshareFileSizeLabel: '200 MB'
        },
        premium: {
            id: 'premium',
            title: 'Premium',
            currency: 'VND',
            storageBytes: 15 * BYTES_IN_GIB,
            storageLabel: '15 GB',
            beamshareLimitLabel: 'BeamShare Live: Không giới hạn',
            beamshareFileSizeBytes: null,
            beamshareFileSizeLabel: 'Không giới hạn'
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
                    if (isCurrent) {
                        cta.textContent = 'Đang sử dụng';
                    } else if (overview.authenticated) {
                        cta.textContent = 'Chuyển về gói Basic';
                    } else {
                        cta.textContent = 'Đăng nhập để sử dụng';
                    }
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

        if (!overview?.authenticated) {
            if (planLabel) {
                planLabel.textContent = 'Vui lòng đăng nhập để xem thông tin gói.';
            }
            if (usageText) {
                usageText.textContent = '0 B / 0 B';
            }
            if (usageProgress) {
                usageProgress.style.width = '0%';
            }
            if (beamshareSummary) {
                beamshareSummary.textContent = 'BeamShare Live yêu cầu đăng nhập.';
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

        const plans = Array.isArray(overview.plans) ? overview.plans : [];
        const basicPlan = plans.find((plan) => normalizePlanId(plan.id) === 'basic');
        const premiumPlan = plans.find((plan) => normalizePlanId(plan.id) === 'premium');

        const basicSendCell = elements.beamshareTable.querySelector(selectors.beamshareBasicSends);
        if (basicSendCell) {
            basicSendCell.textContent = 'Không giới hạn';
        }

        const premiumSendCell = elements.beamshareTable.querySelector(selectors.beamsharePremiumSends);
        if (premiumSendCell) {
            premiumSendCell.textContent = 'Không giới hạn';
        }

        const basicFileCell = elements.beamshareTable.querySelector(selectors.beamshareBasicFileSize);
        if (basicFileCell) {
            const raw = basicPlan?.beamshare?.fileSizeLimitLabel
                || PLAN_DEFAULTS.basic.beamshareFileSizeLabel
                || '—';
            const label = raw && raw !== 'Không giới hạn' && !/mỗi file/i.test(raw)
                ? `${raw} mỗi file`
                : raw;
            basicFileCell.textContent = label;
        }

        const premiumFileCell = elements.beamshareTable.querySelector(selectors.beamsharePremiumFileSize);
        if (premiumFileCell) {
            const raw = premiumPlan?.beamshare?.fileSizeLimitLabel
                || PLAN_DEFAULTS.premium.beamshareFileSizeLabel
                || 'Không giới hạn';
            const label = raw && raw !== 'Không giới hạn' && !/mỗi file/i.test(raw)
                ? `${raw} mỗi file`
                : raw;
            premiumFileCell.textContent = label;
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
            console.error('Không thể tải thông tin gói:', error);
            pushToast('error', 'Không thể tải thông tin gói đăng ký.', { duration: 4000 });
            applyDefaultPlanDetails();
        }
    }

    async function confirmBasicDowngrade() {
        const modal = window.modalSystem;
        const warningMessage = `
            <p>Bạn sắp chuyển từ gói Premium về gói Basic.</p>
            <p>Bạn sẽ mất các quyền lợi Premium như dung lượng cao hơn và giới hạn BeamShare không giới hạn.</p>
            <p>Bạn có chắc chắn muốn tiếp tục?</p>
        `;

        if (modal && typeof modal.confirm === 'function') {
            return modal.confirm({
                title: 'Xác nhận chuyển về gói Basic',
                message: warningMessage,
                confirmText: 'Chuyển về Basic',
                confirmClass: 'btn-danger',
                cancelText: 'Hủy'
            });
        }

        return window.confirm(
            'Bạn sắp chuyển từ gói Premium về gói Basic và sẽ mất các quyền lợi Premium. Bạn có chắc chắn muốn tiếp tục?'
        );
    }

    async function requestPlanSwitch(targetPlan) {
        const planId = normalizePlanId(targetPlan);
        const selector = `[data-action="switch-plan"][data-target="${planId}"]`;
        const button = elements.plansContainer?.querySelector(selector) || null;

        if (button) {
            button.dataset.loadingSwitch = 'true';
            button.dataset.originalLabel = button.textContent || '';
            button.disabled = true;
            button.textContent = 'Đang chuyển...';
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
                const message = payload?.error || 'Không thể đổi gói.';
                throw new Error(message);
            }

            pushToast('success', payload?.message || 'Đã chuyển về gói Basic.', { duration: 3000 });
            await loadOverview();
        } catch (error) {
            console.error('Switch plan error:', error);
            pushToast('error', error.message || 'Không thể đổi gói.', { duration: 4000 });
        } finally {
            if (button && document.body.contains(button) && button.dataset.loadingSwitch === 'true') {
                if (button.textContent === 'Đang chuyển...') {
                    button.textContent = button.dataset.originalLabel || 'Chuyển về gói Basic';
                    button.disabled = false;
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
            button.addEventListener('click', async () => {
                if (!state.overview) {
                    pushToast('info', 'Đang tải thông tin gói. Vui lòng thử lại sau giây lát.', { duration: 2500 });
                    return;
                }

                if (!state.overview.authenticated) {
                    window.location.href = '/auth/login';
                    return;
                }

                const targetPlan = normalizePlanId(button.dataset.target);

                if (state.overview.currentPlan === targetPlan) {
                    pushToast('success', 'Bạn đang ở gói Basic.', { duration: 2500 });
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

                pushToast('info', 'Tính năng chuyển gói này hiện chưa hỗ trợ.', { duration: 3500 });
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