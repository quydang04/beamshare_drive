(() => {
    const state = {
        payments: [],
        status: 'all',
        search: '',
        selectedId: null,
        loading: false,
        error: null
    };

    const selectors = {
        tableBody: '[data-payments-table]',
        statusFilter: '[data-filter="status"]',
        searchBox: '[data-search="payments"]',
        detailContainer: '[data-detail-content]',
        summaryTotal: '[data-binding="total-amount"]',
        summaryCount: '[data-binding="total-count"]',
        summaryLatestAmount: '[data-binding="latest-amount"]',
        summaryLatestStatus: '[data-binding="latest-status"]',
        summaryPlanName: '[data-binding="plan-name"]',
        summaryPlanCycle: '[data-binding="plan-cycle"]',
        detailTitle: '[data-binding="detail-title"]',
        detailSubtitle: '[data-binding="detail-subtitle"]',
        refreshButton: '[data-action="refresh-payments"]',
        exportButton: '[data-action="export-payments"]'
    };

    const eventUnsubscribers = [];

    function translate(key, fallback) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            try {
                const value = window.i18n.t(key);
                if (value && value !== key) {
                    return value;
                }
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
            return `${amount} ${currency}`;
        }
    }

    function formatDate(date) {
        if (!date) {
            return '—';
        }
        if (window.i18n && typeof window.i18n.formatDateTime === 'function') {
            return window.i18n.formatDateTime(date, { year: 'numeric', month: 'short', day: '2-digit' });
        }
        const safeDate = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(safeDate.getTime())) {
            return '—';
        }
        return safeDate.toLocaleString();
    }

    function deriveMethod(payment) {
        const provider = (payment.provider || 'VNPay').toUpperCase();
        if (payment.bankCode) {
            return `${provider} • ${payment.bankCode}`;
        }
        if (payment.txnRef) {
            return `${provider} •• ${String(payment.txnRef).slice(-4)}`;
        }
        return provider;
    }

    function normalizePayment(record) {
        if (!record || typeof record !== 'object') {
            return null;
        }

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
            items: Array.isArray(record.items) ? record.items : [],
            plan: record.plan || 'basic'
        };
    }

    function getStatusMeta(status) {
        const normalisedStatus = (status || '').toLowerCase();
        const map = {
            paid: {
                label: translate('pages.payments.status.paid', 'Paid'),
                className: 'status-paid',
                icon: 'fa-circle-check'
            },
            pending: {
                label: translate('pages.payments.status.pending', 'Pending'),
                className: 'status-pending',
                icon: 'fa-circle-info'
            },
            refunded: {
                label: translate('pages.payments.status.refunded', 'Refunded'),
                className: 'status-refunded',
                icon: 'fa-rotate-left'
            },
            failed: {
                label: translate('pages.payments.status.failed', 'Failed'),
                className: 'status-failed',
                icon: 'fa-circle-xmark'
            },
            canceled: {
                label: translate('pages.payments.status.canceled', 'Canceled'),
                className: 'status-failed',
                icon: 'fa-ban'
            }
        };
        return map[normalisedStatus] || map.pending;
    }

    function applyFilters(records) {
        return records.filter((payment) => {
            const matchesStatus = state.status === 'all' || payment.status === state.status;
            const searchable = `${payment.id} ${payment.note} ${payment.method}`.toLowerCase();
            const matchesSearch = state.search ? searchable.includes(state.search.toLowerCase()) : true;
            return matchesStatus && matchesSearch;
        });
    }

    function renderSummary(records) {
        const totalAmount = records.reduce((sum, payment) => sum + payment.amount, 0);
        const totalCountEl = document.querySelector(selectors.summaryCount);
        const totalAmountEl = document.querySelector(selectors.summaryTotal);
        const latestAmountEl = document.querySelector(selectors.summaryLatestAmount);
        const latestStatusEl = document.querySelector(selectors.summaryLatestStatus);
        const planNameEl = document.querySelector(selectors.summaryPlanName);
        const planCycleEl = document.querySelector(selectors.summaryPlanCycle);

        if (totalAmountEl) {
            totalAmountEl.textContent = records.length
                ? formatCurrency(totalAmount, records[0]?.currency || 'VND')
                : formatCurrency(0, 'VND');
        }

        if (totalCountEl) {
            const totalText = translate('pages.payments.summary.totalCount', () => `${records.length} invoices`);
            totalCountEl.textContent = totalText.replace('{{count}}', records.length);
        }

        const sorted = [...records].sort((a, b) => {
            const aTime = a?.date ? new Date(a.date).getTime() : 0;
            const bTime = b?.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
        });
        const latest = sorted[0];
        if (latest) {
            const statusMeta = getStatusMeta(latest.status);
            if (latestAmountEl) {
                latestAmountEl.textContent = formatCurrency(latest.amount, latest.currency);
            }
            if (latestStatusEl) {
                latestStatusEl.textContent = `${statusMeta.label} • ${formatDate(latest.date)}`;
            }
            if (planNameEl) {
                planNameEl.textContent = translate('pages.payments.summary.planCurrent', () => latest.note).replace('{{plan}}', latest.note);
            }
            if (planCycleEl) {
                planCycleEl.textContent = latest.period || '';
            }
        } else {
            if (latestAmountEl) latestAmountEl.textContent = formatCurrency(0, 'VND');
            if (latestStatusEl) latestStatusEl.textContent = translate('pages.payments.state.empty', 'No payments found');
            if (planNameEl) planNameEl.textContent = '—';
            if (planCycleEl) planCycleEl.textContent = '';
        }
    }

    function renderPlaceholderRow(message) {
        const tbody = document.querySelector(selectors.tableBody);
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5" class="loading-row">${message}</td></tr>`;
    }

    function renderTable(records) {
        const tbody = document.querySelector(selectors.tableBody);
        if (!tbody) return;

        eventUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());

        if (state.loading) {
            renderPlaceholderRow(translate('pages.payments.state.loading', 'Loading payments...'));
            return;
        }

        if (state.error) {
            renderPlaceholderRow(state.error);
            return;
        }

        if (!records.length) {
            renderPlaceholderRow(translate('pages.payments.state.empty', 'No payments found'));
            return;
        }

        const rows = records
            .sort((a, b) => {
                const aTime = a?.date ? new Date(a.date).getTime() : 0;
                const bTime = b?.date ? new Date(b.date).getTime() : 0;
                return bTime - aTime;
            })
            .map((payment) => {
                const status = getStatusMeta(payment.status);
                const amountLabel = formatCurrency(payment.amount, payment.currency);
                const dateLabel = formatDate(payment.date);
                return `
                    <tr data-payment-id="${payment.id}">
                        <td data-label="${translate('pages.payments.table.date', 'Date')}">${dateLabel}</td>
                        <td data-label="${translate('pages.payments.table.note', 'Note')}">
                            <div class="payment-note">${payment.note}</div>
                            <div class="payment-subtext">${payment.method}</div>
                        </td>
                        <td data-label="${translate('pages.payments.table.amount', 'Amount')}" class="amount-cell">${amountLabel}</td>
                        <td data-label="${translate('pages.payments.table.status', 'Status')}">
                            <span class="status-pill ${status.className}"><i class="fas ${status.icon}"></i>${status.label}</span>
                        </td>
                        <td data-label="${translate('pages.payments.table.actions', 'Actions')}" class="column-actions">
                            <button class="action-button" type="button" data-action="view-payment" data-payment-id="${payment.id}">
                                <i class="fas fa-eye"></i>
                                <span>${translate('pages.payments.actions.view', 'View')}</span>
                            </button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        tbody.innerHTML = rows;

        tbody.querySelectorAll('[data-payment-id]').forEach((row) => {
            const handler = () => selectPayment(row.getAttribute('data-payment-id'));
            row.addEventListener('click', handler);
            eventUnsubscribers.push(() => row.removeEventListener('click', handler));
        });
    }

    function renderDetail(payment) {
        const container = document.querySelector(selectors.detailContainer);
        const titleEl = document.querySelector(selectors.detailTitle);
        const subtitleEl = document.querySelector(selectors.detailSubtitle);
        if (!container || !titleEl || !subtitleEl) return;

        if (!payment) {
            container.innerHTML = `
                <div class="empty-detail">
                    <div class="empty-icon"><i class="fas fa-clipboard-list"></i></div>
                    <p>${translate('pages.payments.detail.empty', 'Select a payment from the table to view its receipt and billing info.')}</p>
                </div>
            `;
            titleEl.textContent = translate('pages.payments.detail.title', 'Select a payment');
            subtitleEl.textContent = translate('pages.payments.detail.subtitle', 'Choose a transaction to see full information.');
            return;
        }

        const status = getStatusMeta(payment.status);
        const paymentItems = (payment.items || [])
            .map((item) => `<div class="payment-item-row"><span>${item.name}</span><span>${formatCurrency(item.amount, payment.currency)}</span></div>`)
            .join('');

        container.innerHTML = `
            <div class="payment-meta">
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.invoice', 'Invoice')}</span>
                    <span class="meta-value">${payment.id}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.status', 'Status')}</span>
                    <span class="meta-value status-pill ${status.className}"><i class="fas ${status.icon}"></i>${status.label}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.date', 'Date')}</span>
                    <span class="meta-value">${formatDate(payment.date)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.method', 'Payment method')}</span>
                    <span class="meta-value">${payment.method}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.period', 'Coverage')}</span>
                    <span class="meta-value">${payment.period || '—'}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${translate('pages.payments.detail.total', 'Total')}</span>
                    <span class="meta-value">${formatCurrency(payment.amount, payment.currency)}</span>
                </div>
            </div>
            <div class="payment-items">
                <h4>${translate('pages.payments.detail.items', 'Items')}</h4>
                ${paymentItems || `<div class="payment-item-row"><span>${translate('pages.payments.detail.invoice', 'Invoice')}</span><span>${formatCurrency(payment.amount, payment.currency)}</span></div>`}
                <div class="payment-total">
                    <span>${translate('pages.payments.detail.total', 'Total')}</span>
                    <span>${formatCurrency(payment.amount, payment.currency)}</span>
                </div>
            </div>
        `;

        titleEl.textContent = translate('pages.payments.detail.for', () => `Invoice ${payment.id}`).replace('{{id}}', payment.id);
        subtitleEl.textContent = translate('pages.payments.detail.subtitle', 'Choose a transaction to see full information.');
    }

    function selectPayment(paymentId) {
        const payment = state.payments.find((item) => item.id === paymentId) || null;
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

    function attachControls() {
        const statusEl = document.querySelector(selectors.statusFilter);
        const searchEl = document.querySelector(selectors.searchBox);
        const refreshEl = document.querySelector(selectors.refreshButton);
        const exportEl = document.querySelector(selectors.exportButton);

        if (statusEl) {
            const handler = (event) => handleStatusFilter(event);
            statusEl.addEventListener('change', handler);
            eventUnsubscribers.push(() => statusEl.removeEventListener('change', handler));
        }

        if (searchEl) {
            const handler = (event) => handleSearch(event);
            searchEl.addEventListener('input', handler);
            eventUnsubscribers.push(() => searchEl.removeEventListener('input', handler));
        }

        if (refreshEl) {
            const handler = () => fetchPayments();
            refreshEl.addEventListener('click', handler);
            eventUnsubscribers.push(() => refreshEl.removeEventListener('click', handler));
        }

        if (exportEl) {
            const handler = () => {
                const info = translate('pages.payments.actions.exportHint', 'Export is simulated in this demo environment.');
                if (window.toastSystem?.show) {
                    window.toastSystem.show({ message: info, type: 'info' });
                } else {
                    console.info(info);
                }
            };
            exportEl.addEventListener('click', handler);
            eventUnsubscribers.push(() => exportEl.removeEventListener('click', handler));
        }
    }

    async function fetchPayments() {
        state.loading = true;
        state.error = null;
        renderTable([]);

        try {
            const response = await fetch('/api/subscriptions/payments/history', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(translate('pages.payments.state.error', 'Unable to load payment history.'));
            }

            const payload = await response.json();
            const records = Array.isArray(payload?.payments)
                ? payload.payments.map(normalizePayment).filter(Boolean)
                : [];

            state.payments = records;
            state.selectedId = records[0]?.id || null;
        } catch (error) {
            const message = error?.message || translate('pages.payments.state.error', 'Unable to load payment history.');
            state.error = message;
            state.payments = [];
            if (window.toastSystem?.show) {
                window.toastSystem.show({ message, type: 'error' });
            } else {
                console.error(message);
            }
        } finally {
            state.loading = false;
            update();
        }
    }

    function update() {
        const filteredRecords = applyFilters(state.payments);
        renderTable(filteredRecords);
        renderSummary(state.payments);

        const selected = state.payments.find((item) => item.id === state.selectedId) || filteredRecords[0] || null;
        state.selectedId = selected?.id || null;
        renderDetail(selected);
    }

    window.initPaymentsPage = function initPaymentsPage() {
        attachControls();
        fetchPayments();
    };

    window.cleanupPaymentsPage = function cleanupPaymentsPage() {
        eventUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    };
})();
