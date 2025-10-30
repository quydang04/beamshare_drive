(function () {
    const RETENTION_DAYS = 30;
    const API_ENDPOINT = '/api/recycle-bin';

    const state = {
        initialized: false,
        files: [],
        filteredFiles: [],
        selected: new Set(),
        searchTerm: '',
        abortController: null,
        searchDebounceId: null,
        busyAction: null,
        handlers: {}
    };

    let elements = {};

    function queryElements() {
        return {
            root: document.getElementById('recycle-page'),
            tableBody: document.getElementById('recycle-table-body'),
            tableContainer: document.getElementById('recycle-table-container'),
            loadingState: document.getElementById('recycle-loading'),
            emptyState: document.getElementById('recycle-empty'),
            refreshButton: document.getElementById('refresh-recycle'),
            summaryTotal: document.querySelector('#summary-total span'),
            searchInput: document.getElementById('recycle-search'),
            selectionBar: document.getElementById('recycle-selection-bar'),
            selectionCount: document.getElementById('recycle-selection-count'),
            selectionRestore: document.getElementById('recycle-selection-restore'),
            selectionDelete: document.getElementById('recycle-selection-delete'),
            selectionCancel: document.getElementById('recycle-selection-cancel'),
            selectAll: document.getElementById('recycle-select-all'),
            table: document.querySelector('.recycle-table')
        };
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatFileSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return '�';
        }
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, exponent);
        return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exponent]}`;
    }

    function formatDateTime(value) {
        if (!value) {
            return '�';
        }

        try {
            const date = value instanceof Date ? value : new Date(value);
            return new Intl.DateTimeFormat('vi-VN', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (_error) {
            return '';
        }
    }

    function formatRemainingTime(expiresAt) {
        if (!expiresAt) {
            return '�';
        }

        const now = Date.now();
        const expiry = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
        if (Number.isNaN(expiry)) {
            return '�';
        }

        const diff = expiry - now;
        if (diff <= 0) {
            return '<span class="recycle-time-expired">S?p x�a</span>';
        }

        const totalMinutes = Math.floor(diff / 60000);
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return `${days} ng�y ${hours} gi?`;
        }
        if (hours > 0) {
            return `${hours} gi? ${minutes} ph�t`;
        }
        return `${Math.max(minutes, 1)} ph�t`;
    }

    function sanitizeIdSegment(value) {
        return String(value || '')
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 64);
    }

    function getFileDisplayName(file) {
        if (!file) {
            return '';
        }
        return file.displayName || file.originalName || file.internalName || '';
    }

    function pruneSelection() {
        if (!state.selected.size) {
            return;
        }

        const validIds = new Set(state.files.map((file) => file.internalName));
        for (const fileId of Array.from(state.selected)) {
            if (!validIds.has(fileId)) {
                state.selected.delete(fileId);
            }
        }
    }

    function updateSummaryDisplay() {
        if (!elements.summaryTotal) {
            return;
        }

        const total = state.files.length;
        if (!total) {
            elements.summaryTotal.textContent = '0 m?c';
            return;
        }

        const filteredCount = state.filteredFiles.length;
        const trimmedTerm = state.searchTerm.trim();
        if (trimmedTerm && filteredCount !== total) {
            elements.summaryTotal.textContent = `${filteredCount}/${total} m?c`;
        } else {
            elements.summaryTotal.textContent = `${total} m?c`;
        }
    }

    function syncRowSelectionState() {
        if (!elements.tableBody) {
            return;
        }

        const checkboxes = elements.tableBody.querySelectorAll('.recycle-row-checkbox');
        checkboxes.forEach((checkbox) => {
            const fileId = checkbox.getAttribute('data-file-id');
            const isSelected = fileId ? state.selected.has(fileId) : false;
            checkbox.checked = isSelected;
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.toggle('is-selected', isSelected);
            }
        });
    }

    function syncSelectAllCheckbox() {
        if (!elements.selectAll) {
            return;
        }

        const visibleCount = state.filteredFiles.length;
        if (!visibleCount) {
            elements.selectAll.checked = false;
            elements.selectAll.indeterminate = false;
            elements.selectAll.disabled = state.files.length === 0 || Boolean(state.busyAction);
            return;
        }

        const selectedVisibleCount = state.filteredFiles.filter((file) => state.selected.has(file.internalName)).length;
        elements.selectAll.disabled = Boolean(state.busyAction);
        elements.selectAll.checked = selectedVisibleCount === visibleCount;
        elements.selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleCount;
    }

    function updateSelectionSummary() {
        if (!elements.selectionBar) {
            return;
        }

        const selectedCount = state.selected.size;
        if (selectedCount > 0) {
            elements.selectionBar.removeAttribute('hidden');
        } else {
            elements.selectionBar.setAttribute('hidden', '');
        }

        if (elements.selectionCount) {
            elements.selectionCount.textContent = selectedCount.toString();
        }

        const disableActions = selectedCount === 0 || Boolean(state.busyAction);
        if (elements.selectionRestore) {
            elements.selectionRestore.disabled = disableActions || state.busyAction === 'delete';
        }
        if (elements.selectionDelete) {
            elements.selectionDelete.disabled = disableActions || state.busyAction === 'restore';
        }
        if (elements.selectionCancel) {
            elements.selectionCancel.disabled = disableActions || Boolean(state.busyAction);
        }

        syncSelectAllCheckbox();
    }

    function applyFiltersAndRender() {
        const term = state.searchTerm.trim().toLowerCase();
        const filtered = term
            ? state.files.filter((file) => getFileDisplayName(file).toLowerCase().includes(term))
            : [...state.files];

        state.filteredFiles = filtered;

        renderRows(filtered);
        updateSummaryDisplay();
        syncRowSelectionState();
        syncSelectAllCheckbox();
        updateSelectionSummary();
        setViewState({ isLoading: false, hasData: state.files.length > 0 });
    }

    function clearSelection({ silent = false } = {}) {
        const hadSelection = state.selected.size > 0;

        if (hadSelection) {
            state.selected.clear();
        }

        if (!silent) {
            syncRowSelectionState();
            syncSelectAllCheckbox();
            updateSelectionSummary();
        } else if (hadSelection) {
            syncSelectAllCheckbox();
        }
    }

    function selectAllVisibleFiles() {
        if (!state.filteredFiles.length) {
            return;
        }

        state.filteredFiles.forEach((file) => {
            if (file?.internalName) {
                state.selected.add(file.internalName);
            }
        });

        syncRowSelectionState();
        syncSelectAllCheckbox();
        updateSelectionSummary();
    }

    function deselectVisibleFiles() {
        if (!state.filteredFiles.length) {
            return;
        }

        state.filteredFiles.forEach((file) => {
            if (file?.internalName) {
                state.selected.delete(file.internalName);
            }
        });

        syncRowSelectionState();
        syncSelectAllCheckbox();
        updateSelectionSummary();
    }

    function setBulkActionLoading(action, isLoading) {
        const targetButton = action === 'delete' ? elements.selectionDelete : elements.selectionRestore;
        if (!targetButton) {
            return;
        }

        if (isLoading) {
            if (!targetButton.dataset.originalHtml) {
                targetButton.dataset.originalHtml = targetButton.innerHTML;
            }
            targetButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action === 'delete' ? '�ang x�a' : '�ang kh�i ph?c'}`;
            targetButton.disabled = true;
            state.busyAction = action;
            if (elements.selectionCancel) {
                elements.selectionCancel.disabled = true;
            }
            if (action === 'restore' && elements.selectionDelete) {
                elements.selectionDelete.disabled = true;
            }
            if (action === 'delete' && elements.selectionRestore) {
                elements.selectionRestore.disabled = true;
            }
            if (elements.selectAll) {
                elements.selectAll.disabled = true;
            }
        } else {
            if (targetButton.dataset.originalHtml) {
                targetButton.innerHTML = targetButton.dataset.originalHtml;
                delete targetButton.dataset.originalHtml;
            }
            state.busyAction = null;
            if (elements.selectAll) {
                elements.selectAll.disabled = false;
            }
            updateSelectionSummary();
        }
    }

    function handleSearchInput(event) {
        const nextTerm = event?.target?.value || '';

        if (state.searchDebounceId) {
            clearTimeout(state.searchDebounceId);
        }

        state.searchDebounceId = setTimeout(() => {
            state.searchTerm = nextTerm;
            applyFiltersAndRender();
            state.searchDebounceId = null;
        }, 150);
    }

    function handleCancelSelection() {
        clearSelection();
    }

    async function executeBulkAction(action, endpoint, successTemplate, failureTemplate) {
        const fileIds = Array.from(state.selected);
        if (!fileIds.length) {
            return;
        }

        setBulkActionLoading(action, true);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: fileIds })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success !== true) {
                throw new Error(payload.error || 'Thao t�c kh�ng th�nh c�ng');
            }

            const results = Array.isArray(payload.results) ? payload.results : [];
            const successCount = typeof payload.restored === 'number' || typeof payload.deleted === 'number'
                ? (payload.restored ?? payload.deleted)
                : (results.length ? results.filter((item) => item && item.success).length : fileIds.length);
            const failedEntries = results.length ? results.filter((item) => !item?.success) : [];
            const failedCount = typeof payload.failed === 'number' ? payload.failed : failedEntries.length;

            if (successCount > 0) {
                window.toastSystem?.success(successTemplate(successCount));
            }

            if (failedCount > 0) {
                const failedNames = failedEntries.slice(0, 3)
                    .map((entry) => entry?.displayName || entry?.internalName || entry?.fileId)
                    .filter(Boolean);
                const suffix = failedCount > failedNames.length ? '...' : '';
                window.toastSystem?.error(failureTemplate(failedCount, failedNames, suffix));
            }

            clearSelection();
            await fetchRecycleBin();
        } catch (error) {
            console.error(`Bulk ${action} failed:`, error);
            window.toastSystem?.error(error.message || 'Kh�ng th? ho�n t?t thao t�c.');
        } finally {
            setBulkActionLoading(action, false);
        }
    }

    async function handleBulkRestoreSelected() {
        const fileIds = Array.from(state.selected);
        if (!fileIds.length || state.busyAction) {
            return;
        }

        const message = fileIds.length === 1
            ? 'Kh�i ph?c m?c d� ch?n v? thu m?c My Files?'
            : `Kh�i ph?c ${fileIds.length} m?c d� ch?n v? thu m?c My Files?`;

        const confirmed = await askForConfirmation({
            title: 'Kh�i ph?c h�ng lo?t',
            message,
            confirmText: 'Kh�i ph?c'
        });

        if (!confirmed) {
            return;
        }

        await executeBulkAction(
            'restore',
            '/api/recycle-bin/bulk/restore',
            (count) => `�� kh�i ph?c ${count} m?c.`,
            (total, names, suffix) => {
                const detail = names.length ? ` (${names.join(', ')}${suffix})` : '';
                return `Kh�ng th? kh�i ph?c ${total} m?c${detail}.`;
            }
        );
    }

    async function handleBulkDeleteSelected() {
        const fileIds = Array.from(state.selected);
        if (!fileIds.length || state.busyAction) {
            return;
        }

        const message = fileIds.length === 1
            ? 'X�a vinh vi?n m?c d� ch?n? H�nh d?ng n�y kh�ng th? ho�n t�c.'
            : `X�a vinh vi?n ${fileIds.length} m?c d� ch?n? H�nh d?ng n�y kh�ng th? ho�n t�c.`;

        const confirmed = await askForConfirmation({
            title: 'X�a vinh vi?n h�ng lo?t',
            message,
            confirmText: 'X�a vinh vi?n',
            confirmClass: 'btn-danger'
        });

        if (!confirmed) {
            return;
        }

        await executeBulkAction(
            'delete',
            '/api/recycle-bin/bulk/delete',
            (count) => `�� x�a vinh vi?n ${count} m?c.`,
            (total, names, suffix) => {
                const detail = names.length ? ` (${names.join(', ')}${suffix})` : '';
                return `Kh�ng th? x�a ${total} m?c${detail}.`;
            }
        );
    }

    function setViewState({ isLoading, hasData }) {
        if (!elements.root) {
            return;
        }

        if (isLoading) {
            elements.loadingState?.removeAttribute('hidden');
        } else {
            elements.loadingState?.setAttribute('hidden', '');
        }

        if (!hasData && !isLoading) {
            elements.emptyState?.removeAttribute('hidden');
            elements.tableContainer?.setAttribute('hidden', '');
        } else if (hasData) {
            elements.emptyState?.setAttribute('hidden', '');
            elements.tableContainer?.removeAttribute('hidden');
        }
    }

    function renderRows(files = []) {
        if (!elements.tableBody) {
            return;
        }

        elements.tableBody.innerHTML = '';

        if (!files.length) {
            if (!state.files.length) {
                return;
            }

            const emptyRow = document.createElement('tr');
            emptyRow.className = 'recycle-empty-row';
            emptyRow.innerHTML = `
                <td colspan="6">
                    <div class="recycle-empty-row__content">
                        <i class="fas fa-search" aria-hidden="true"></i>
                        <p>Kh�ng t�m th?y t?p ph� h?p v?i t�m ki?m hi?n t?i.</p>
                    </div>
                </td>
            `;
            elements.tableBody.appendChild(emptyRow);
            return;
        }

        files.forEach((file) => {
            if (!file || !file.internalName) {
                return;
            }

            const row = document.createElement('tr');
            row.dataset.fileId = file.internalName;
            const displayName = escapeHtml(file.displayName || file.originalName || file.internalName);
            const originalName = escapeHtml(file.originalName || '');
            const remainingHtml = formatRemainingTime(file.recycleExpiresAt);
            const isSelected = state.selected.has(file.internalName);
            if (isSelected) {
                row.classList.add('is-selected');
            }
            const sanitizedIdSegment = sanitizeIdSegment(file.internalName) || Math.random().toString(36).slice(2, 10);
            const checkboxId = `recycle-select-${sanitizedIdSegment}`;

            row.innerHTML = `
                <td class="select-col">
                    <label class="sr-only" for="${checkboxId}">Ch?n ${displayName}</label>
                    <input type="checkbox" class="recycle-row-checkbox" id="${checkboxId}" data-file-id="${escapeHtml(file.internalName)}"${isSelected ? ' checked' : ''}>
                </td>
                <td>
                    <div class="recycle-file-name">
                        <strong>${displayName}</strong>
                        ${file.displayName !== file.originalName && file.originalName ? `<small>${originalName}</small>` : ''}
                    </div>
                </td>
                <td>${formatFileSize(file.size)}</td>
                <td>${formatDateTime(file.deletedAt)}</td>
                <td>${remainingHtml}</td>
                <td class="actions">
                    <div class="recycle-actions">
                        <button class="recycle-action-btn restore" type="button">
                            <i class="fas fa-undo"></i>
                            Kh�i ph?c
                        </button>
                        <button class="recycle-action-btn delete" type="button">
                            <i class="fas fa-trash-alt"></i>
                            X�a vinh vi?n
                        </button>
                    </div>
                </td>
            `;

            const checkbox = row.querySelector('.recycle-row-checkbox');
            const restoreBtn = row.querySelector('.recycle-action-btn.restore');
            const deleteBtn = row.querySelector('.recycle-action-btn.delete');

            checkbox?.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            checkbox?.addEventListener('change', (event) => {
                const shouldSelect = Boolean(event.target.checked);
                if (shouldSelect) {
                    state.selected.add(file.internalName);
                } else {
                    state.selected.delete(file.internalName);
                }
                syncRowSelectionState();
                syncSelectAllCheckbox();
                updateSelectionSummary();
            });

            restoreBtn?.addEventListener('click', () => handleRestore(file));
            deleteBtn?.addEventListener('click', () => handlePermanentDelete(file));

            elements.tableBody.appendChild(row);
        });
    }

    function handleTableBodyClick(event) {
        if (event.target.closest('.recycle-action-btn') || event.target.closest('.recycle-row-checkbox')) {
            return;
        }

        const row = event.target.closest('tr[data-file-id]');
        if (!row) {
            return;
        }

        const fileId = row.getAttribute('data-file-id');
        if (!fileId) {
            return;
        }

        if (state.selected.has(fileId)) {
            state.selected.delete(fileId);
        } else {
            state.selected.add(fileId);
        }

        syncRowSelectionState();
        syncSelectAllCheckbox();
        updateSelectionSummary();
    }

    async function fetchRecycleBin() {
        if (!state.initialized) {
            return;
        }

        state.abortController?.abort();
        const controller = new AbortController();
        state.abortController = controller;

        setViewState({ isLoading: true, hasData: false });

        try {
            const response = await fetch(API_ENDPOINT, { signal: controller.signal });
            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            const payload = isJson ? await response.json().catch(() => ({})) : {};

            if (!response.ok) {
                throw new Error(payload?.error || 'Kh�ng th? t?i th�ng r�c');
            }

            const files = Array.isArray(payload?.files) ? payload.files : [];

            state.files = files;
            pruneSelection();
            applyFiltersAndRender();
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            console.error('Recycle bin load failed:', error);
            if (elements.summaryTotal) {
                elements.summaryTotal.textContent = 'Kh�ng th? t?i';
            }
            setViewState({ isLoading: false, hasData: false });
            window.toastSystem?.error(error.message || 'Kh�ng th? t?i danh s�ch th�ng r�c. Vui l�ng th? l?i.');
        } finally {
            if (state.abortController === controller) {
                state.abortController = null;
            }
        }
    }

    async function handleRestore(file) {
        const displayName = file.displayName || file.originalName || file.internalName;
        const confirmMessage = `Kh�i ph?c "${displayName}" v? thu m?c My Files?`;
        const confirmed = await askForConfirmation({
            title: 'Kh�i ph?c t?p',
            message: confirmMessage,
            confirmText: 'Kh�i ph?c'
        });

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`${API_ENDPOINT}/${encodeURIComponent(file.internalName)}/restore`, {
                method: 'POST'
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'Kh�ng th? kh�i ph?c t?p');
            }

            window.toastSystem?.success(payload?.message || `�� kh�i ph?c "${displayName}".`);
            state.selected.delete(file.internalName);
            updateSelectionSummary();
            syncRowSelectionState();
            syncSelectAllCheckbox();
            await fetchRecycleBin();
        } catch (error) {
            console.error('Restore failed:', error);
            window.toastSystem?.error(error.message || 'Kh�ng th? kh�i ph?c t?p.');
        }
    }

    async function handlePermanentDelete(file) {
        const displayName = file.displayName || file.originalName || file.internalName;
        const confirmMessage = `X�a vinh vi?n "${displayName}"? H�nh d?ng n�y kh�ng th? ho�n t�c.`;
        const confirmed = await askForConfirmation({
            title: 'X�a vinh vi?n',
            message: confirmMessage,
            confirmText: 'X�a vinh vi?n',
            confirmClass: 'btn-danger'
        });

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`${API_ENDPOINT}/${encodeURIComponent(file.internalName)}`, {
                method: 'DELETE'
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'Kh�ng th? x�a vinh vi?n t?p');
            }

            window.toastSystem?.success(payload?.message || `�� x�a vinh vi?n "${displayName}".`);
            state.selected.delete(file.internalName);
            updateSelectionSummary();
            syncRowSelectionState();
            syncSelectAllCheckbox();
            await fetchRecycleBin();
        } catch (error) {
            console.error('Permanent delete failed:', error);
            window.toastSystem?.error(error.message || 'Kh�ng th? x�a vinh vi?n t?p.');
        }
    }

    async function askForConfirmation(options) {
        if (window.modalSystem && typeof window.modalSystem.confirm === 'function') {
            return window.modalSystem.confirm({
                cancelText: 'H?y',
                ...options
            });
        }

        return window.confirm(options?.message || 'B?n c� ch?c ch?n?');
    }

    function attachEventListeners() {
        state.handlers.refresh = () => fetchRecycleBin();
        elements.refreshButton?.addEventListener('click', state.handlers.refresh);

        if (elements.searchInput) {
            state.handlers.search = handleSearchInput;
            elements.searchInput.addEventListener('input', state.handlers.search);
        }

        if (elements.selectionCancel) {
            state.handlers.cancelSelection = handleCancelSelection;
            elements.selectionCancel.addEventListener('click', state.handlers.cancelSelection);
        }

        if (elements.selectionRestore) {
            state.handlers.bulkRestore = handleBulkRestoreSelected;
            elements.selectionRestore.addEventListener('click', state.handlers.bulkRestore);
        }

        if (elements.selectionDelete) {
            state.handlers.bulkDelete = handleBulkDeleteSelected;
            elements.selectionDelete.addEventListener('click', state.handlers.bulkDelete);
        }

        if (elements.selectAll) {
            state.handlers.selectAll = (event) => {
                const shouldSelect = Boolean(event?.target?.checked);
                if (shouldSelect) {
                    selectAllVisibleFiles();
                } else {
                    deselectVisibleFiles();
                }
            };
            elements.selectAll.addEventListener('change', state.handlers.selectAll);
        }

        if (elements.tableBody) {
            state.handlers.tableClick = handleTableBodyClick;
            elements.tableBody.addEventListener('click', state.handlers.tableClick);
        }
    }

    function detachEventListeners() {
        if (state.handlers.refresh && elements.refreshButton) {
            elements.refreshButton.removeEventListener('click', state.handlers.refresh);
            state.handlers.refresh = null;
        }

        if (state.handlers.search && elements.searchInput) {
            elements.searchInput.removeEventListener('input', state.handlers.search);
            state.handlers.search = null;
        }

        if (state.handlers.cancelSelection && elements.selectionCancel) {
            elements.selectionCancel.removeEventListener('click', state.handlers.cancelSelection);
            state.handlers.cancelSelection = null;
        }

        if (state.handlers.bulkRestore && elements.selectionRestore) {
            elements.selectionRestore.removeEventListener('click', state.handlers.bulkRestore);
            state.handlers.bulkRestore = null;
        }

        if (state.handlers.bulkDelete && elements.selectionDelete) {
            elements.selectionDelete.removeEventListener('click', state.handlers.bulkDelete);
            state.handlers.bulkDelete = null;
        }

        if (state.handlers.selectAll && elements.selectAll) {
            elements.selectAll.removeEventListener('change', state.handlers.selectAll);
            state.handlers.selectAll = null;
        }

        if (state.handlers.tableClick && elements.tableBody) {
            elements.tableBody.removeEventListener('click', state.handlers.tableClick);
            state.handlers.tableClick = null;
        }
    }

    window.initRecycleBin = function initRecycleBin() {
        elements = queryElements();

        if (!elements.root) {
            console.warn('Recycle bin root element not found.');
            return;
        }

        state.initialized = true;
        state.searchTerm = '';
        state.filteredFiles = [];
        state.selected.clear();
        state.busyAction = null;
        if (state.searchDebounceId) {
            clearTimeout(state.searchDebounceId);
            state.searchDebounceId = null;
        }

        if (elements.searchInput) {
            elements.searchInput.value = '';
        }

        if (elements.summaryTotal) {
            elements.summaryTotal.textContent = '0 m?c';
        }

        updateSelectionSummary();
        syncSelectAllCheckbox();

        attachEventListeners();
        fetchRecycleBin();
    };

    window.cleanupRecycleBin = function cleanupRecycleBin() {
        if (!state.initialized) {
            return;
        }

        detachEventListeners();
        state.abortController?.abort();
        state.abortController = null;

        if (elements.tableBody) {
            elements.tableBody.innerHTML = '';
        }
        if (elements.summaryTotal) {
            elements.summaryTotal.textContent = '0 m?c';
        }

        if (elements.searchInput) {
            elements.searchInput.value = '';
        }

        elements = {};
        state.files = [];
        state.filteredFiles = [];
        state.selected.clear();
        state.searchTerm = '';
        state.busyAction = null;
        if (state.searchDebounceId) {
            clearTimeout(state.searchDebounceId);
            state.searchDebounceId = null;
        }
        state.initialized = false;
    };

    window.recycleBin = {
        refresh: () => fetchRecycleBin(),
        retentionDays: RETENTION_DAYS
    };
})();
