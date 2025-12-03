// Dashboard Page JavaScript
(function() {
    const BYTES_IN_GIB = 1024 * 1024 * 1024;
    const PLAN_STORAGE_LIMITS = {
        basic: {
            id: 'basic',
            title: 'Basic',
            storageBytes: 5 * BYTES_IN_GIB,
            storageLabel: '5 GB'
        },
        premium: {
            id: 'premium',
            title: 'Premium',
            storageBytes: 15 * BYTES_IN_GIB,
            storageLabel: '15 GB'
        }
    };
    const TYPE_COLORS = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9'];

    const t = (key, fallback = '') => {
        const lang = window.LanguageManager;
        if (lang && typeof lang.translate === 'function') {
            return lang.translate(key) || fallback;
        }
        return fallback;
    };

    const KNOWN_MIME_LABELS = {
        'application/pdf': () => t('pages.fileTypes.pdf', 'Tệp PDF'),
        'application/msword': () => t('pages.fileTypes.word', 'Tài liệu Word'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': () => t('pages.fileTypes.word', 'Tài liệu Word'),
        'application/vnd.ms-excel': () => t('pages.fileTypes.excel', 'Bảng tính Excel'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': () => t('pages.fileTypes.excel', 'Bảng tính Excel'),
        'application/vnd.ms-powerpoint': () => t('pages.fileTypes.powerpoint', 'Trình chiếu PowerPoint'),
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': () => t('pages.fileTypes.powerpoint', 'Trình chiếu PowerPoint'),
        'text/plain': () => t('pages.fileTypes.text', 'Tệp văn bản'),
        'application/json': () => t('pages.fileTypes.json', 'Tệp JSON'),
        'image/jpeg': () => t('pages.fileTypes.imageJpeg', 'Ảnh JPEG'),
        'image/png': () => t('pages.fileTypes.imagePng', 'Ảnh PNG'),
        'image/gif': () => t('pages.fileTypes.imageGif', 'Ảnh GIF'),
        'video/mp4': () => t('pages.fileTypes.videoMp4', 'Video MP4'),
        'audio/mpeg': () => t('pages.fileTypes.audioMp3', 'Âm thanh MP3')
    };
    const KNOWN_EXTENSION_LABELS = {
        pdf: () => t('pages.fileTypes.pdf', 'Tệp PDF'),
        doc: () => t('pages.fileTypes.word', 'Tài liệu Word'),
        docx: () => t('pages.fileTypes.word', 'Tài liệu Word'),
        xls: () => t('pages.fileTypes.excel', 'Bảng tính Excel'),
        xlsx: () => t('pages.fileTypes.excel', 'Bảng tính Excel'),
        ppt: () => t('pages.fileTypes.powerpoint', 'Trình chiếu PowerPoint'),
        pptx: () => t('pages.fileTypes.powerpoint', 'Trình chiếu PowerPoint'),
        txt: () => t('pages.fileTypes.text', 'Tệp văn bản'),
        csv: () => t('pages.fileTypes.csv', 'Tệp CSV'),
        json: () => t('pages.fileTypes.json', 'Tệp JSON'),
        jpg: () => t('pages.fileTypes.imageJpeg', 'Ảnh JPEG'),
        jpeg: () => t('pages.fileTypes.imageJpeg', 'Ảnh JPEG'),
        png: () => t('pages.fileTypes.imagePng', 'Ảnh PNG'),
        gif: () => t('pages.fileTypes.imageGif', 'Ảnh GIF'),
        svg: () => t('pages.fileTypes.imageSvg', 'Ảnh SVG'),
        mp4: () => t('pages.fileTypes.videoMp4', 'Video MP4'),
        mov: () => t('pages.fileTypes.videoMov', 'Video MOV'),
        avi: () => t('pages.fileTypes.videoAvi', 'Video AVI'),
        mkv: () => t('pages.fileTypes.videoMkv', 'Video MKV'),
        mp3: () => t('pages.fileTypes.audioMp3', 'Âm thanh MP3'),
        wav: () => t('pages.fileTypes.audioWav', 'Âm thanh WAV'),
        flac: () => t('pages.fileTypes.audioFlac', 'Âm thanh FLAC'),
        zip: () => t('pages.fileTypes.zipArchive', 'Tệp nén ZIP'),
        rar: () => t('pages.fileTypes.rarArchive', 'Tệp nén RAR'),
        '7z': () => t('pages.fileTypes.archive7z', 'Tệp nén 7z')
    };

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
            return t('common.inFuture', 'Trong tương lai');
        }
        if (diffMinutes < 1) return t('common.justNow', 'Vừa xong');
        if (diffMinutes < 60) return `${diffMinutes} ${t('common.minutesAgo', 'phút trước').replace('{{count}} ', '')}`;
        if (diffHours < 24) return `${diffHours} ${t('common.hoursAgo', 'giờ trước').replace('{{count}} ', '')}`;
        if (diffDays === 1) return t('common.yesterday', 'Hôm qua');
        if (diffDays < 7) return `${diffDays} ${t('common.daysAgo', 'ngày trước').replace('{{count}} ', '')}`;
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

    const resolveFileIcon = (file) => {
        if (window.FileIcons && typeof window.FileIcons.resolve === 'function') {
            return window.FileIcons.resolve({
                extension: file?.extension || file?.ext || null,
                name: file?.displayName || file?.originalName || file?.name || null,
                mime: file?.type || file?.mimeType || null,
                isImage: Boolean(file?.isImage),
                isVideo: Boolean(file?.isVideo),
                isAudio: Boolean(file?.isAudio),
                isDocument: Boolean(file?.isDocument)
            });
        }

        return {
            icon: 'fa-file-lines',
            variant: 'generic',
            tone: 'file-icon-tone--generic',
            label: t('common.beamshareFile', 'Tệp BeamShare')
        };
    };

    function normalizePlanId(planId) {
        return (planId || 'basic').toString().trim().toLowerCase();
    }

    function resolvePlanInfo(planId) {
        const normalized = normalizePlanId(planId);
        return PLAN_STORAGE_LIMITS[normalized] || PLAN_STORAGE_LIMITS.basic;
    }

    const state = {
        files: [],
        planId: 'basic',
        quotaBytes: PLAN_STORAGE_LIMITS.basic.storageBytes,
        lastUpdated: null
    };

    function getCurrentPlanInfo() {
        return resolvePlanInfo(state.planId);
    }

    const elements = {};
    let hasProfileListener = false;
    const onUserProfileUpdated = (event) => {
        applyDashboardUserProfile(event?.detail?.profile || window.currentUserProfile || null);
    };

    window.initDashboard = function initDashboard() {
        cacheElements();
        bindEvents();
        renderQuotaLabel();
        attachProfileListener();
        refreshDashboardUserProfile();
        fetchDashboardData();
    };

    function attachProfileListener() {
        if (hasProfileListener) {
            return;
        }
        document.addEventListener('userprofile:updated', onUserProfileUpdated);
        hasProfileListener = true;
    }

    function detachProfileListener() {
        if (!hasProfileListener) {
            return;
        }
        document.removeEventListener('userprofile:updated', onUserProfileUpdated);
        hasProfileListener = false;
    }

    function refreshDashboardUserProfile() {
        const existingProfile = window.currentUserProfile || null;
        if (existingProfile) {
            applyDashboardUserProfile(existingProfile);
            return;
        }

        if (typeof window.getCurrentUserProfile === 'function') {
            window.getCurrentUserProfile()
                .then((profile) => {
                    applyDashboardUserProfile(profile || null);
                })
                .catch(() => {
                    applyDashboardUserProfile(null);
                });
        } else {
            applyDashboardUserProfile(null);
        }
    }

    function applyDashboardUserProfile(profile) {
        if (!elements.dashboardAvatar || !elements.dashboardInitial) {
            return;
        }

        const compute = typeof window.getUserDisplayInfo === 'function'
            ? window.getUserDisplayInfo
            : (user) => {
                const fallbackName = user && (user.fullName || user.email) ? (user.fullName || user.email) : 'User';
                const trimmed = fallbackName.trim();
                return {
                    displayName: trimmed || 'User',
                    initial: (trimmed.charAt(0) || 'U').toUpperCase(),
                    color: '#8b5cf6'
                };
            };

    const info = compute(profile || null);
    const displayName = info.displayName || 'User';
    const initials = info.initials || info.initial || 'U';

    elements.dashboardInitial.textContent = initials;
    elements.dashboardAvatar.style.background = info.color || '#8b5cf6';
        elements.dashboardAvatar.setAttribute('title', displayName);

        if (elements.dashboardName) {
            elements.dashboardName.textContent = t('pages.dashboard.greeting', 'Xin chào, {{name}}').replace('{{name}}', displayName);
        }

        const planInfo = resolvePlanInfo(profile?.plan);
        if (state.planId !== planInfo.id || state.quotaBytes !== planInfo.storageBytes) {
            state.planId = planInfo.id;
            state.quotaBytes = planInfo.storageBytes;
            renderQuotaLabel();
            renderStats(state.files);
            renderStorage(state.files);
        }
    }

    function determineTypeLabel(file) {
        if (!file) {
            return t('common.other', 'Khác');
        }

        const extensionSource = (file.extension || file.originalName || file.displayName || file.name || '').toString();
        const normalizedExtension = extensionSource.includes('.')
            ? extensionSource.split('.').pop().toLowerCase()
            : extensionSource.toLowerCase();

        if (normalizedExtension && KNOWN_EXTENSION_LABELS[normalizedExtension]) {
            return KNOWN_EXTENSION_LABELS[normalizedExtension]();
        }

        const mime = (file.type || '').toLowerCase();
        if (mime && KNOWN_MIME_LABELS[mime]) {
            return KNOWN_MIME_LABELS[mime]();
        }

        if (mime.startsWith('image/')) return t('pages.fileTypes.image', 'Hình ảnh');
        if (mime.startsWith('video/')) return t('pages.fileTypes.video', 'Video');
        if (mime.startsWith('audio/')) return t('pages.fileTypes.audio', 'Âm thanh');
        if (mime.includes('presentation')) return t('pages.fileTypes.presentation', 'Trình chiếu');
        if (mime.includes('spreadsheet') || mime.includes('excel')) return t('pages.fileTypes.spreadsheet', 'Bảng tính');
        if (mime.includes('word') || mime.includes('document')) return t('pages.fileTypes.document', 'Tài liệu');
        if (mime.includes('pdf')) return t('pages.fileTypes.pdf', 'Tệp PDF');
        if (mime.includes('zip') || mime.includes('compressed')) return t('pages.fileTypes.compressed', 'Tệp nén');
        if (mime.includes('text')) return t('pages.fileTypes.text', 'Tệp văn bản');
        if (mime.includes('json')) return t('pages.fileTypes.json', 'Tệp JSON');

        return t('common.other', 'Khác');
    }

    function cacheElements() {
        elements.tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        elements.tabPanels = document.querySelectorAll('[data-tab-panel]');
        elements.statTotalFiles = document.querySelector('[data-stat="total-files"]');
        elements.statStorageUsed = document.querySelector('[data-stat="storage-used"]');
        elements.statRecentCount = document.querySelector('[data-stat="recent-count"]');
        elements.statTopType = document.querySelector('[data-stat="top-type"]');
        elements.dashboardAvatar = document.getElementById('dashboard-user-avatar');
        elements.dashboardInitial = document.getElementById('dashboard-user-initial');
        elements.dashboardName = document.getElementById('dashboard-user-name');
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
        const planInfo = getCurrentPlanInfo();
        const limitLabel = planInfo.storageLabel || formatBytes(planInfo.storageBytes || state.quotaBytes);
        elements.storageQuota.textContent = t('pages.dashboard.quotaLabel', 'Dung lượng gói {{plan}}: {{limit}}')
            .replace('{{plan}}', planInfo.title)
            .replace('{{limit}}', limitLabel);
    }

    async function fetchDashboardData(options = {}) {
        const { showToast = false } = options;
        try {
            if (showToast && window.toastSystem) {
                window.toastSystem.info(t('pages.dashboard.refreshing', 'Đang làm mới dữ liệu dashboard...'), { duration: 2000 });
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
                window.toastSystem.success(t('pages.dashboard.refreshed', 'Đã cập nhật dữ liệu dashboard.'), { duration: 2200 });
            }
        } catch (error) {
            console.error(t('pages.dashboard.refreshError', 'Không thể tải dữ liệu dashboard:'), error);
            if (window.toastSystem) {
                window.toastSystem.error(t('pages.dashboard.refreshErrorToast', 'Lỗi tải dữ liệu dashboard.'), { duration: 3200 });
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
        if (elements.statStorageUsed) {
            const planInfo = getCurrentPlanInfo();
            const limitLabel = planInfo.storageLabel || formatBytes(planInfo.storageBytes || state.quotaBytes);
            elements.statStorageUsed.textContent = `${formatBytes(totalBytes)} / ${limitLabel}`;
        }
        if (elements.statRecentCount) elements.statRecentCount.textContent = recentCount.toString();
        if (elements.statTopType) elements.statTopType.textContent = topTypeLabel;
    }

    function renderStorage(files) {
        const totalBytes = files.reduce((sum, file) => sum + toNumericSize(file.size), 0);
        const planInfo = getCurrentPlanInfo();
        const quotaBytes = planInfo.storageBytes || state.quotaBytes || 0;
        const percent = quotaBytes ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0;

        if (elements.storageUsed) {
            const limitLabel = planInfo.storageLabel || formatBytes(quotaBytes);
            elements.storageUsed.textContent = t('pages.dashboard.usedLabel', 'Đang dùng {{used}} / {{limit}}')
                .replace('{{used}}', formatBytes(totalBytes))
                .replace('{{limit}}', limitLabel);
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
                elements.storageDetails.innerHTML = `<li>${t('pages.dashboard.noData', 'Chưa có dữ liệu để hiển thị')}</li>`;
                return;
            }

            const metrics = buildCategoryMetrics(files);
            elements.storageDetails.innerHTML = `
                <li><strong>${metrics.images}</strong> ${t('pages.dashboard.imageFiles', 'tệp hình ảnh')}</li>
                <li><strong>${metrics.documents}</strong> ${t('pages.dashboard.documentFiles', 'tệp tài liệu')}</li>
                <li><strong>${metrics.videos}</strong> ${t('pages.dashboard.videoFiles', 'tệp video')}</li>
                <li><strong>${metrics.others}</strong> ${t('pages.dashboard.otherFiles', 'tệp khác')}</li>
            `;
        }
    }

    function renderRecentFiles(files, options = {}) {
        if (!elements.recentList || !elements.recentEmpty) return;

        if (options.hasError) {
            elements.recentList.innerHTML = '';
            elements.recentEmpty.style.display = 'block';
            elements.recentEmpty.querySelector('p').textContent = t('pages.dashboard.recentError', 'Không thể tải danh sách tệp gần đây.');
            return;
        }

        const recentFiles = [...files]
            .sort((a, b) => extractTimestamp(b) - extractTimestamp(a))
            .slice(0, 6);

        if (!recentFiles.length) {
            elements.recentList.innerHTML = '';
            elements.recentEmpty.style.display = 'block';
            elements.recentEmpty.querySelector('p').textContent = t('pages.dashboard.noFiles', 'Chưa có tệp nào được tải lên');
            return;
        }

        elements.recentEmpty.style.display = 'none';
        elements.recentList.innerHTML = recentFiles.map((file) => {
            const size = formatBytes(toNumericSize(file.size));
            const uploadedTimestamp = extractTimestamp(file);
            const uploadedAt = uploadedTimestamp ? formatRelativeTime(uploadedTimestamp) : '-';
            const uploadedExact = uploadedTimestamp ? formatDateTime(uploadedTimestamp) : t('common.unknown', 'Không xác định');
            const iconDescriptor = resolveFileIcon(file);
            const iconVariantAttr = iconDescriptor.variant ? ` data-icon-variant="${iconDescriptor.variant}"` : '';
            const name = file.displayName || file.originalName || file.name || t('common.unknownName', 'Không rõ tên');
            return `
                <li class="recent-file-item">
                    <div class="recent-file-main">
                        <div class="recent-file-icon"${iconVariantAttr}><i class="fas ${iconDescriptor.icon} ${iconDescriptor.tone}"></i></div>
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
            elements.topFilesEmpty.querySelector('p').textContent = t('pages.dashboard.loadError', 'Không thể tải dữ liệu.');
            return;
        }

        const topFiles = [...files]
            .sort((a, b) => toNumericSize(b.size) - toNumericSize(a.size))
            .slice(0, 8);

        if (!topFiles.length) {
            elements.topFilesBody.innerHTML = '';
            elements.topFilesEmpty.style.display = 'block';
            elements.topFilesEmpty.querySelector('p').textContent = t('pages.dashboard.noData', 'Chưa có dữ liệu để hiển thị');
            return;
        }

        elements.topFilesEmpty.style.display = 'none';
        elements.topFilesBody.innerHTML = topFiles.map((file) => {
            const name = file.displayName || file.originalName || file.name || t('common.unknownName', 'Không rõ tên');
            const size = formatBytes(toNumericSize(file.size));
            const timestamp = extractTimestamp(file);
            const uploadedAt = timestamp ? formatDateTime(timestamp) : t('common.unknown', 'Không xác định');
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
            elements.typeSummaryEmpty.querySelector('p').textContent = t('pages.dashboard.analyticsError', 'Không thể tải dữ liệu phân tích.');
            elements.sizeAverage.textContent = '0 MB';
            elements.sizeMax.textContent = '0 MB';
            elements.sizeMin.textContent = '0 MB';
            if (elements.typeCountLabel) elements.typeCountLabel.textContent = t('pages.dashboard.typeCount', '{{count}} loại').replace('{{count}}', '0');
            if (elements.lastUpdatedLabel) elements.lastUpdatedLabel.textContent = t('pages.dashboard.notUpdated', 'Chưa cập nhật');
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
                            <span>${entry.count} ${t('pages.dashboard.filesCount', 'tệp')} (${entry.percent}%)</span>
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
            elements.typeCountLabel.textContent = t('pages.dashboard.typeCount', '{{count}} loại').replace('{{count}}', typeMap.length);
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
                ? t('pages.dashboard.updatedAt', 'Cập nhật {{time}}').replace('{{time}}', formatDateTime(state.lastUpdated))
                : t('pages.dashboard.notUpdated', 'Chưa cập nhật');
        }
    }

    function buildTypeMap(files) {
        if (!files.length) return [];

        const counts = new Map();
        files.forEach((file) => {
            const label = determineTypeLabel(file);
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
        detachProfileListener();
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
