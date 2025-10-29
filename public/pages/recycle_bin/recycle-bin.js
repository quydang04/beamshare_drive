const RETENTION_DAYS = 30;
const tableBody = document.getElementById('recycle-table-body');
const tableContainer = document.getElementById('recycle-table-container');
const loadingState = document.getElementById('recycle-loading');
const emptyState = document.getElementById('recycle-empty');
const refreshButton = document.getElementById('refresh-recycle');
const summaryTotal = document.querySelector('#summary-total span');

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
        return '—';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exponent]}`;
}

function formatDateTime(value) {
    if (!value) {
        return '—';
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
        return '—';
    }
}

function formatRemainingTime(expiresAt) {
    if (!expiresAt) {
        return '—';
    }

    const now = Date.now();
    const expiry = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
    if (Number.isNaN(expiry)) {
        return '—';
    }

    const diff = expiry - now;
    if (diff <= 0) {
        return '<span class="time-expired">Sắp xóa</span>';
    }

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days} ngày ${hours} giờ`;
    }
    if (hours > 0) {
        return `${hours} giờ ${minutes} phút`;
    }
    return `${Math.max(minutes, 1)} phút`;
}

function renderRows(files = []) {
    tableBody.innerHTML = '';

    files.forEach((file) => {
        const row = document.createElement('tr');
        const displayName = escapeHtml(file.displayName || file.originalName);
        const originalName = escapeHtml(file.originalName || '');
        const remainingHtml = formatRemainingTime(file.recycleExpiresAt);
        row.innerHTML = `
            <td>
                <div class="file-name">
                    <strong>${displayName}</strong>
                    ${file.displayName !== file.originalName && file.originalName ? `<div class="file-name__muted">${originalName}</div>` : ''}
                </div>
            </td>
            <td>${formatFileSize(file.size)}</td>
            <td>${formatDateTime(file.deletedAt)}</td>
            <td>${remainingHtml}</td>
            <td class="actions">
                <div class="recycle-actions">
                    <button class="recycle-action-btn restore" type="button">
                        <i class="fas fa-undo"></i>
                        Khôi phục
                    </button>
                    <button class="recycle-action-btn delete" type="button">
                        <i class="fas fa-trash-alt"></i>
                        Xóa vĩnh viễn
                    </button>
                </div>
            </td>
        `;

        const [restoreBtn, deleteBtn] = row.querySelectorAll('button');
        restoreBtn.dataset.file = file.internalName;
        deleteBtn.dataset.file = file.internalName;
        restoreBtn.addEventListener('click', () => handleRestore(file));
        deleteBtn.addEventListener('click', () => handlePermanentDelete(file));
        tableBody.appendChild(row);
    });
}

function setViewState({ isLoading, hasData }) {
    if (isLoading) {
        loadingState?.removeAttribute('hidden');
    } else {
        loadingState?.setAttribute('hidden', '');
    }

    if (!hasData && !isLoading) {
        emptyState?.removeAttribute('hidden');
        tableContainer?.setAttribute('hidden', '');
    } else if (hasData) {
        emptyState?.setAttribute('hidden', '');
        tableContainer?.removeAttribute('hidden');
    }
}

async function fetchRecycleBin() {
    setViewState({ isLoading: true, hasData: false });
    try {
        const response = await fetch('/api/recycle-bin');
        if (!response.ok) {
            throw new Error(await response.text() || 'Không thể tải thùng rác');
        }

        const payload = await response.json();
        const files = Array.isArray(payload?.files) ? payload.files : [];

        summaryTotal.textContent = `${files.length} tệp`;
        renderRows(files);
        setViewState({ isLoading: false, hasData: files.length > 0 });
    } catch (error) {
        console.error('Recycle bin load failed:', error);
        summaryTotal.textContent = 'Không thể tải';
        setViewState({ isLoading: false, hasData: false });
        window.toastSystem?.error('Không thể tải danh sách thùng rác. Vui lòng thử lại.');
    }
}

async function handleRestore(file) {
    const displayName = file.displayName || file.originalName;
    const confirmMessage = `Khôi phục "${displayName}" về thư mục My Files?`;
    const confirmed = await askForConfirmation({
        title: 'Khôi phục tệp',
        message: confirmMessage,
        confirmText: 'Khôi phục'
    });

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/recycle-bin/${encodeURIComponent(file.internalName)}/restore`, {
            method: 'POST'
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Không thể khôi phục tệp');
        }

        window.toastSystem?.success(`Đã khôi phục "${displayName}".`);
        await fetchRecycleBin();
    } catch (error) {
        console.error('Restore failed:', error);
        window.toastSystem?.error(error.message || 'Không thể khôi phục tệp.');
    }
}

async function handlePermanentDelete(file) {
    const displayName = file.displayName || file.originalName;
    const confirmMessage = `Xóa vĩnh viễn "${displayName}"? Hành động này không thể hoàn tác.`;
    const confirmed = await askForConfirmation({
        title: 'Xóa vĩnh viễn',
        message: confirmMessage,
        confirmText: 'Xóa vĩnh viễn',
        confirmClass: 'btn-danger'
    });

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/recycle-bin/${encodeURIComponent(file.internalName)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Không thể xóa vĩnh viễn tệp');
        }

        window.toastSystem?.success(`Đã xóa vĩnh viễn "${displayName}".`);
        await fetchRecycleBin();
    } catch (error) {
        console.error('Permanent delete failed:', error);
        window.toastSystem?.error(error.message || 'Không thể xóa vĩnh viễn tệp.');
    }
}

async function askForConfirmation(options) {
    if (window.modalSystem && typeof window.modalSystem.confirm === 'function') {
        return window.modalSystem.confirm({
            cancelText: 'Hủy',
            ...options
        });
    }

    return window.confirm(options?.message || 'Bạn có chắc chắn?');
}

refreshButton?.addEventListener('click', () => {
    fetchRecycleBin();
});

document.addEventListener('DOMContentLoaded', () => {
    summaryTotal.textContent = 'Đang tải...';
    fetchRecycleBin();
});

window.recycleBin = {
    refresh: fetchRecycleBin,
    retentionDays: RETENTION_DAYS
};
