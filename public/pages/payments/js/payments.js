(() => {
    // ===== STATE MANAGEMENT =====
    const state = {
        payments: [],
        subscription: null,
        storage: null,
        currentPlan: null,
        plans: [],
        status: 'all',
        search: '',
        selectedId: null,
        loading: false,
        error: null
    };

    // ===== SELECTORS =====
    const selectors = {
        // Table
        tableBody: '[data-payments-table]',
        statusFilter: '[data-filter="status"]',
        searchBox: '[data-search="payments"]',
        emptyState: '[data-empty-state]',
        tableFooter: '[data-table-footer]',
        showingCount: '[data-binding="showing-count"]',
        
        // Plan Card
        planCard: '[data-plan-card]',
        planBadge: '[data-binding="plan-badge"]',
        planTier: '[data-binding="plan-tier"]',
        planName: '[data-binding="plan-name"]',
        planDescription: '[data-binding="plan-description"]',
        planPrice: '[data-binding="plan-price"]',
        planCycle: '[data-binding="plan-cycle"]',
        planStatus: '[data-binding="plan-status"]',
        storageLimit: '[data-binding="storage-limit"]',
        beamshareLimit: '[data-binding="beamshare-limit"]',
        upgradeBtn: '[data-action="upgrade-plan"]',
        downgradeBtn: '[data-action="downgrade-plan"]',
        
        // Stats
        totalAmount: '[data-binding="total-amount"]',
        totalCount: '[data-binding="total-count"]',
        latestAmount: '[data-binding="latest-amount"]',
        latestStatus: '[data-binding="latest-status"]',
        storageUsed: '[data-binding="storage-used"]',
        storagePercent: '[data-binding="storage-percent"]',
        storageInfo: '[data-binding="storage-info"]',
        nextPayment: '[data-binding="next-payment"]',
        subscriptionStatus: '[data-binding="subscription-status"]',
        
        // Detail Modal
        detailModal: '[data-detail-modal]',
        detailContent: '[data-detail-content]',
        closeDetailBtn: '[data-action="close-detail"]',
        
        // Actions
        refreshButton: '[data-action="refresh-payments"]',
        exportButton: '[data-action="export-payments"]'
    };

    const eventUnsubscribers = [];
    const tableEventUnsubscribers = [];

    // ===== UTILITY FUNCTIONS =====
    function translate(key, fallback) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            try {
                const value = window.i18n.t(key);
                if (value && value !== key) return value;
            } catch (error) {
                console.warn('Translation failed for', key, error);
            }
        }
        return typeof fallback === 'function' ? fallback() : fallback || key;
    }

    function formatCurrency(amount, currency = 'VND') {
        try {
            return new Intl.NumberFormat(window.i18n?.getLocale?.() || 'vi-VN', {
                style: 'currency',
                currency,
                maximumFractionDigits: currency === 'VND' ? 0 : 2
            }).format(amount);
        } catch (_error) {
            return amount + ' ' + currency;
        }
    }

        function formatDate(date, options = {}) {
        const missingDateLabel = translate('pages.payments.state.noDate', '—');
        if (!date) return missingDateLabel;
        const safeDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(safeDate.getTime())) return missingDateLabel;
        
        const defaultOptions = { year: 'numeric', month: 'short', day: '2-digit' };
        const finalOptions = { ...defaultOptions, ...options };
        
        if (window.i18n && typeof window.i18n.formatDateTime === 'function') {
            return window.i18n.formatDateTime(safeDate, finalOptions);
        }
        return safeDate.toLocaleDateString('vi-VN', finalOptions);
    }

    function formatTime(date) {
        const missingTimeLabel = translate('pages.payments.state.noTime', '--');
        if (!date) return missingTimeLabel;
        const safeDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(safeDate.getTime())) return missingTimeLabel;
        return safeDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    });
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        const value = bytes / Math.pow(k, i);
        return value.toFixed(value >= 10 || i === 0 ? 0 : 1) + ' ' + sizes[i];
    }

    // ===== DATA NORMALIZATION =====
    function normalizePayment(record) {
        if (!record || typeof record !== 'object') return null;

        const id = record.invoiceId || record.id || record.txnRef || String(record._id || '');
        const rawDate = record.paidAt || record.updatedAt || record.createdAt || record.date;
        const amount = Number(record.amount) || 0;

        return {
            id,
            date: rawDate ? new Date(rawDate) : null,
            amount,
            currency: record.currency || 'VND',
            status: (record.status || 'pending').toLowerCase(),
            note: record.note || record.orderInfo || translate('pages.payments.detail.invoice', 'Invoice'),
            method: record.method || deriveMethod(record),
            period: record.period || '',
            plan: record.plan || 'basic',
            bankCode: record.bankCode || null
        };
    }

    function deriveMethod(payment) {
        const provider = (payment.provider || 'VNPay').toUpperCase();
        if (payment.bankCode) return provider + ' - ' + payment.bankCode;
        if (payment.txnRef) return provider + ' - ' + String(payment.txnRef).slice(-4);
        return provider;
    }

    function getStatusMeta(status) {
        const map = {
            paid: { label: translate('pages.payments.status.paid', 'Paid'), className: 'status-paid', icon: 'fa-check-circle' },
            pending: { label: translate('pages.payments.status.pending', 'Pending'), className: 'status-pending', icon: 'fa-clock' },
            refunded: { label: translate('pages.payments.status.refunded', 'Refunded'), className: 'status-refunded', icon: 'fa-undo' },
            failed: { label: translate('pages.payments.status.failed', 'Failed'), className: 'status-failed', icon: 'fa-times-circle' },
            canceled: { label: translate('pages.payments.status.canceled', 'Canceled'), className: 'status-canceled', icon: 'fa-ban' }
        };
        return map[(status || '').toLowerCase()] || map.pending;
    }

    // ===== FILTERS =====
    function applyFilters(records) {
        return records.filter(function(payment) {
            const matchesStatus = state.status === 'all' || payment.status === state.status;
            const searchable = (payment.id + ' ' + payment.note + ' ' + payment.method).toLowerCase();
            const matchesSearch = state.search ? searchable.includes(state.search.toLowerCase()) : true;
            return matchesStatus && matchesSearch;
        });
    }

    // ===== RENDER FUNCTIONS =====
    function renderPlanCard() {
        const planCard = document.querySelector(selectors.planCard);
        const planDef = state.plans.find(function(p) { return p.id === state.currentPlan; }) || state.plans[0];
        
        if (!planCard || !planDef) return;

        // Set plan attribute for styling
        planCard.setAttribute('data-plan', state.currentPlan || 'basic');

        // Update plan badge
        const tierEl = document.querySelector(selectors.planTier);
        const defaultPlanTitle = translate('pages.payments.plan.basic', 'Basic');
        const planTitle = planDef.title || defaultPlanTitle;
        if (tierEl) tierEl.textContent = planTitle;

        // Update plan name
        const nameEl = document.querySelector(selectors.planName);
        if (nameEl) {
            const planSuffix = translate('pages.payments.plan.nameSuffix', 'Plan');
            nameEl.textContent = planTitle + ' ' + planSuffix;
        }

        // Update plan description
        const descEl = document.querySelector(selectors.planDescription);
        if (descEl) descEl.textContent = planDef.description || translate('pages.payments.plan.loadingDescription', '');

        // Update price
        const priceEl = document.querySelector(selectors.planPrice);
        if (priceEl) {
            priceEl.textContent = planDef.monthlyPrice === 0 
                ? translate('pages.payments.plan.free', 'Free')
                : formatCurrency(planDef.monthlyPrice, planDef.currency || 'VND');
        }

        // Update features
        const storageLimitEl = document.querySelector(selectors.storageLimit);
        if (storageLimitEl) storageLimitEl.textContent = planDef.storageLabel || translate('pages.payments.plan.storageDefault', '5 GB storage');

        const beamshareLimitEl = document.querySelector(selectors.beamshareLimit);
        if (beamshareLimitEl) beamshareLimitEl.textContent = (planDef.beamshare && planDef.beamshare.limitLabel) || translate('pages.payments.plan.beamshareDefault', 'BeamShare');

        // Show/hide action buttons
        const upgradeBtn = document.querySelector(selectors.upgradeBtn);
        const downgradeBtn = document.querySelector(selectors.downgradeBtn);
        
        if (upgradeBtn) {
            upgradeBtn.style.display = state.currentPlan === 'basic' ? 'inline-flex' : 'none';
        }
        if (downgradeBtn) {
            downgradeBtn.style.display = state.currentPlan === 'premium' ? 'inline-flex' : 'none';
        }
    }

    function renderStats() {
        const payments = state.payments;
        const paidPayments = payments.filter(function(p) { return p.status === 'paid'; });
        const totalAmount = paidPayments.reduce(function(sum, p) { return sum + p.amount; }, 0);

        // Total spent
        const totalAmountEl = document.querySelector(selectors.totalAmount);
        if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalAmount, 'VND');

        const totalCountEl = document.querySelector(selectors.totalCount);
        const paymentsLabel = translate('pages.payments.summary.paymentsLabel', 'payments');
        if (totalCountEl) totalCountEl.textContent = paidPayments.length + ' ' + paymentsLabel;

        // Latest payment
        let sorted = payments.slice().sort(function(a, b) {
            let aTime = a && a.date ? new Date(a.date).getTime() : 0;
            let bTime = b && b.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
        });
        let latest = sorted[0];

        let latestAmountEl = document.querySelector(selectors.latestAmount);
        let latestStatusEl = document.querySelector(selectors.latestStatus);
        
        if (latest) {
            let statusMeta = getStatusMeta(latest.status);
            if (latestAmountEl) latestAmountEl.textContent = formatCurrency(latest.amount, latest.currency);
            if (latestStatusEl) latestStatusEl.textContent = statusMeta.label + ' - ' + formatDate(latest.date);
        } else {
            if (latestAmountEl) latestAmountEl.textContent = translate('pages.payments.state.noAmount', '--');
            if (latestStatusEl) latestStatusEl.textContent = translate('pages.payments.state.noPayments', 'No payments yet');
        }

        // Storage
        if (state.storage) {
            let storageUsedEl = document.querySelector(selectors.storageUsed);
            let storagePercentEl = document.querySelector(selectors.storagePercent);
            let storageInfoEl = document.querySelector(selectors.storageInfo);

            if (storageUsedEl) storageUsedEl.textContent = state.storage.formattedTotal || '0 B';
            if (storagePercentEl) storagePercentEl.style.width = (state.storage.percent || 0) + '%';
            if (storageInfoEl) {
                let ofLabel = translate('pages.payments.summary.ofLabel', 'of');
                storageInfoEl.textContent = (state.storage.formattedTotal || '0 B') + ' ' + ofLabel + ' ' + (state.storage.formattedLimit || '5 GB');
            }
        }

        // Subscription status
        let nextPaymentEl = document.querySelector(selectors.nextPayment);
        let subStatusEl = document.querySelector(selectors.subscriptionStatus);
        
        if (nextPaymentEl) {
            nextPaymentEl.textContent = state.currentPlan === 'premium' 
                ? translate('pages.payments.subscription.premium', 'Premium')
                : translate('pages.payments.subscription.free', 'Free Plan');
        }
        if (subStatusEl) {
            subStatusEl.textContent = state.currentPlan === 'premium'
                ? translate('pages.payments.subscription.active', 'Active subscription')
                : translate('pages.payments.subscription.noSubscription', 'No active subscription');
        }
    }

    function renderTable(records) {
        let tbody = document.querySelector(selectors.tableBody);
        let emptyState = document.querySelector(selectors.emptyState);
        let tableFooter = document.querySelector(selectors.tableFooter);
        
        if (!tbody) return;

        // Clear previous table-specific event handlers without touching global controls
        tableEventUnsubscribers.splice(0).forEach(function(unsub) { unsub(); });

        if (state.loading) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="table-loading"><div class="spinner"></div><span>' + translate('pages.payments.state.loading', 'Loading payments...') + '</span></div></td></tr>';
            if (emptyState) emptyState.style.display = 'none';
            if (tableFooter) tableFooter.style.display = 'none';
            return;
        }

        if (state.error) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><div class="table-loading" style="color: var(--theme-danger);"><i class="fas fa-exclamation-circle"></i><span>' + state.error + '</span></div></td></tr>';
            if (emptyState) emptyState.style.display = 'none';
            if (tableFooter) tableFooter.style.display = 'none';
            return;
        }

        if (!records.length) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            if (tableFooter) tableFooter.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (tableFooter) tableFooter.style.display = 'flex';

        let showingCountEl = document.querySelector(selectors.showingCount);
        if (showingCountEl) {
            let showingLabel = translate('pages.payments.table.showing', 'Showing');
            let ofLabel = translate('pages.payments.table.of', 'of');
            showingCountEl.textContent = showingLabel + ' ' + records.length + ' ' + ofLabel + ' ' + state.payments.length;
        }

        let sortedRecords = records.slice().sort(function(a, b) {
            let aTime = a && a.date ? new Date(a.date).getTime() : 0;
            let bTime = b && b.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
        });

        let rows = sortedRecords.map(function(payment) {
            let status = getStatusMeta(payment.status);
            let isSelected = payment.id === state.selectedId;
            let dateLabel = translate('pages.payments.table.date', 'Date');
            let descLabel = translate('pages.payments.table.description', 'Description');
            let amountLabel = translate('pages.payments.table.amount', 'Amount');
            let statusLabel = translate('pages.payments.table.status', 'Status');
            let actionsLabel = translate('pages.payments.table.actions', 'Actions');
            let viewLabel = translate('pages.payments.actions.view', 'View');
            
            return '<tr data-payment-id="' + payment.id + '" class="' + (isSelected ? 'selected' : '') + '">' +
                '<td class="col-date" data-label="' + dateLabel + '">' +
                    '<div class="payment-date">' + formatDate(payment.date) + '</div>' +
                    '<div class="payment-time">' + formatTime(payment.date) + '</div>' +
                '</td>' +
                '<td class="col-description" data-label="' + descLabel + '">' +
                    '<div class="payment-description">' + payment.note + '</div>' +
                    '<div class="payment-method"><i class="fas fa-credit-card"></i> ' + payment.method + '</div>' +
                '</td>' +
                '<td class="col-amount" data-label="' + amountLabel + '">' +
                    '<span class="amount-value ' + (payment.status === 'paid' ? 'amount-positive' : '') + '">' + formatCurrency(payment.amount, payment.currency) + '</span>' +
                '</td>' +
                '<td class="col-status" data-label="' + statusLabel + '">' +
                    '<span class="status-badge ' + status.className + '"><i class="fas ' + status.icon + '"></i> ' + status.label + '</span>' +
                '</td>' +
                '<td class="col-actions" data-label="' + actionsLabel + '">' +
                    '<button class="btn-view" type="button" data-action="view-payment" data-payment-id="' + payment.id + '"><i class="fas fa-eye"></i> ' + viewLabel + '</button>' +
                '</td>' +
            '</tr>';
        }).join('');

        tbody.innerHTML = rows;

        // Attach row click handlers
        tbody.querySelectorAll('tr[data-payment-id]').forEach(function(row) {
            let handler = function(e) {
                if (e.target.closest('button')) return;
                selectPayment(row.getAttribute('data-payment-id'));
            };
            row.addEventListener('click', handler);
            tableEventUnsubscribers.push(function() { row.removeEventListener('click', handler); });
        });

        // Attach View button click handlers
        tbody.querySelectorAll('[data-action="view-payment"]').forEach(function(btn) {
            let handler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                let paymentId = btn.getAttribute('data-payment-id');
                if (paymentId) selectPayment(paymentId);
            };
            btn.addEventListener('click', handler);
            tableEventUnsubscribers.push(function() { btn.removeEventListener('click', handler); });
        });
    }

    function renderDetail(payment) {
        let container = document.querySelector(selectors.detailContent);
        let modal = document.querySelector(selectors.detailModal);
        if (!container || !modal) return;

        if (!payment) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            return;
        }

        let status = getStatusMeta(payment.status);
        let invoiceLabel = translate('pages.payments.detail.invoice', 'Invoice ID');
        let dateLabel = translate('pages.payments.detail.date', 'Date');
        let timeLabel = translate('pages.payments.detail.time', 'Time');
        let methodLabel = translate('pages.payments.detail.method', 'Method');
        let planLabel = translate('pages.payments.detail.plan', 'Plan');
        let descLabel = translate('pages.payments.detail.description', 'Description');
        let downloadLabel = translate('pages.payments.actions.downloadInvoice', 'Download Invoice');
        let supportLabel = translate('pages.payments.actions.contactSupport', 'Contact Support');
        
        container.innerHTML = '<div class="detail-content-wrapper">' +
            '<div class="detail-amount-section">' +
                '<div class="detail-amount ' + (payment.status === 'paid' ? 'paid' : '') + '">' + formatCurrency(payment.amount, payment.currency) + '</div>' +
                '<span class="detail-status-large ' + status.className + '"><i class="fas ' + status.icon + '"></i> ' + status.label + '</span>' +
            '</div>' +
            '<div class="detail-meta">' +
                '<div class="meta-item"><span class="meta-label">' + invoiceLabel + '</span><span class="meta-value">' + payment.id + '</span></div>' +
                '<div class="meta-item"><span class="meta-label">' + dateLabel + '</span><span class="meta-value">' + formatDate(payment.date) + '</span></div>' +
                '<div class="meta-item"><span class="meta-label">' + timeLabel + '</span><span class="meta-value">' + (formatTime(payment.date) || '—') + '</span></div>' +
                '<div class="meta-item"><span class="meta-label">' + methodLabel + '</span><span class="meta-value">' + payment.method + '</span></div>' +
                '<div class="meta-item"><span class="meta-label">' + planLabel + '</span><span class="meta-value">' + (payment.plan === 'premium' ? translate('pages.payments.plan.premium', 'Premium') : translate('pages.payments.plan.basic', 'Basic')) + '</span></div>' +
                '<div class="meta-item"><span class="meta-label">' + descLabel + '</span><span class="meta-value">' + payment.note + '</span></div>' +
            '</div>' +
            '<div class="detail-divider"></div>' +
            '<div class="detail-actions">' +
                '<button class="btn-download-invoice" type="button" data-action="download-invoice" data-payment-id="' + payment.id + '"><i class="fas fa-download"></i> ' + downloadLabel + '</button>' +
                '<button class="btn-contact-support" type="button" data-action="contact-support"><i class="fas fa-headset"></i> ' + supportLabel + '</button>' +
            '</div>' +
        '</div>';

        // Attach action handlers
        let downloadBtn = container.querySelector('[data-action="download-invoice"]');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() { downloadInvoice(payment); });
        }

        let supportBtn = container.querySelector('[data-action="contact-support"]');
        if (supportBtn) {
            supportBtn.addEventListener('click', function() {
                if (window.toastSystem && window.toastSystem.show) {
                    window.toastSystem.show({
                        message: translate('pages.payments.support.message', 'Please contact support@beamshare.app'),
                        type: 'info'
                    });
                }
            });
        }

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDetailModal() {
        let modal = document.querySelector(selectors.detailModal);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        state.selectedId = null;
        let selected = document.querySelector('.payments-table tbody tr.selected');
        if (selected) selected.classList.remove('selected');
    }

    // ===== ACTIONS =====
    function selectPayment(paymentId) {
        // Update selected state
        let prevSelected = document.querySelector('.payments-table tbody tr.selected');
        if (prevSelected) prevSelected.classList.remove('selected');

        let newSelected = document.querySelector('[data-payment-id="' + paymentId + '"]');
        if (newSelected) newSelected.classList.add('selected');

        let payment = state.payments.find(function(p) { return p.id === paymentId; }) || null;
        state.selectedId = payment ? paymentId : null;
        renderDetail(payment);
    }

    function handleStatusFilter(event) {
        state.status = event.target.value;
        update();
    }

    function handleSearch(event) {
        state.search = event.target.value || '';
        update();
    }

    function downloadInvoice(payment) {
        let status = getStatusMeta(payment.status);
        let invoiceHeader = translate('pages.payments.invoice.header', 'BEAMSHARE INVOICE');
        let divider = '==================';
        let invoiceIdLabel = translate('pages.payments.detail.invoice', 'Invoice ID');
        let dateLabel = translate('pages.payments.detail.date', 'Date');
        let statusLabel = translate('pages.payments.detail.status', 'Status');
        let descriptionLabel = translate('pages.payments.detail.description', 'Description');
        let amountLabel = translate('pages.payments.detail.amount', 'Amount');
        let methodLabel = translate('pages.payments.detail.method', 'Method');
        let thankYouLabel = translate('pages.payments.invoice.thanks', 'Thank you for your purchase!');

        let invoiceContent = invoiceHeader + '\n' +
            divider + '\n' +
            invoiceIdLabel + ': ' + payment.id + '\n' +
            dateLabel + ': ' + formatDate(payment.date) + '\n' +
            statusLabel + ': ' + status.label + '\n\n' +
            descriptionLabel + ': ' + payment.note + '\n' +
            amountLabel + ': ' + formatCurrency(payment.amount, payment.currency) + '\n\n' +
            methodLabel + ': ' + payment.method + '\n\n' +
            thankYouLabel + '\n' +
            divider;

        let blob = new Blob([invoiceContent], { type: 'text/plain' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'invoice-' + payment.id + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.toastSystem && window.toastSystem.show) {
            window.toastSystem.show({
                message: translate('pages.payments.actions.invoiceDownloaded', 'Invoice downloaded'),
                type: 'success'
            });
        }
    }

    function exportPayments() {
        if (!state.payments.length) {
            if (window.toastSystem && window.toastSystem.show) {
                window.toastSystem.show({
                    message: translate('pages.payments.export.noData', 'No payments to export'),
                    type: 'warning'
                });
            }
            return;
        }

        let headers = [
            translate('pages.payments.table.date', 'Date'),
            translate('pages.payments.detail.invoice', 'Invoice ID'),
            translate('pages.payments.table.description', 'Description'),
            translate('pages.payments.table.amount', 'Amount'),
            translate('pages.payments.table.currency', 'Currency'),
            translate('pages.payments.table.status', 'Status'),
            translate('pages.payments.table.method', 'Method')
        ];
        let rows = state.payments.map(function(p) {
            return [
                formatDate(p.date),
                p.id,
                p.note,
                p.amount,
                p.currency,
                p.status,
                p.method
            ];
        });

        let csvContent = headers.join(',') + '\n' + rows.map(function(row) {
            return row.map(function(cell) {
                return '"' + String(cell).replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');

        let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'beamshare-payments-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.toastSystem && window.toastSystem.show) {
            window.toastSystem.show({
                message: translate('pages.payments.export.success', 'Payments exported successfully'),
                type: 'success'
            });
        }
    }

    function upgradePlan() {
        fetch('/api/subscriptions/payments/vnpay', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'premium' })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                throw new Error(data.error || 'Unable to create payment');
            }
        })
        .catch(function(error) {
            if (window.toastSystem && window.toastSystem.show) {
                window.toastSystem.show({
                    message: error.message || translate('pages.payments.error.upgrade', 'Unable to upgrade plan'),
                    type: 'error'
                });
            }
        });
    }

    function downgradePlan() {
        if (!confirm(translate('pages.payments.confirm.downgrade', 'Are you sure you want to downgrade to Basic plan?'))) {
            return;
        }

        fetch('/api/subscriptions/plan', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'basic' })
        })
        .then(function(response) {
            return response.json().then(function(data) {
                return { ok: response.ok, data: data };
            });
        })
        .then(function(result) {
            if (result.ok) {
                state.currentPlan = 'basic';
                renderPlanCard();
                renderStats();
                
                if (window.toastSystem && window.toastSystem.show) {
                    window.toastSystem.show({
                        message: translate('pages.payments.success.downgrade', 'Successfully downgraded to Basic plan'),
                        type: 'success'
                    });
                }
            } else {
                throw new Error(result.data.error || 'Unable to downgrade plan');
            }
        })
        .catch(function(error) {
            if (window.toastSystem && window.toastSystem.show) {
                window.toastSystem.show({
                    message: error.message || translate('pages.payments.error.downgrade', 'Unable to downgrade plan'),
                    type: 'error'
                });
            }
        });
    }

    // ===== CONTROLS =====
    function attachControls() {
        let statusEl = document.querySelector(selectors.statusFilter);
        let searchEl = document.querySelector(selectors.searchBox);
        let refreshEl = document.querySelector(selectors.refreshButton);
        let exportEl = document.querySelector(selectors.exportButton);
        let upgradeEl = document.querySelector(selectors.upgradeBtn);
        let downgradeEl = document.querySelector(selectors.downgradeBtn);

        if (statusEl) {
            let handler = function(e) { handleStatusFilter(e); };
            statusEl.addEventListener('change', handler);
            eventUnsubscribers.push(function() { statusEl.removeEventListener('change', handler); });
        }

        if (searchEl) {
            let handler = function(e) { handleSearch(e); };
            searchEl.addEventListener('input', handler);
            eventUnsubscribers.push(function() { searchEl.removeEventListener('input', handler); });
        }

        if (refreshEl) {
            let handler = function() { fetchData(); };
            refreshEl.addEventListener('click', handler);
            eventUnsubscribers.push(function() { refreshEl.removeEventListener('click', handler); });
        }

        if (exportEl) {
            let handler = function() { exportPayments(); };
            exportEl.addEventListener('click', handler);
            eventUnsubscribers.push(function() { exportEl.removeEventListener('click', handler); });
        }

        // Close modal buttons (multiple elements)
        let closeDetailBtns = document.querySelectorAll(selectors.closeDetailBtn);
        closeDetailBtns.forEach(function(btn) {
            let handler = function(e) { 
                e.preventDefault();
                e.stopPropagation();
                closeDetailModal(); 
            };
            btn.addEventListener('click', handler);
            eventUnsubscribers.push(function() { btn.removeEventListener('click', handler); });
        });

        // Also handle click on modal backdrop with event delegation
        let modal = document.querySelector(selectors.detailModal);
        if (modal) {
            let modalHandler = function(e) {
                // Close if clicking directly on modal or backdrop
                if (e.target === modal || e.target.classList.contains('detail-modal-backdrop')) {
                    closeDetailModal();
                }
            };
            modal.addEventListener('click', modalHandler);
            eventUnsubscribers.push(function() { modal.removeEventListener('click', modalHandler); });
        }

        // Close modal on Escape key
        let escHandler = function(e) {
            if (e.key === 'Escape') closeDetailModal();
        };
        document.addEventListener('keydown', escHandler);
        eventUnsubscribers.push(function() { document.removeEventListener('keydown', escHandler); });

        if (upgradeEl) {
            let handler = function() { upgradePlan(); };
            upgradeEl.addEventListener('click', handler);
            eventUnsubscribers.push(function() { upgradeEl.removeEventListener('click', handler); });
        }

        if (downgradeEl) {
            let handler = function() { downgradePlan(); };
            downgradeEl.addEventListener('click', handler);
            eventUnsubscribers.push(function() { downgradeEl.removeEventListener('click', handler); });
        }
    }

    // ===== DATA FETCHING =====
    function fetchData() {
        state.loading = true;
        state.error = null;
        renderTable([]);

        Promise.all([
            fetch('/api/subscriptions/overview', { credentials: 'include' }),
            fetch('/api/subscriptions/payments/history', { credentials: 'include' })
        ])
        .then(function(responses) {
            let overviewRes = responses[0];
            let paymentsRes = responses[1];
            
            if (!overviewRes.ok || !paymentsRes.ok) {
                throw new Error(translate('pages.payments.state.error', 'Unable to load data'));
            }
            
            return Promise.all([overviewRes.json(), paymentsRes.json()]);
        })
        .then(function(data) {
            let overviewData = data[0];
            let paymentsData = data[1];

            // Update state with subscription data
            state.currentPlan = overviewData.currentPlan || 'basic';
            state.plans = overviewData.plans || [];
            state.storage = overviewData.storage || null;

            // Update state with payments data
            let records = Array.isArray(paymentsData.payments)
                ? paymentsData.payments.map(normalizePayment).filter(Boolean)
                : [];

            state.payments = records;
            state.selectedId = records[0] ? records[0].id : null;
            state.loading = false;
            state.error = null;
            update();
        })
        .catch(function(error) {
            let message = (error && error.message) || translate('pages.payments.state.error', 'Unable to load data');
            state.error = message;
            state.payments = [];
            state.loading = false;
            
            if (window.toastSystem && window.toastSystem.show) {
                window.toastSystem.show({ message: message, type: 'error' });
            } else {
                console.error(message);
            }
            update();
        });
    }

    // ===== UPDATE =====
    function update() {
        let filteredRecords = applyFilters(state.payments);
        renderPlanCard();
        renderStats();
        renderTable(filteredRecords);
        // Don't auto-open modal on page load - user needs to click
    }

    // ===== INIT & CLEANUP =====
    window.initPaymentsPage = function initPaymentsPage() {
        attachControls();
        fetchData();
    };

    window.cleanupPaymentsPage = function cleanupPaymentsPage() {
        closeDetailModal();
        eventUnsubscribers.splice(0).forEach(function(unsub) { unsub(); });
        tableEventUnsubscribers.splice(0).forEach(function(unsub) { unsub(); });
    };
})();
