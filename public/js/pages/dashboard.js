// Dashboard Page JavaScript
(function() {
    const DASHBOARD_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
    const TYPE_COLORS = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9'];

    const formatBytes = typeof window.formatFileSize === 'function'
        ? window.formatFileSize
        : (bytes = 0) => {
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
            const value = bytes / Math.pow(k, i);
            return `${value.toFixed(value >= 10 || i === 0 ? 0 : 2)} ${sizes[i]}`;
        };

    const formatDateTime = (value) => {
        const date = parseDate(value);
        if (!date) return '-';
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatRelativeTime = (value) => {
        const date = parseDate(value);
        if (!date) return '-';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        if (!Number.isFinite(diffMs)) return '-';

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMs < 0) {
            return 'Trong tương lai';
        }
        if (diffMinutes < 1) return 'Vừa xong';
        if (diffMinutes < 60) return `${diffMinutes} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays === 1) return 'Hôm qua';
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const parseDate = (value) => {
        if (!value || value === 0 || value === '0') return null;
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const extractTimestamp = (file) => {
        if (!file) return 0;
        const candidates = [
            file.uploadDate,
            file.uploadedAt,
            file.createdAt,
            file.updatedAt,
            file.metadata?.uploadDate,
            file.metadata?.uploadedAt,
            file.metadata?.createdAt,
            file.metadata?.updatedAt
        ];
        for (const candidate of candidates) {
            const date = parseDate(candidate);
            if (date) return date.getTime();
        }
        return 0;
    };

    const toNumericSize = (value) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
    };

    const getFileIconClass = (file) => {
        if (!file) return 'fa-file';
        if (file.isImage) return 'fa-file-image';
        if (file.isVideo) return 'fa-file-video';
        if (file.isAudio) return 'fa-file-audio';
        if (file.isDocument) return 'fa-file-lines';
        const ext = (file.extension || '').toLowerCase();
        if (['.doc', '.docx'].includes(ext)) return 'fa-file-word';
        if (['.xls', '.xlsx'].includes(ext)) return 'fa-file-excel';
        if (['.ppt', '.pptx'].includes(ext)) return 'fa-file-powerpoint';
        if (['.pdf'].includes(ext)) return 'fa-file-pdf';
        if (['.zip', '.rar', '.7z'].includes(ext)) return 'fa-file-zipper';
        return 'fa-file';
    };

    const state = {
        files: [],
        quotaBytes: DASHBOARD_QUOTA_BYTES,
        lastUpdated: null
    };

    const elements = {};

    window.initDashboard = function initDashboard() {
        cacheElements();
        bindEvents();
        renderQuotaLabel();
        fetchDashboardData();
    };

    function cacheElements() {
        elements.tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        elements.tabPanels = document.querySelectorAll('[data-tab-panel]');
        elements.statTotalFiles = document.querySelector('[data-stat="total-files"]');
        elements.statStorageUsed = document.querySelector('[data-stat="storage-used"]');
        elements.statRecentCount = document.querySelector('[data-stat="recent-count"]');
        elements.statTopType = document.querySelector('[data-stat="top-type"]');
        elements.storageQuota = document.querySelector('[data-storage="quota"]');
        elements.storageProgress = document.querySelector('[data-storage="progress"]');
        elements.storageUsed = document.querySelector('[data-storage="used"]');
        elements.storagePercent = document.querySelector('[data-storage="percent"]');
        elements.storageDetails = document.querySelector('[data-storage="details"]');
        elements.recentList = document.querySelector('[data-list="recent-files"]');
        elements.recentEmpty = document.querySelector('[data-empty="recent"]');
        elements.topFilesBody = document.querySelector('[data-list="top-files"]');
        elements.topFilesEmpty = document.querySelector('[data-empty="top-files"]');
        elements.typeSummary = document.querySelector('[data-list="type-summary"]');
        elements.typeSummaryEmpty = document.querySelector('[data-empty="type-summary"]');
        elements.typeCountLabel = document.querySelector('[data-stat="type-count"]');
        elements.sizeAverage = document.querySelector('[data-size="average"]');
        elements.sizeMax = document.querySelector('[data-size="max"]');
        elements.sizeMin = document.querySelector('[data-size="min"]');
        elements.lastUpdatedLabel = document.querySelector('[data-stat="last-updated"]');
        elements.quickActions = document.querySelectorAll('.quick-action');
        elements.viewAllLink = document.querySelector('[data-action="view-all"]');
        elements.btnUploadNew = document.querySelector('.btn-upload-new');
    }

    function bindEvents() {
        elements.tabButtons?.forEach((button) => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                if (!targetTab) return;
                elements.tabButtons.forEach((btn) => btn.classList.remove('active'));
                button.classList.add('active');
                elements.tabPanels.forEach((panel) => {
                    panel.classList.toggle('active', panel.dataset.tabPanel === targetTab);
                });
            });
        });

        elements.btnUploadNew?.addEventListener('click', () => {
            if (typeof window.switchToPage === 'function') {
                window.switchToPage('upload');
            }
        });

        elements.viewAllLink?.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof window.switchToPage === 'function') {
                window.switchToPage('myfiles');
            }
        });

        elements.quickActions?.forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                switch (action) {
                    case 'upload':
                        if (typeof window.switchToPage === 'function') {
                            window.switchToPage('upload');
                        }
                        break;
                    case 'myfiles':
                        if (typeof window.switchToPage === 'function') {
                            window.switchToPage('myfiles');
                        }
                        break;
                    case 'refresh':
                        fetchDashboardData({ showToast: true });
                        break;
                }
            });
        });
    }

    function renderQuotaLabel() {
        if (!elements.storageQuota) return;
        elements.storageQuota.textContent = `Dung lượng tối đa ${formatBytes(state.quotaBytes)}`;
    }

    async function fetchDashboardData(options = {}) {
        const { showToast = false } = options;
        try {
            if (showToast && window.toastSystem) {
                window.toastSystem.info('Đang làm mới dữ liệu dashboard...', { duration: 2000 });
            }

            const response = await fetch('/api/files');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const files = await response.json();
            state.files = Array.isArray(files) ? files : [];
            state.lastUpdated = new Date();

            renderDashboard();

            if (showToast && window.toastSystem) {
                window.toastSystem.success('Đã cập nhật dữ liệu dashboard.', { duration: 2200 });
            }
        } catch (error) {
            console.error('Không thể tải dữ liệu dashboard:', error);
            if (window.toastSystem) {
                window.toastSystem.error('Lỗi tải dữ liệu dashboard.', { duration: 3200 });
            }
            state.files = [];
            renderDashboard({ hasError: true });
        }
    }

    function renderDashboard(options = {}) {
        const files = Array.isArray(state.files) ? state.files : [];
        renderStats(files);
        renderStorage(files);
        renderRecentFiles(files, options);
        renderTopFiles(files, options);
        renderAnalytics(files, options);
    }

    function renderStats(files) {
        const totalFiles = files.length;
        const totalBytes = files.reduce((sum, file) => sum + toNumericSize(file.size), 0);
        const now = Date.now();
        const recentCount = files.filter((file) => now - extractTimestamp(file) <= 7 * 24 * 60 * 60 * 1000).length;

        const typeMap = buildTypeMap(files);
        const topType = typeMap[0];
        const topTypeLabel = topType ? `${topType.label} (${topType.percent}%)` : '-';

        if (elements.statTotalFiles) elements.statTotalFiles.textContent = totalFiles.toString();
        if (elements.statStorageUsed) elements.statStorageUsed.textContent = formatBytes(totalBytes);
        if (elements.statRecentCount) elements.statRecentCount.textContent = recentCount.toString();
        if (elements.statTopType) elements.statTopType.textContent = topTypeLabel;
    }

    function renderStorage(files) {
        const totalBytes = files.reduce((sum, file) => sum + toNumericSize(file.size), 0);
        const percent = state.quotaBytes ? Math.min(100, (totalBytes / state.quotaBytes) * 100) : 0;

        if (elements.storageUsed) {
            elements.storageUsed.textContent = `Đang dùng ${formatBytes(totalBytes)}`;
        }

        if (elements.storagePercent) {
            elements.storagePercent.textContent = `${percent.toFixed(1)}%`;
        }

        if (elements.storageProgress) {
            elements.storageProgress.style.width = `${percent}%`;
            elements.storageProgress.classList.remove('is-warning', 'is-danger');
            if (percent >= 95) {
                elements.storageProgress.classList.add('is-danger');
            } else if (percent >= 80) {
                elements.storageProgress.classList.add('is-warning');
            }
        }

        if (elements.storageDetails) {
            if (!files.length) {
                elements.storageDetails.innerHTML = '<li>Chưa có dữ liệu để hiển thị</li>';
                return;
            }

            const metrics = buildCategoryMetrics(files);
            elements.storageDetails.innerHTML = `
                <li><strong>${metrics.images}</strong> tệp hình ảnh</li>
                <li><strong>${metrics.documents}</strong> tệp tài liệu</li>
                <li><strong>${metrics.videos}</strong> tệp video</li>
                <li><strong>${metrics.others}</strong> tệp khác</li>
            `;
        }
    }

    function renderRecentFiles(files, options = {}) {
        if (!elements.recentList || !elements.recentEmpty) return;

        if (options.hasError) {
            elements.recentList.innerHTML = '';
            elements.recentEmpty.style.display = 'block';
            elements.recentEmpty.querySelector('p').textContent = 'Không thể tải danh sách tệp gần đây.';
            return;
        }

        const recentFiles = [...files]
            .sort((a, b) => extractTimestamp(b) - extractTimestamp(a))
            .slice(0, 6);

        if (!recentFiles.length) {
            elements.recentList.innerHTML = '';
            elements.recentEmpty.style.display = 'block';
            elements.recentEmpty.querySelector('p').textContent = 'Chưa có tệp nào được tải lên';
            return;
        }

        elements.recentEmpty.style.display = 'none';
        elements.recentList.innerHTML = recentFiles.map((file) => {
            const size = formatBytes(toNumericSize(file.size));
            const uploadedTimestamp = extractTimestamp(file);
            const uploadedAt = uploadedTimestamp ? formatRelativeTime(uploadedTimestamp) : '-';
            const uploadedExact = uploadedTimestamp ? formatDateTime(uploadedTimestamp) : 'Không xác định';
            const icon = getFileIconClass(file);
            const name = file.displayName || file.originalName || file.name || 'Không rõ tên';
            return `
                <li class="recent-file-item">
                    <div class="recent-file-main">
                        <div class="recent-file-icon"><i class="fas ${icon}"></i></div>
                        <div class="recent-file-info">
                            <span class="recent-file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                            <div class="recent-file-meta">
                                <span>${escapeHtml(size)}</span>
                                <span>${escapeHtml(uploadedAt)}</span>
                            </div>
                        </div>
                    </div>
                    <span class="recent-file-date">${escapeHtml(uploadedExact)}</span>
                </li>
            `;
        }).join('');
    }

    function renderTopFiles(files, options = {}) {
        if (!elements.topFilesBody || !elements.topFilesEmpty) return;

        if (options.hasError) {
            elements.topFilesBody.innerHTML = '';
            elements.topFilesEmpty.style.display = 'block';
            elements.topFilesEmpty.querySelector('p').textContent = 'Không thể tải dữ liệu.';
            return;
        }

        const topFiles = [...files]
            .sort((a, b) => toNumericSize(b.size) - toNumericSize(a.size))
            .slice(0, 8);

        if (!topFiles.length) {
            elements.topFilesBody.innerHTML = '';
            elements.topFilesEmpty.style.display = 'block';
            elements.topFilesEmpty.querySelector('p').textContent = 'Hiện chưa có dữ liệu để hiển thị';
            return;
        }

        elements.topFilesEmpty.style.display = 'none';
        elements.topFilesBody.innerHTML = topFiles.map((file) => {
            const name = file.displayName || file.originalName || file.name || 'Không rõ tên';
            const size = formatBytes(toNumericSize(file.size));
            const timestamp = extractTimestamp(file);
            const uploadedAt = timestamp ? formatDateTime(timestamp) : 'Không xác định';
            return `
                <tr>
                    <td title="${escapeHtml(name)}">${escapeHtml(name)}</td>
                    <td>${escapeHtml(size)}</td>
                    <td>${escapeHtml(uploadedAt)}</td>
                </tr>
            `;
        }).join('');
    }

    function renderAnalytics(files, options = {}) {
        if (!elements.typeSummary || !elements.typeSummaryEmpty || !elements.sizeAverage || !elements.sizeMax || !elements.sizeMin) {
            return;
        }

        if (options.hasError) {
            elements.typeSummary.innerHTML = '';
            elements.typeSummaryEmpty.style.display = 'block';
            elements.typeSummaryEmpty.querySelector('p').textContent = 'Không thể tải dữ liệu phân tích.';
            elements.sizeAverage.textContent = '0 MB';
            elements.sizeMax.textContent = '0 MB';
            elements.sizeMin.textContent = '0 MB';
            if (elements.typeCountLabel) elements.typeCountLabel.textContent = '0 loại';
            if (elements.lastUpdatedLabel) elements.lastUpdatedLabel.textContent = 'Chưa cập nhật';
            return;
        }

        const typeMap = buildTypeMap(files);
        if (typeMap.length) {
            elements.typeSummaryEmpty.style.display = 'none';
            elements.typeSummary.innerHTML = typeMap.map((entry, index) => {
                const color = TYPE_COLORS[index % TYPE_COLORS.length];
                return `
                    <div class="type-row">
                        <div class="type-row-header">
                            <span>${escapeHtml(entry.label)}</span>
                            <span>${entry.count} tệp (${entry.percent}%)</span>
                        </div>
                        <div class="type-progress">
                            <div class="type-progress-fill" style="width: ${entry.percent}%; --fill-color: ${color};"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            elements.typeSummary.innerHTML = '';
            elements.typeSummaryEmpty.style.display = 'block';
        }

        if (elements.typeCountLabel) {
            elements.typeCountLabel.textContent = `${typeMap.length} loại`;
        }

        const sizes = files.map((file) => toNumericSize(file.size)).filter((size) => size > 0);
        if (sizes.length) {
            const total = sizes.reduce((sum, value) => sum + value, 0);
            const average = total / sizes.length;
            const max = Math.max(...sizes);
            const min = Math.min(...sizes);
            elements.sizeAverage.textContent = formatBytes(average);
            elements.sizeMax.textContent = formatBytes(max);
            elements.sizeMin.textContent = formatBytes(min);
        } else {
            elements.sizeAverage.textContent = '0 MB';
            elements.sizeMax.textContent = '0 MB';
            elements.sizeMin.textContent = '0 MB';
        }

        if (elements.lastUpdatedLabel) {
            elements.lastUpdatedLabel.textContent = state.lastUpdated
                ? `Cập nhật ${formatDateTime(state.lastUpdated)}`
                : 'Chưa cập nhật';
        }
    }

    function buildTypeMap(files) {
        if (!files.length) return [];

        const counts = new Map();
        files.forEach((file) => {
            const raw = file.type || file.extension || 'Khác';
            const label = (raw || 'Khác').toString().split('/').pop().toUpperCase();
            counts.set(label, (counts.get(label) || 0) + 1);
        });

        const total = files.length;
        return Array.from(counts.entries())
            .map(([label, count]) => ({
                label,
                count,
                percent: Math.round((count / total) * 1000) / 10
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }

    function buildCategoryMetrics(files) {
        const metrics = {
            images: files.filter((file) => file.isImage).length,
            documents: files.filter((file) => file.isDocument).length,
            videos: files.filter((file) => file.isVideo).length
        };
        metrics.others = Math.max(0, files.length - metrics.images - metrics.documents - metrics.videos);
        return metrics;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.cleanupDashboard = function cleanupDashboard() {
        Object.keys(elements).forEach((key) => {
            elements[key] = null;
        });
        state.files = [];
        state.lastUpdated = null;
    };

    // Auto-initialize if page is already loaded
    document.addEventListener('DOMContentLoaded', () => {
        const dashboardPage = document.getElementById('dashboard-page');
        if (dashboardPage && dashboardPage.classList.contains('active')) {
            window.initDashboard();
        }
    });
})();