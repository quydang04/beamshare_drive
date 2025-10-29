// My Files Page JavaScript - Compact
const DEFAULT_SORT_OPTION = 'date-desc';
const DEFAULT_VIEW_MODE = 'list';
const VIEW_MODE_STORAGE_KEY = 'myfiles:view-mode';
const SHARE_STATE_STORAGE_KEY = 'myfiles:share-overrides';
const DETAIL_SNAPSHOT_STORAGE_KEY = 'myfiles:detail-snapshots';
const PREVIEW_MODAL_ID = 'file-preview-modal';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.avi', '.mov', '.webm', '.mkv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a']);
let allFiles = [];
let filteredFiles = [];
let activeSortOption = DEFAULT_SORT_OPTION;
let searchDebounceTimer = null;
let activeViewMode = DEFAULT_VIEW_MODE;
let myFilesAutoRefreshIntervalId = null;
let shareOverrides = {};
let detailSnapshots = {};

function normalizeFileId(fileOrId) {
    if (!fileOrId) {
        return null;
    }

    if (typeof fileOrId === 'string') {
        return fileOrId;
    }

    return (
        fileOrId.id ||
        fileOrId.internalFilename ||
        fileOrId.internalName ||
        fileOrId.internal ||
        fileOrId.name ||
        fileOrId.originalName ||
        null
    );
}

function openShareTabForFile(fileId, displayName, options = {}) {
    if (!fileId) {
        if (window.toastSystem) {
            window.toastSystem.error('Không thể xác định tệp để chia sẻ.', {
                duration: 4000
            });
        }
        return;
    }

    const { shareToken = null, visibility = null } = options;
    const effectiveState = visibility || getShareStateForFile({ id: fileId }) || 'private';
    const effectiveToken = shareToken || getShareTokenForFile(fileId, null);
    const shareUrl = getShareUrlForFile(fileId, effectiveState === 'public' ? buildShareUrl(fileId, effectiveToken) : null);

    if (effectiveState !== 'public' || !shareUrl) {
        if (window.toastSystem) {
            window.toastSystem.warning('Tệp đang ở chế độ riêng tư hoặc chưa có liên kết chia sẻ.', {
                duration: 4000
            });
        }
        return;
    }

    const shareWindow = window.open(shareUrl, '_blank', 'noopener');

    if (!shareWindow) {
        if (window.toastSystem) {
            window.toastSystem.error('Trình duyệt đã chặn cửa sổ chia sẻ. Vui lòng cho phép cửa sổ bật lên.', {
                duration: 5000
            });
        }
        return;
    }

    if (window.toastSystem && displayName) {
        window.toastSystem.info(`Đang mở trang chia sẻ cho: ${displayName}`, {
            duration: 3500
        });
    }
}

function openBeamShareWorkspace(fileId, displayName) {
    if (!fileId) {
        window.toastSystem?.error('Không thể xác định tệp để gửi qua BeamShare.', {
            duration: 4000
        });
        return;
    }

    const beamshareUrl = `/beamshare/?driveFile=${encodeURIComponent(fileId)}`;
    const beamshareWindow = window.open(beamshareUrl, '_blank', 'noopener');

    if (!beamshareWindow) {
        window.toastSystem?.error('Trình duyệt đã chặn cửa sổ BeamShare. Vui lòng cho phép cửa sổ bật lên.', {
            duration: 5000
        });
        return;
    }

    const targetName = displayName || 'tệp đã chọn';
    window.toastSystem?.info(`Đang mở BeamShare Live để gửi ${targetName}. Hãy chọn thiết bị nhận trong danh sách.`, {
        duration: 5000
    });
}

function loadShareOverrides() {
    try {
        const stored = localStorage.getItem(SHARE_STATE_STORAGE_KEY);
        shareOverrides = stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn('Không thể tải trạng thái chia sẻ, sẽ sử dụng mặc định.', error);
        shareOverrides = {};
    }
}

function saveShareOverrides() {
    try {
        localStorage.setItem(SHARE_STATE_STORAGE_KEY, JSON.stringify(shareOverrides));
    } catch (error) {
        console.warn('Không thể lưu trạng thái chia sẻ.', error);
    }
}

function loadDetailSnapshots() {
    try {
        const stored = localStorage.getItem(DETAIL_SNAPSHOT_STORAGE_KEY);
        detailSnapshots = stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn('Không thể tải lịch sử chi tiết tệp.', error);
        detailSnapshots = {};
    }
}

function saveDetailSnapshots() {
    try {
        localStorage.setItem(DETAIL_SNAPSHOT_STORAGE_KEY, JSON.stringify(detailSnapshots));
    } catch (error) {
        console.warn('Không thể lưu lịch sử chi tiết tệp.', error);
    }
}

function getShareStateForFile(file) {
    if (!file) {
        return 'private';
    }

    const fileId = normalizeFileId(file);
    if (fileId && shareOverrides[fileId] && shareOverrides[fileId].state) {
        return shareOverrides[fileId].state;
    }

    if (typeof file.isPublic === 'boolean') {
        return file.isPublic ? 'public' : 'private';
    }

    const metadata = file.metadata || {};
    if (metadata.shareStatus && ['public', 'private'].includes(metadata.shareStatus)) {
        return metadata.shareStatus;
    }

    if (typeof metadata.isPublic === 'boolean') {
        return metadata.isPublic ? 'public' : 'private';
    }

    return 'private';
}

function applyShareOverrideToFile(file) {
    const nextFile = { ...file };
    const fileId = normalizeFileId(file);
    const override = fileId ? shareOverrides[fileId] : null;

    if (override && override.state) {
        nextFile.isPublic = override.state === 'public';
        nextFile.metadata = {
            ...(nextFile.metadata || {}),
            shareStatus: override.state,
            shareUpdatedAt: override.updatedAt
        };

        if (Object.prototype.hasOwnProperty.call(override, 'shareToken')) {
            nextFile.metadata.shareToken = override.shareToken;
            nextFile.shareToken = override.shareToken;
        }

        if (Object.prototype.hasOwnProperty.call(override, 'shareUrl')) {
            nextFile.metadata.shareUrl = override.shareUrl;
            nextFile.shareUrl = override.shareUrl;
        }
    }

    return nextFile;
}

function persistShareOverride(fileId, state, options = {}) {
    if (!fileId) {
        return;
    }

    const previous = shareOverrides[fileId] || {};
    const override = {
        state,
        updatedAt: new Date().toISOString(),
        shareToken: Object.prototype.hasOwnProperty.call(options, 'shareToken') ? options.shareToken : previous.shareToken,
        shareUrl: Object.prototype.hasOwnProperty.call(options, 'shareUrl') ? options.shareUrl : previous.shareUrl
    };

    if (override.state === 'public' && !override.shareUrl) {
        override.shareUrl = buildShareUrl(fileId, override.shareToken || null);
    }

    if (override.state !== 'public') {
        override.shareUrl = null;
        if (Object.prototype.hasOwnProperty.call(options, 'shareToken') && options.shareToken === null) {
            override.shareToken = null;
        }
    }

    shareOverrides[fileId] = override;
    saveShareOverrides();

    detailSnapshots[fileId] = {
        ...(detailSnapshots[fileId] || {}),
        shareState: state,
        shareUpdatedAt: override.updatedAt,
        shareToken: override.shareToken,
        shareUrl: override.shareUrl,
        fetchedAt: new Date().toISOString()
    };
    saveDetailSnapshots();

    const applyState = (file) => {
        if (normalizeFileId(file) === fileId) {
            return applyShareOverrideToFile({ ...file, isPublic: state === 'public' });
        }
        return file;
    };

    allFiles = allFiles.map(applyState);
    filteredFiles = filteredFiles.map(applyState);

    updateShareControlsUI(fileId, {
        shareState: override.state,
        shareUrl: override.shareUrl,
        shareToken: override.shareToken
    });
}

function findFileById(fileId) {
    if (!fileId) {
        return null;
    }

    return (
        allFiles.find(file => normalizeFileId(file) === fileId) ||
        filteredFiles.find(file => normalizeFileId(file) === fileId) ||
        null
    );
}

function getShareOverride(fileId) {
    if (!fileId) {
        return null;
    }
    return shareOverrides[fileId] || null;
}

function buildShareUrl(fileId, shareToken = null) {
    if (!fileId) {
        return null;
    }

    const sharePath = `/files/d/${encodeURIComponent(fileId)}`;

    try {
        const shareUrl = new URL(sharePath, window.location.origin);
        if (shareToken) {
            shareUrl.searchParams.set('token', shareToken);
        }
        return shareUrl.toString();
    } catch (error) {
        if (shareToken) {
            return `${sharePath}?token=${encodeURIComponent(shareToken)}`;
        }
        return sharePath;
    }
}

function getShareTokenForFile(fileId, fallbackToken = null) {
    if (!fileId) {
        return null;
    }

    const override = getShareOverride(fileId);
    if (override && Object.prototype.hasOwnProperty.call(override, 'shareToken') && override.shareToken) {
        return override.shareToken;
    }

    const snapshot = detailSnapshots[fileId];
    if (snapshot && snapshot.shareToken) {
        return snapshot.shareToken;
    }

    const file = findFileById(fileId);
    if (file) {
        const metadata = file.metadata || {};
        return file.shareToken || metadata.shareToken || fallbackToken;
    }

    return fallbackToken;
}

function getShareUrlForFile(fileId, fallbackUrl = null) {
    if (!fileId) {
        return null;
    }

    const override = getShareOverride(fileId);
    if (override && override.shareUrl) {
        return override.shareUrl;
    }

    const snapshot = detailSnapshots[fileId];
    if (snapshot && snapshot.shareUrl) {
        return snapshot.shareUrl;
    }

    const file = findFileById(fileId);
    if (file) {
        const metadata = file.metadata || {};
        const token = file.shareToken || metadata.shareToken;
        if (metadata.shareUrl) {
            return metadata.shareUrl;
        }
        if (token) {
            return buildShareUrl(fileId, token);
        }
    }

    const token = getShareTokenForFile(fileId, null);
    if (token) {
        return buildShareUrl(fileId, token);
    }

    return fallbackUrl;
}

function findShareElement(selector, fileId) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        if (element.getAttribute('data-file-id') === fileId) {
            return element;
        }
    }
    return null;
}

function getFileItemElement(fileId) {
    const items = document.querySelectorAll('.file-item');
    for (const item of items) {
        if (item.getAttribute('data-file-id') === fileId) {
            return item;
        }
    }
    return null;
}

function updateShareButtonState(button, state) {
    if (!button) {
        return;
    }

    const normalizedState = state === 'public' ? 'public' : 'private';
    const icon = button.querySelector('i');

    button.setAttribute('data-share-state', normalizedState);
    if (normalizedState === 'public') {
        button.classList.add('is-public');
        button.title = 'Đang công khai - quản lý chia sẻ';
        if (icon) {
            icon.className = 'fas fa-share-square';
        }
    } else {
        button.classList.remove('is-public');
        button.title = 'Chia sẻ tệp';
        if (icon) {
            icon.className = 'fas fa-share-alt';
        }
    }
}

function updateShareControlsUI(fileId, options = {}) {
    if (!fileId) {
        return;
    }

    const override = getShareOverride(fileId);
    const shareState = options.shareState || override?.state || 'private';
    const shareUrl = options.shareUrl !== undefined ? options.shareUrl : getShareUrlForFile(fileId, null);
    const shareToken = options.shareToken !== undefined ? options.shareToken : getShareTokenForFile(fileId, null);

    const isPublic = shareState === 'public';
    const hasLink = Boolean(shareUrl);

    const shareInput = findShareElement('.file-share-input', fileId);
    if (shareInput) {
        if (hasLink) {
            shareInput.value = shareUrl;
            shareInput.disabled = false;
            shareInput.placeholder = 'Liên kết chia sẻ';
            shareInput.title = shareUrl;
        } else {
            shareInput.value = '';
            shareInput.disabled = true;
            shareInput.placeholder = 'Tệp đang ở chế độ riêng tư';
            shareInput.removeAttribute('title');
        }
    }

    const copyBtn = findShareElement('.file-share-copy-btn', fileId);
    if (copyBtn) {
        copyBtn.disabled = !(isPublic && hasLink);
    }

    const openBtn = findShareElement('.file-share-open-btn', fileId);
    if (openBtn) {
        openBtn.disabled = !(isPublic && hasLink);
    }

    const regenerateBtn = findShareElement('.file-share-regenerate', fileId);
    if (regenerateBtn) {
        regenerateBtn.disabled = !isPublic;
    }

    const footerCopyBtn = findShareElement('.btn-copy-share', fileId);
    if (footerCopyBtn) {
        footerCopyBtn.disabled = !(isPublic && hasLink);
    }

    const helper = findShareElement('.file-share-helper', fileId);
    if (helper) {
        helper.textContent = isPublic
            ? 'Chia sẻ liên kết này với mọi người bạn muốn cấp quyền truy cập. Tạo liên kết mới để thu hồi liên kết cũ.'
            : 'Tệp đang ở chế độ riêng tư. Bật chế độ công khai để tạo liên kết chia sẻ.';
    }

    const stateChip = findShareElement('.share-state-chip', fileId);
    if (stateChip) {
        stateChip.classList.toggle('is-public', isPublic);
        stateChip.classList.toggle('is-private', !isPublic);
        stateChip.innerHTML = `<i class="fas ${isPublic ? 'fa-lock-open' : 'fa-lock'}"></i>${isPublic ? 'Đang công khai' : 'Đang riêng tư'}`;
    }

    // Store the latest link in overrides for downstream usage
    if (override) {
        let hasChanged = false;
        if (isPublic && hasLink && override.shareUrl !== shareUrl) {
            override.shareUrl = shareUrl;
            hasChanged = true;
        }
        if (shareToken && override.shareToken !== shareToken) {
            override.shareToken = shareToken;
            hasChanged = true;
        }
        if (!isPublic && override.shareUrl !== null) {
            override.shareUrl = null;
            hasChanged = true;
        }
        if (hasChanged) {
            saveShareOverrides();
        }
    }
}

async function changeFileVisibility(fileId, targetState, options = {}) {
    const { regenerateToken = false, showToast = true } = options;

    if (!fileId) {
        throw new Error('Thiếu thông tin tệp cần cập nhật.');
    }

    if (!['public', 'private'].includes(targetState)) {
        throw new Error('Tùy chọn chia sẻ không hợp lệ.');
    }

    try {
        const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/share`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                visibility: targetState,
                regenerateToken
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success !== true) {
            throw new Error(result.error || 'Không thể cập nhật quyền chia sẻ.');
        }

        const nextState = result.visibility || targetState;
        const shareToken = result.shareToken ?? getShareTokenForFile(fileId, null);
        const shareUrl = nextState === 'public'
            ? (result.shareUrl || buildShareUrl(fileId, shareToken || null))
            : null;

        persistShareOverride(fileId, nextState, {
            shareToken: shareToken ?? null,
            shareUrl
        });

        const fileItem = getFileItemElement(fileId);
        if (fileItem) {
            fileItem.setAttribute('data-share-state', nextState);
            if (nextState === 'public' && shareToken) {
                fileItem.setAttribute('data-share-token', shareToken);
            } else {
                fileItem.removeAttribute('data-share-token');
            }
        }

        const shareButton = findShareElement('.share-manage-btn', fileId);
        if (shareButton) {
            updateShareButtonState(shareButton, nextState);
        }

        updateFileInsights(allFiles);

        if (showToast) {
            const fileName = fileItem?.getAttribute('data-file-name') || 'tệp đã chọn';
            const stateLabel = nextState === 'public' ? 'công khai' : 'riêng tư';
            const extra = nextState === 'public' && shareUrl ? ' (đã tạo liên kết chia sẻ)' : '';
            window.toastSystem?.success(`Đã chuyển "${fileName}" sang chế độ ${stateLabel}${extra}`, {
                duration: 3000
            });
        }

        return {
            visibility: nextState,
            shareToken: shareToken ?? null,
            shareUrl
        };
    } catch (error) {
        throw error instanceof Error ? error : new Error('Không thể cập nhật quyền chia sẻ.');
    }
}

function mergeFileDetailsIntoState(fileId, details) {
    if (!fileId || !details) {
        return;
    }

    const updatedDetails = applyShareOverrideToFile({ ...details });
    let merged = false;

    allFiles = allFiles.map(file => {
        if (normalizeFileId(file) === fileId) {
            merged = true;
            return {
                ...file,
                ...updatedDetails,
                displayName: updatedDetails.displayName || updatedDetails.originalName || file.displayName
            };
        }
        return file;
    });

    if (!merged) {
        allFiles.push({ ...updatedDetails, id: fileId });
    }

    applyFiltersAndRender();
}

function getFriendlyFileType(mimeType, extension) {
    if (!mimeType || mimeType === 'Không xác định') {
        if (extension) {
            return extension.toUpperCase().replace(/^\./, '') + ' File';
        }
        return 'Tệp';
    }

    // Map MIME types to friendly names
    const mimeTypeMap = {
        // Documents
        'application/pdf': 'Tài liệu PDF',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Tài liệu Word',
        'application/msword': 'Tài liệu Word',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Bảng tính Excel',
        'application/vnd.ms-excel': 'Bảng tính Excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Bản trình chiếu PowerPoint',
        'application/vnd.ms-powerpoint': 'Bản trình chiếu PowerPoint',
        'application/vnd.oasis.opendocument.text': 'Tài liệu OpenDocument',
        'application/vnd.oasis.opendocument.spreadsheet': 'Bảng tính OpenDocument',
        'application/vnd.oasis.opendocument.presentation': 'Bản trình chiếu OpenDocument',
        'application/rtf': 'Tệp Rich Text',
        'text/plain': 'Tệp văn bản',
        'text/csv': 'Tệp CSV',
        
        // Images
        'image/jpeg': 'Hình ảnh JPEG',
        'image/jpg': 'Hình ảnh JPEG',
        'image/png': 'Hình ảnh PNG',
        'image/gif': 'Hình ảnh GIF',
        'image/webp': 'Hình ảnh WebP',
        'image/svg+xml': 'Hình ảnh SVG',
        'image/bmp': 'Hình ảnh BMP',
        'image/tiff': 'Hình ảnh TIFF',
        'image/x-icon': 'Biểu tượng',
        
        // Videos
        'video/mp4': 'Video MP4',
        'video/mpeg': 'Video MPEG',
        'video/quicktime': 'Video QuickTime',
        'video/x-msvideo': 'Video AVI',
        'video/x-ms-wmv': 'Video WMV',
        'video/webm': 'Video WebM',
        'video/x-flv': 'Video FLV',
        'video/3gpp': 'Video 3GP',
        
        // Audio
        'audio/mpeg': 'Âm thanh MP3',
        'audio/mp3': 'Âm thanh MP3',
        'audio/wav': 'Âm thanh WAV',
        'audio/ogg': 'Âm thanh OGG',
        'audio/webm': 'Âm thanh WebM',
        'audio/aac': 'Âm thanh AAC',
        'audio/flac': 'Âm thanh FLAC',
        'audio/x-m4a': 'Âm thanh M4A',
        
        // Archives
        'application/zip': 'Tệp nén ZIP',
        'application/x-rar-compressed': 'Tệp nén RAR',
        'application/x-7z-compressed': 'Tệp nén 7Z',
        'application/x-tar': 'Tệp nén TAR',
        'application/gzip': 'Tệp nén GZIP',
        'application/x-bzip2': 'Tệp nén BZIP2',
        
        // Code
        'text/html': 'Trang HTML',
        'text/css': 'Tệp CSS',
        'text/javascript': 'Tệp JavaScript',
        'application/javascript': 'Tệp JavaScript',
        'application/json': 'Tệp JSON',
        'application/xml': 'Tệp XML',
        'text/xml': 'Tệp XML',
        'application/x-python': 'Mã Python',
        'text/x-python': 'Mã Python',
        'application/x-java': 'Mã Java',
        'text/x-java': 'Mã Java',
        'text/x-c': 'Mã C',
        'text/x-c++': 'Mã C++',
        'text/x-csharp': 'Mã C#',
        'text/x-php': 'Mã PHP',
        'application/x-php': 'Mã PHP',
        
        // Others
        'application/octet-stream': 'Tệp nhị phân',
        'application/x-executable': 'Tệp thực thi',
        'application/x-sharedlib': 'Thư viện chia sẻ'
    };

    const friendlyName = mimeTypeMap[mimeType.toLowerCase()];
    if (friendlyName) {
        return friendlyName;
    }

    // Handle generic patterns
    if (mimeType.startsWith('image/')) {
        const format = mimeType.split('/')[1].toUpperCase();
        return `Hình ảnh ${format}`;
    }
    if (mimeType.startsWith('video/')) {
        const format = mimeType.split('/')[1].toUpperCase();
        return `Video ${format}`;
    }
    if (mimeType.startsWith('audio/')) {
        const format = mimeType.split('/')[1].toUpperCase();
        return `Âm thanh ${format}`;
    }
    if (mimeType.startsWith('text/')) {
        return 'Tệp văn bản';
    }

    // Fallback: try to use extension
    if (extension) {
        return extension.toUpperCase().replace(/^\./, '') + ' File';
    }

    // Last resort: show abbreviated mime type
    return mimeType.split('/').pop().split('.').pop().toUpperCase();
}

function hydrateFileDetails(serverDetails = {}, fallbackFile = {}) {
    const merged = {
        ...fallbackFile,
        ...serverDetails
    };

    merged.displayName = serverDetails.displayName || serverDetails.originalName || fallbackFile.displayName || fallbackFile.originalName || serverDetails.name;
    merged.originalName = serverDetails.originalName || merged.displayName;
    merged.size = typeof serverDetails.size === 'number' ? serverDetails.size : fallbackFile.size;
    merged.type = serverDetails.type || serverDetails.mimeType || fallbackFile.type;
    merged.uploadDate = serverDetails.uploadDate || fallbackFile.uploadDate;
    merged.modifiedDate = serverDetails.modifiedDate || fallbackFile.modifiedDate || fallbackFile.uploadDate;
    merged.shareState = getShareStateForFile(merged);

    const fileId = normalizeFileId(merged);
    const shareOverride = fileId ? shareOverrides[fileId] : null;
    merged.shareUpdatedAt = shareOverride?.updatedAt || fallbackFile.shareUpdatedAt || fallbackFile.metadata?.shareUpdatedAt;
    const fallbackToken = serverDetails.shareToken ?? serverDetails.metadata?.shareToken ?? fallbackFile.shareToken ?? fallbackFile.metadata?.shareToken ?? null;
    const fallbackUrl = serverDetails.shareUrl ?? serverDetails.metadata?.shareUrl ?? fallbackFile.shareUrl ?? fallbackFile.metadata?.shareUrl ?? null;
    const resolvedShareToken = fileId ? getShareTokenForFile(fileId, fallbackToken) : fallbackToken;
    const resolvedShareUrl = fileId ? getShareUrlForFile(fileId, fallbackUrl) : fallbackUrl;
    merged.shareToken = resolvedShareToken;
    merged.shareUrl = resolvedShareUrl;

    if (fileId) {
        const shareState = merged.shareState || 'private';
        const shareToken = resolvedShareToken ?? merged.metadata?.shareToken ?? null;
        const shareUrl = shareState === 'public'
            ? (resolvedShareUrl || (shareToken ? buildShareUrl(fileId, shareToken) : null))
            : null;

        merged.shareUrl = shareUrl;

        detailSnapshots[fileId] = {
            name: merged.displayName,
            shareState: merged.shareState,
            version: merged.version || fallbackFile.version || 1,
            size: merged.size,
            updatedAt: merged.modifiedDate || merged.uploadDate,
            shareUpdatedAt: merged.shareUpdatedAt,
            shareToken: shareToken,
            shareUrl: shareUrl,
            fetchedAt: new Date().toISOString()
        };
        saveDetailSnapshots();

        persistShareOverride(fileId, shareState, {
            shareToken,
            shareUrl
        });
    }

    return merged;
}

function buildFileDetailsModal(fileDetails) {
    const container = document.createElement('div');
    container.className = 'file-details-modal';

    const fileId = normalizeFileId(fileDetails);
    const shareState = getShareStateForFile(fileDetails);
    const shareChipClass = shareState === 'public'
        ? 'file-preview-chip share-state-chip is-public'
        : 'file-preview-chip share-state-chip is-private';
    const formattedSize = fileDetails.formattedSize || formatReadableFileSize(fileDetails.size);
    const uploadLabel = formatAbsoluteDateTime(fileDetails.uploadDate);
    const modifiedLabel = formatAbsoluteDateTime(fileDetails.modifiedDate || fileDetails.lastModified);
    const rawMimeType = fileDetails.mimeType || fileDetails.type || 'Không xác định';
    const extensionLabel = fileDetails.extension ? fileDetails.extension.replace(/^\./, '') : '';
    const typeLabel = getFriendlyFileType(rawMimeType, extensionLabel);
    const versionLabel = String(fileDetails.version || 1);
    const checksumValue = fileDetails.hash || fileDetails.checksum || fileDetails.integrityHash || null;
    const hashHtml = checksumValue
        ? `<div class="details-hash-row"><code>${escapeHtml(checksumValue)}</code><button class="hash-copy-btn" onclick="copyToClipboard('${escapeForJsString(checksumValue)}')"><i class="fas fa-copy"></i></button></div>`
        : null;
    const previewName = fileDetails.displayName || fileDetails.originalName || fileDetails.name || fileId || 'Không xác định';
    const downloadName = fileDetails.originalName || fileDetails.displayName || previewName;
    const previewMime = fileDetails.mimeType || fileDetails.type || 'application/octet-stream';
    const iconDescriptor = getFileIconDescriptor(fileDetails);
    const previewIconVariantAttr = iconDescriptor.variant ? ` data-icon-variant="${iconDescriptor.variant}"` : '';
    const previewIconHtml = `<div class="file-preview-icon"${previewIconVariantAttr}><i class="fas ${iconDescriptor.icon} ${iconDescriptor.tone}"></i></div>`;
    const previewThumbnail = fileDetails.thumbnail
        ? `<img src="${fileDetails.thumbnail}" alt="Xem trước ${escapeHtml(previewName)}">`
        : previewIconHtml;
    const ownerProfile = window.currentUserProfile || {};
    const ownerNameRaw = (ownerProfile.fullName && ownerProfile.fullName.trim()) || ownerProfile.email || 'Bạn';
    const ownerInitial = ownerNameRaw.trim().charAt(0).toUpperCase() || 'B';
    const ownerName = escapeHtml(ownerNameRaw);
    const timelineItems = createTimelineItems(fileDetails, detailSnapshots[fileId]);

    const detailsRows = [
        { label: 'Loại', value: typeLabel || '—' },
        { label: 'Kích thước', value: formattedSize || '—' },
        { label: 'Định dạng', value: extensionLabel ? `.${extensionLabel.toUpperCase()}` : '—' },
        { label: 'Ngày tải lên', value: uploadLabel || '—' },
        { label: 'Cập nhật gần nhất', value: modifiedLabel || '—' },
        { label: 'Phiên bản', value: versionLabel }
    ];

    if (hashHtml) {
        detailsRows.push({ label: 'Mã băm', html: hashHtml });
    }

    const detailsHtml = detailsRows.map((row) => {
        const safeLabel = escapeHtml(row.label);
        const safeValue = Object.prototype.hasOwnProperty.call(row, 'html')
            ? row.html
            : escapeHtml(row.value || '—');
        return `<div class="file-details-row"><dt>${safeLabel}</dt><dd>${safeValue}</dd></div>`;
    }).join('');

    container.innerHTML = `
        <section class="file-details-section">
            <h5>Chi tiết</h5>
            <dl class="file-details-list">
                ${detailsHtml}
            </dl>
        </section>
        <section class="file-details-section">
            <h5>Người có quyền truy cập</h5>
            <div class="file-access-card">
                <div class="file-access-avatar">${escapeHtml(ownerInitial)}</div>
                <div class="file-access-info">
                    <span class="file-access-name">${ownerName}</span>
                    <span class="file-access-role">Chủ sở hữu</span>
                </div>
                <span class="file-access-badge">${shareState === 'public' ? 'Bất kỳ ai có liên kết' : 'Chỉ mình tôi'}</span>
            </div>
            <p class="file-access-note">Tính năng quản lý chia sẻ nâng cao đang được phát triển.</p>
        </section>
    `;

    if (timelineItems.length) {
        const timelineSection = document.createElement('section');
        timelineSection.className = 'file-details-section';
        timelineSection.innerHTML = `
            <h5>Hoạt động gần đây</h5>
            <div class="file-activity-timeline">
                ${timelineItems.map(item => `
                    <div class="timeline-item">
                        <div class="timeline-icon"><i class="fas ${item.icon}"></i></div>
                        <div class="timeline-content">
                            <div class="timeline-title">${escapeHtml(item.title)}</div>
                            <div class="timeline-subtitle">${escapeHtml(item.subtitle)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(timelineSection);
    }

    return container;
}

function createTimelineItems(fileDetails, snapshot = {}) {
    const items = [];

    if (fileDetails.uploadDate) {
        items.push({
            icon: 'fa-cloud-upload-alt',
            title: 'Tải lên thành công',
            subtitle: formatAbsoluteDateTime(fileDetails.uploadDate) || '—'
        });
    }

    if (fileDetails.modifiedDate && fileDetails.modifiedDate !== fileDetails.uploadDate) {
        items.push({
            icon: 'fa-sync-alt',
            title: 'Chỉnh sửa lần cuối',
            subtitle: formatAbsoluteDateTime(fileDetails.modifiedDate) || '—'
        });
    }

    const shareState = (snapshot && snapshot.shareState) || fileDetails.shareState;
    if (shareState) {
        const shareUpdatedAt = (snapshot && (snapshot.shareUpdatedAt || snapshot.updatedAt)) || fileDetails.shareUpdatedAt;
        items.push({
            icon: shareState === 'public' ? 'fa-unlock' : 'fa-lock',
            title: shareState === 'public' ? 'Đang công khai' : 'Đang riêng tư',
            subtitle: shareUpdatedAt ? formatRelativeDate(shareUpdatedAt) : 'Cập nhật ngay'
        });
    }

    return items;
}

function getLatestActivityTimestamp(files = allFiles) {
    let latest = 0;
    files.forEach(file => {
        const modified = coerceToDate(file.modifiedDate) || coerceToDate(file.metadata?.lastModified) || coerceToDate(file.uploadDate);
        if (modified) {
            latest = Math.max(latest, modified.getTime());
        }
    });

    return latest ? new Date(latest) : null;
}

window.initMyFiles = function() {
    console.log('Initializing My Files page...');

    loadShareOverrides();
    loadDetailSnapshots();

    // Initialize drag and drop for the entire page
    initDragAndDrop();

    // Initialize UI
    initializeUI();
    
    // Load existing files from server
    loadFiles();
    
    // Clear previous refresh interval if it exists
    if (myFilesAutoRefreshIntervalId) {
        clearInterval(myFilesAutoRefreshIntervalId);
    }

    // Auto refresh every 10 seconds to show new uploads
    myFilesAutoRefreshIntervalId = setInterval(loadFiles, 10000);
    
    console.log('My Files page initialized successfully');
};

// Refresh files manually
window.refreshFiles = function() {
    console.log('Refreshing files...');

    // Use new toast system directly
    if (window.toastSystem) {
        window.toastSystem.info('Đang làm mới danh sách tệp...', {
            duration: 2000,
            dismissible: false
        });
    }

    // Add rotation animation to refresh button
    const refreshBtn = document.querySelector('[onclick="refreshFiles()"] i');
    if (refreshBtn) {
        refreshBtn.style.animation = 'spin 1s linear';
        setTimeout(() => {
            refreshBtn.style.animation = '';
        }, 1000);
    }

    loadFiles();
};

// Initialize drag and drop functionality
function initDragAndDrop() {
    const container = document.querySelector('.myfiles-container');
    
    if (!container) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    container.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        container.classList.add('drag-over');
    }
    
    function unhighlight(e) {
        container.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            if (window.toastSystem) {
                window.toastSystem.success(`Đã thả ${files.length} tệp. Chuyển đến trang tải lên...`, {
                    duration: 3000
                });
            }
            setTimeout(() => {
                window.loadPage('upload');
            }, 1000);
        }
    }
}

// Simple initialization
function initializeUI() {
    setupSearchAndSort();
    setupViewToggles();
    console.log('UI initialized');
}

function setupSearchAndSort() {
    const searchInput = document.getElementById('file-search');
    const sortSelect = document.getElementById('file-sort');

    if (sortSelect) {
        sortSelect.value = activeSortOption;
        sortSelect.addEventListener('change', event => {
            activeSortOption = event.target.value || DEFAULT_SORT_OPTION;
            applyFiltersAndRender();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = setTimeout(() => {
                applyFiltersAndRender();
            }, 200);
        });
    }
}

function setupViewToggles() {
    const toggleButtons = Array.from(document.querySelectorAll('.view-toggle-btn'));

    if (!toggleButtons.length) {
        return;
    }

    setActiveViewMode(getStoredViewMode(), { skipStorage: true });

    toggleButtons.forEach(button => {
        const requestedMode = button.getAttribute('data-view');
        const normalizedMode = requestedMode === 'grid' ? 'grid' : 'list';

        button.setAttribute('aria-pressed', normalizedMode === activeViewMode ? 'true' : 'false');

        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-view') === 'grid' ? 'grid' : 'list';
            const hasChanged = setActiveViewMode(mode);

            if (!hasChanged) {
                return;
            }

            renderFileList(filteredFiles);

            if (window.toastSystem) {
                window.toastSystem.info(`Đang hiển thị dạng ${mode === 'grid' ? 'lưới' : 'danh sách'}`, {
                    duration: 2000
                });
            }
        });
    });

    syncViewToggleUI();
    updateFilesContentView();
}

function setActiveViewMode(mode, options = {}) {
    const normalized = mode === 'grid' ? 'grid' : 'list';
    const hasChanged = normalized !== activeViewMode;
    activeViewMode = normalized;

    if (!options.skipStorage) {
        saveViewMode(activeViewMode);
    }

    syncViewToggleUI();
    updateFilesContentView();

    return hasChanged;
}

function syncViewToggleUI() {
    const toggleButtons = document.querySelectorAll('.view-toggle-btn');

    toggleButtons.forEach(button => {
        const buttonMode = button.getAttribute('data-view') === 'grid' ? 'grid' : 'list';
        const isActive = buttonMode === activeViewMode;

        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function updateFilesContentView(element) {
    const filesContent = element || document.getElementById('files-content');

    if (!filesContent) {
        return;
    }

    filesContent.setAttribute('data-view-mode', activeViewMode);
    filesContent.classList.toggle('grid-view', activeViewMode === 'grid');
    filesContent.classList.toggle('list-view', activeViewMode !== 'grid');
}

function getStoredViewMode() {
    try {
        const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
        if (stored === 'grid' || stored === 'list') {
            return stored;
        }
    } catch (error) {
        console.warn('Không thể truy cập localStorage để đọc chế độ xem:', error);
    }

    return DEFAULT_VIEW_MODE;
}

function saveViewMode(mode) {
    try {
        window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch (error) {
        console.warn('Không thể lưu chế độ xem vào localStorage:', error);
    }
}

// Load files from server
async function loadFiles() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        const fetchedFiles = Array.isArray(files) ? files : [];
        setAllFiles(fetchedFiles);

        if (fetchedFiles.length > 0) {
            console.log(`Loaded ${fetchedFiles.length} files successfully`);
        } else {
            console.log('No files found');
        }
    } catch (error) {
        console.error('Error loading files:', error);
        if (window.toastSystem) {
            window.toastSystem.error('Lỗi tải danh sách tệp', {
                duration: 4000
            });
        }
    }
}

function setAllFiles(files) {
    const serverFiles = Array.isArray(files) ? files : [];
    syncShareOverridesWithServer(serverFiles);
    allFiles = serverFiles.map(applyShareOverrideToFile);
    applyFiltersAndRender();
}

function syncShareOverridesWithServer(files) {
    if (!Array.isArray(files)) {
        return;
    }

    const validIds = new Set();
    const nextOverrides = { ...shareOverrides };

    files.forEach(file => {
        const fileId = normalizeFileId(file);
        if (!fileId) {
            return;
        }

        validIds.add(fileId);

        const metadata = file.metadata || {};
        const serverState = metadata.shareStatus || (file.visibility === 'public' ? 'public' : (file.isPublic ? 'public' : 'private'));
        const shareToken = metadata.shareToken ?? file.shareToken ?? null;
        const shareUpdatedAt = metadata.shareUpdatedAt || metadata.updatedAt || metadata.lastModified || file.updatedAt || file.modifiedDate || new Date().toISOString();
        const normalizedState = ['public', 'private'].includes(serverState) ? serverState : 'private';
        const computedShareUrl = normalizedState === 'public' ? buildShareUrl(fileId, shareToken) : null;

        nextOverrides[fileId] = {
            state: normalizedState,
            updatedAt: shareUpdatedAt,
            shareToken,
            shareUrl: computedShareUrl || nextOverrides[fileId]?.shareUrl || null
        };

        if (nextOverrides[fileId].state !== 'public') {
            nextOverrides[fileId].shareUrl = null;
        }
    });

    Object.keys(nextOverrides).forEach(id => {
        if (!validIds.has(id)) {
            delete nextOverrides[id];
        }
    });

    shareOverrides = nextOverrides;
    saveShareOverrides();
}

function applyFiltersAndRender() {
    const searchInput = document.getElementById('file-search');
    const sortSelect = document.getElementById('file-sort');

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const sortOption = sortSelect ? sortSelect.value || DEFAULT_SORT_OPTION : DEFAULT_SORT_OPTION;

    activeSortOption = sortOption;

    let workingFiles = [...allFiles];

    if (searchTerm) {
        workingFiles = workingFiles.filter(file => {
            const name = (file.displayName || file.originalName || file.name || '').toLowerCase();
            const type = (file.type || '').toLowerCase();
            const extension = (file.extension || '').toLowerCase();
            const tags = Array.isArray(file.tags) ? file.tags.join(' ').toLowerCase() : '';

            return (
                name.includes(searchTerm) ||
                type.includes(searchTerm) ||
                extension.includes(searchTerm) ||
                tags.includes(searchTerm)
            );
        });
    }

    filteredFiles = sortFiles(workingFiles, sortOption);
    renderFileList(filteredFiles);
}

function renderFileList(files) {
    const filesContent = document.getElementById('files-content');
    const emptyState = document.getElementById('empty-state');

    updateFilesContentView(filesContent);

    if (!filesContent) {
        return;
    }

    const workingFiles = Array.isArray(files) ? files : filteredFiles;

    if (!allFiles.length) {
        if (emptyState) emptyState.style.display = 'block';
        filesContent.classList.remove('has-files');
        filesContent.style.display = 'none';
        filesContent.innerHTML = '';
        updateFileCount([], 0);
        updateFileInsights([]);
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    filesContent.classList.add('has-files');
    filesContent.style.display = 'block';

    if (!workingFiles.length) {
        filesContent.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>Không tìm thấy tệp phù hợp</h3>
                <p>Thử điều chỉnh từ khóa tìm kiếm hoặc thay đổi tiêu chí sắp xếp.</p>
            </div>
        `;
        updateFileCount(workingFiles, allFiles.length);
        updateFileInsights(allFiles);
        return;
    }

    filesContent.innerHTML = createFileListHTML(workingFiles);
    updateFileCount(workingFiles, allFiles.length);
    updateFileInsights(allFiles);
    addFileInteractions();
}

function sortFiles(files, sortOption) {
    const sortedFiles = [...files];
    sortedFiles.sort((a, b) => {
        switch (sortOption) {
            case 'name-asc':
                return getComparableName(a).localeCompare(getComparableName(b), 'vi', { sensitivity: 'base' });
            case 'name-desc':
                return getComparableName(b).localeCompare(getComparableName(a), 'vi', { sensitivity: 'base' });
            case 'date-asc':
                return getUploadTimestamp(a) - getUploadTimestamp(b);
            case 'size-asc':
                return getFileSizeValue(a) - getFileSizeValue(b);
            case 'size-desc':
                return getFileSizeValue(b) - getFileSizeValue(a);
            case 'date-desc':
            default:
                return getUploadTimestamp(b) - getUploadTimestamp(a);
        }
    });

    return sortedFiles;
}

function getComparableName(file) {
    return (file.displayName || file.originalName || file.name || '').toLowerCase();
}

function getUploadTimestamp(file) {
    const candidates = [
        file?.uploadDate,
        file?.uploadedAt,
        file?.createdAt,
        file?.updatedAt,
        file?.lastModified,
        file?.metadata?.uploadDate,
        file?.metadata?.uploadedAt,
        file?.metadata?.createdAt,
        file?.metadata?.updatedAt,
        file?.metadata?.lastModified
    ];

    for (const candidate of candidates) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.getTime();
        }
    }

    return 0;
}

function getFileSizeValue(file) {
    const size = typeof file.size === 'number' ? file.size : Number(file.size);
    if (!Number.isNaN(size)) {
        return size;
    }

    if (file.metadata && typeof file.metadata.size === 'number') {
        return file.metadata.size;
    }

    return 0;
}

function getDisplayDateValue(file) {
    const timestamp = getUploadTimestamp(file);
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
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

function escapeForJsString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Create sample files for demonstration
window.createSampleFiles = function() {
    const now = Date.now();
    const sampleFiles = [
        {
            id: 'sample-doc',
            originalName: 'Tài liệu dự án.pdf',
            displayName: 'Tài liệu dự án.pdf',
            size: 2.5 * 1024 * 1024,
            type: 'application/pdf',
            uploadDate: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            extension: '.pdf',
            isDocument: true
        },
        {
            id: 'sample-image',
            originalName: 'Hình ảnh logo.png',
            displayName: 'Hình ảnh logo.png',
            size: 890 * 1024,
            type: 'image/png',
            uploadDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            extension: '.png',
            isImage: true
        },
        {
            id: 'sample-presentation',
            originalName: 'Bản trình bày.pptx',
            displayName: 'Bản trình bày.pptx',
            size: 5.2 * 1024 * 1024,
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            uploadDate: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
            extension: '.pptx'
        },
        {
            id: 'sample-sheet',
            originalName: 'Dữ liệu bán hàng.xlsx',
            displayName: 'Dữ liệu bán hàng.xlsx',
            size: 1.8 * 1024 * 1024,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            uploadDate: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
            extension: '.xlsx'
        }
    ];

    createFileList(sampleFiles);
    if (window.toastSystem) {
        window.toastSystem.success('Đã tạo 4 tệp mẫu để bạn trải nghiệm!', {
            duration: 3000
        });
    }
};

// Create file list display
function createFileList(files) {
    setAllFiles(Array.isArray(files) ? files : []);
}

// Generate HTML for file list
function createFileListHTML(files) {
    const listClassName = `file-list ${activeViewMode === 'grid' ? 'grid-view' : 'list-view'}`;

    return `
        <div class="${listClassName}">
            ${files.map(file => {
                const shareState = getInitialShareState(file);
                const displayNameRaw = file.displayName || file.originalName || file.name || 'Không có tên';
                const originalNameRaw = file.originalName || displayNameRaw;
                const fileIdRaw = file.id || file.internalName || originalNameRaw;
                const mimeTypeRaw = file.type || '';
                const extensionRaw = file.extension || '';
                const typeLabelRaw = getFriendlyFileType(mimeTypeRaw, extensionRaw);
                const sizeLabel = formatReadableFileSize(file.size);
                const dateValue = getDisplayDateValue(file);
                const dateLabel = formatRelativeDate(dateValue);
                const dateTitle = formatAbsoluteDateTime(dateValue);

                const displayNameHtml = escapeHtml(displayNameRaw);
                const fileIdAttr = escapeHtml(fileIdRaw);
                const shareTokenRaw = file.shareToken || file.metadata?.shareToken || null;
                const shareTokenAttr = shareTokenRaw ? ` data-share-token="${escapeHtml(shareTokenRaw)}"` : '';
                const typeLabelHtml = escapeHtml(typeLabelRaw);
                const sizeLabelHtml = escapeHtml(sizeLabel);
                const dateLabelHtml = escapeHtml(dateLabel);
                const dateTitleHtml = escapeHtml(dateTitle);

                const fileIdJs = escapeForJsString(fileIdRaw);
                const originalNameJs = escapeForJsString(originalNameRaw);
                const mimeTypeJs = escapeForJsString(mimeTypeRaw);
                const displayNameJs = escapeForJsString(displayNameRaw);

                const previewBackground = file.isImage
                    ? `style="background-image: url('/api/preview/${encodeURIComponent(fileIdRaw)}'); background-size: cover; background-position: center;"`
                    : '';

                const iconDescriptor = getFileIconDescriptor(file);
                const iconVariantAttr = (!file.isImage && iconDescriptor.variant)
                    ? ` data-icon-variant="${iconDescriptor.variant}"`
                    : '';
                const iconTitleAttr = (!file.isImage && iconDescriptor.label)
                    ? ` title="${escapeHtml(iconDescriptor.label)}"`
                    : '';
                const iconMarkup = !file.isImage
                    ? `<i class="fas ${iconDescriptor.icon} ${iconDescriptor.tone}"></i>`
                    : '';

                return `
                <div class="file-item" data-file-id="${fileIdAttr}" data-file-name="${displayNameHtml}" data-share-state="${shareState}"${shareTokenAttr}>
                    <div class="file-icon-wrapper ${file.isImage ? 'image-preview' : ''}" ${previewBackground}${iconVariantAttr}${iconTitleAttr}>
                        ${iconMarkup}
                    </div>
                    <div class="file-details">
                        <div class="file-name" title="${displayNameHtml}">${displayNameHtml}</div>
                        <div class="file-meta">
                            <span class="file-size">${sizeLabelHtml}</span>
                            <span class="file-date" title="${dateTitleHtml}">${dateLabelHtml}</span>
                            <span class="file-type" title="${mimeTypeRaw ? escapeHtml(mimeTypeRaw) : 'Không xác định'}">${typeLabelHtml}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="action-btn preview-btn" title="Xem trước" onclick="previewFile('${fileIdJs}', '${originalNameJs}', '${mimeTypeJs}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn details-btn" title="Xem chi tiết" onclick="viewFileDetails('${fileIdJs}')">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="action-btn download-btn" title="Tải xuống" onclick="downloadFile('${fileIdJs}', '${originalNameJs}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn share-manage-btn${shareState === 'public' ? ' is-public' : ''}" title="${shareState === 'public' ? 'Đang công khai - quản lý chia sẻ' : 'Chia sẻ tệp'}" data-file-id="${fileIdAttr}" data-share-state="${shareState}">
                            <i class="fas ${shareState === 'public' ? 'fa-share-square' : 'fa-share-alt'}"></i>
                        </button>
                        <button class="action-btn beamshare-btn" title="BeamShare Live" data-file-id="${fileIdAttr}" data-file-name="${displayNameHtml}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        <button class="action-btn rename-btn" title="Đổi tên" onclick="renameFile('${fileIdJs}', '${displayNameJs}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" title="Xóa" onclick="deleteFile('${fileIdJs}', '${displayNameJs}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
}

function getInitialShareState(file) {
    return getShareStateForFile(file) || 'private';
}

// Get file icon class based on file object
function getFileIconDescriptor(file) {
    if (window.FileIcons && typeof window.FileIcons.resolve === 'function') {
        return window.FileIcons.resolve({
            extension: file?.extension || file?.ext || null,
            name: file?.originalName || file?.displayName || file?.name || null,
            mime: file?.mimeType || file?.type || file?.metadata?.mimeType || null,
            isImage: Boolean(file?.isImage),
            isVideo: Boolean(file?.isVideo),
            isAudio: Boolean(file?.isAudio),
            isDocument: Boolean(file?.isDocument),
            isSheet: Boolean(file?.isSheet),
            isCode: Boolean(file?.isCode)
        });
    }

    return {
        icon: 'fa-file-lines',
        variant: 'generic',
        tone: 'file-icon-tone--generic',
        label: 'Tệp BeamShare'
    };
}

// Format file size
function formatReadableFileSize(bytes) {
    const numericBytes = typeof bytes === 'number' ? bytes : Number(bytes);

    if (!Number.isFinite(numericBytes) || numericBytes < 0) {
        return 'Không xác định';
    }

    if (numericBytes === 0) {
        return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(numericBytes) / Math.log(k)), sizes.length - 1);
    const scaledValue = numericBytes / Math.pow(k, index);

    return `${parseFloat(scaledValue.toFixed(2))} ${sizes[index]}`;
}

// Format date
function coerceToDate(value) {
    if (!value && value !== 0) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const fromNumber = new Date(value);
        return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    const fromInput = new Date(value);
    return Number.isNaN(fromInput.getTime()) ? null : fromInput;
}

function formatRelativeDate(value) {
    const date = coerceToDate(value);
    if (!date) {
        return 'Không xác định';
    }

    const now = new Date();
    const diffTime = now.getTime() - date.getTime();

    if (!Number.isFinite(diffTime)) {
        return 'Không xác định';
    }

    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
        return date.toLocaleDateString('vi-VN');
    }

    if (diffMinutes < 1) {
        return 'Vừa xong';
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} phút trước`;
    }

    if (diffHours < 24) {
        return `${diffHours} giờ trước`;
    }

    if (diffDays === 1) {
        return 'Hôm qua';
    }

    if (diffDays < 7) {
        return `${diffDays} ngày trước`;
    }

    return date.toLocaleDateString('vi-VN');
}

function formatAbsoluteDateTime(value) {
    const date = coerceToDate(value);
    if (!date) {
        return 'Không xác định';
    }

    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Update file count display
function updateFileCount(files, totalFilesCount) {
    const fileCount = document.querySelector('.file-count');
    if (!fileCount) {
        return;
    }

    const currentCount = Array.isArray(files) ? files.length : Number(files) || 0;
    const totalCount = typeof totalFilesCount === 'number' ? totalFilesCount : currentCount;

    if (totalCount && totalCount !== currentCount) {
        fileCount.textContent = `${currentCount}/${totalCount} tệp tin`;
    } else {
        fileCount.textContent = `${currentCount} tệp tin`;
    }
}

function updateFileInsights(files = allFiles) {
    const insightsContainer = document.getElementById('file-insights');
    if (!insightsContainer) {
        return;
    }

    const safeFiles = Array.isArray(files) ? files : [];
    const totalFiles = safeFiles.length;
    const publicCount = safeFiles.filter(file => getShareStateForFile(file) === 'public').length;
    const totalSize = safeFiles.reduce((sum, file) => sum + getFileSizeValue(file), 0);
    const lastActivity = getLatestActivityTimestamp(safeFiles);

    const totalCard = insightsContainer.querySelector('[data-insight="total-files"]');
    if (totalCard) {
        const valueEl = totalCard.querySelector('.insight-value');
        const subEl = totalCard.querySelector('.insight-sub');
        if (valueEl) {
            valueEl.textContent = totalFiles.toString();
        }
        if (subEl) {
            subEl.textContent = publicCount ? `${publicCount} tệp công khai` : 'Tất cả đang riêng tư';
        }
    }

    const storageCard = insightsContainer.querySelector('[data-insight="storage-used"]');
    if (storageCard) {
        const valueEl = storageCard.querySelector('.insight-value');
        const subEl = storageCard.querySelector('.insight-sub');
        if (valueEl) {
            valueEl.textContent = formatReadableFileSize(totalSize);
        }
        if (subEl) {
            subEl.textContent = lastActivity ? `Cập nhật ${formatRelativeDate(lastActivity)}` : 'Chưa có hoạt động';
        }
    }

    const publicCard = insightsContainer.querySelector('[data-insight="public-files"]');
    if (publicCard) {
        const valueEl = publicCard.querySelector('.insight-value');
        const subEl = publicCard.querySelector('.insight-sub');
        if (valueEl) {
            valueEl.textContent = publicCount.toString();
        }
        if (subEl) {
            const privateCount = totalFiles - publicCount;
            subEl.textContent = privateCount ? `${privateCount} tệp riêng tư` : 'Tất cả đang công khai';
        }
    }
}

// Add file interaction handlers
function addFileInteractions() {
    const fileItems = document.querySelectorAll('.file-item');
    const actionBtns = document.querySelectorAll('.action-btn');

    fileItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.closest('.action-btn')) {
                const fileId = this.getAttribute('data-file-id');
                viewFileDetails(fileId);
            }
        });
    });
    
    actionBtns.forEach(btn => {
        if (btn.classList.contains('share-manage-btn') || btn.classList.contains('beamshare-btn')) {
            return;
        }

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.title;
            const fileName = this.closest('.file-item').getAttribute('data-file-name');

            switch(action) {
                case 'Tải xuống':
                    if (window.toastSystem) {
                        window.toastSystem.success(`Đang tải xuống: ${fileName}`, {
                            duration: 2000
                        });
                    }
                    break;
                case 'Chia sẻ':
                    if (window.toastSystem) {
                        window.toastSystem.success(`Đã tạo link chia sẻ cho: ${fileName}`, {
                            duration: 3000
                        });
                    }
                    break;
                case 'Xóa':
                    // Remove this case since delete is handled by the onclick attribute
                    // This prevents the double-modal issue
                    break;
            }
        });
    });

    const shareButtons = document.querySelectorAll('.share-manage-btn');
    shareButtons.forEach(button => {
        const initialState = button.getAttribute('data-share-state') || 'private';
        updateShareButtonState(button, initialState);

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const fileId = button.getAttribute('data-file-id');
            if (!fileId) {
                return;
            }

            openFileShareModal(fileId);
        });
    });

    const beamshareButtons = document.querySelectorAll('.beamshare-btn');
    beamshareButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const fileId = button.getAttribute('data-file-id');
            const fileName = button.getAttribute('data-file-name') || 'tệp đã chọn';
            openBeamShareWorkspace(fileId, fileName);
        });
    });
}

// CRUD Operations

// Download file
window.downloadFile = async function(fileId, fileName) {
    try {
        if (window.toastSystem) {
            window.toastSystem.info(`Đang tải xuống ${fileName}...`, {
                duration: 2000,
                dismissible: false
            });
        }

        const response = await fetch(`/api/download/${fileId}`);

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        if (window.toastSystem) {
            window.toastSystem.success(`Đã tải xuống ${fileName}`, {
                duration: 3000
            });
        }
    } catch (error) {
        console.error('Download error:', error);
        if (window.toastSystem) {
            window.toastSystem.error(`Lỗi tải xuống: ${error.message}`, {
                duration: 4000
            });
        }
    }
};

// Delete file with modal confirmation
window.deleteFile = async function(fileId, fileName) {
    // Prevent double-click by checking if modal is already open
    if (window.modalSystem.activeModal) {
        return;
    }

    const confirmed = await window.modalSystem.confirm({
        title: 'Chuyển vào thùng rác',
        message: `"${fileName}" sẽ được chuyển vào Thùng rác và lưu giữ trong 30 ngày trước khi xóa vĩnh viễn. Bạn có chắc chắn tiếp tục?`,
        confirmText: 'Chuyển vào thùng rác',
        cancelText: 'Hủy',
        confirmClass: 'btn-danger'
    });

    if (!confirmed) {
        return;
    }

    // Disable delete button during processing
    const deleteBtn = document.querySelector(`[onclick="deleteFile('${fileId}', '${fileName}')"]`);
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            window.toastSystem.success(`Đã chuyển ${fileName} vào Thùng rác (giữ 30 ngày).`);
            // Reload file list
            loadFiles();
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        window.toastSystem.error(`Lỗi xóa tệp: ${error.message}`);
    } finally {
        // Re-enable delete button
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        }
    }
};

// Rename file with modal and validation
window.renameFile = async function(fileId, currentName) {
    // Prevent double-click by checking if modal is already open
    if (window.modalSystem.activeModal) {
        return;
    }

    // Extract file extension
    const lastDotIndex = currentName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? currentName.substring(0, lastDotIndex) : currentName;
    const extension = lastDotIndex > 0 ? currentName.substring(lastDotIndex) : '';

    const newName = await window.modalSystem.prompt({
        title: 'Đổi tên tệp',
        message: `Nhập tên mới cho tệp "${currentName}":`,
        defaultValue: nameWithoutExt,
        placeholder: 'Tên tệp (không bao gồm phần mở rộng)',
        confirmText: 'Đổi tên',
        required: true,
        validator: (value) => {
            if (!value.trim()) {
                return 'Tên tệp không được để trống';
            }

            // Check for invalid characters
            const invalidChars = /[<>:"/\\|?*]/;
            if (invalidChars.test(value)) {
                return 'Tên tệp chứa ký tự không hợp lệ';
            }

            // Check for duplicate names (basic check - could be enhanced with server-side validation)
            const fullNewName = value.trim() + extension;
            if (fullNewName === currentName) {
                return 'Tên mới phải khác tên hiện tại';
            }

            // Check if file with new name already exists
            const existingFiles = document.querySelectorAll('.file-item');
            for (let fileItem of existingFiles) {
                const existingName = fileItem.getAttribute('data-file-name');
                if (existingName === fullNewName && fileItem.getAttribute('data-file-id') !== fileId) {
                    return 'Đã tồn tại tệp với tên này';
                }
            }

            return true;
        }
    });

    if (!newName) {
        return;
    }

    const fullNewName = newName + extension;

    // Disable rename button during processing
    const renameBtn = document.querySelector(`[onclick="renameFile('${fileId}', '${currentName}')"]`);
    if (renameBtn) {
        renameBtn.disabled = true;
        renameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName: fullNewName })
        });

        const result = await response.json();

        if (result.success) {
            window.toastSystem.success(`Đã đổi tên thành "${fullNewName}"`);
            // Reload file list
            loadFiles();
        } else {
            throw new Error(result.error || 'Rename failed');
        }
    } catch (error) {
        console.error('Rename error:', error);
        window.toastSystem.error(`Lỗi đổi tên: ${error.message}`);
    } finally {
        // Re-enable rename button
        if (renameBtn) {
            renameBtn.disabled = false;
            renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
        }
    }
};

// View file details with live refresh
window.viewFileDetails = async function(fileId) {
    if (window.modalSystem.activeModal) {
        return;
    }

    const normalizedId = normalizeFileId(fileId);
    if (!normalizedId) {
        return;
    }

    const cachedFile = allFiles.find(file => normalizeFileId(file) === normalizedId) || filteredFiles.find(file => normalizeFileId(file) === normalizedId) || null;

    if (window.toastSystem) {
        window.toastSystem.info('Đang tải chi tiết tệp...', {
            duration: 1500,
            dismissible: false
        });
    }

    try {
        const response = await fetch(`/api/files/${encodeURIComponent(normalizedId)}/details?ts=${Date.now()}`, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const serverDetails = await response.json();

        if (!response.ok) {
            throw new Error(serverDetails.error || 'Failed to fetch file details');
        }

        const hydratedDetails = hydrateFileDetails(serverDetails, cachedFile);
        mergeFileDetailsIntoState(normalizedId, hydratedDetails);

        const modalContent = buildFileDetailsModal(hydratedDetails);
        const downloadName = hydratedDetails.displayName || hydratedDetails.originalName || hydratedDetails.name || 'download';

        window.modalSystem.createModal({
            title: 'Chi tiết tệp',
            content: modalContent,
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onclick: () => {
                        window.modalSystem.closeModal();
                    }
                },
                {
                    text: 'Tải xuống',
                    className: 'btn-primary',
                    onclick: () => {
                        downloadFile(normalizedId, downloadName);
                        window.modalSystem.closeModal();
                    }
                }
            ]
        });

    } catch (error) {
        console.error('Error fetching file details:', error);
        if (window.toastSystem) {
            window.toastSystem.error(`Lỗi tải thông tin tệp: ${error.message}`, {
                duration: 4000
            });
        }
    }
};

function copyShareLinkForFile(fileId) {
    if (!fileId) {
        return;
    }

    const shareState = getShareStateForFile({ id: fileId }) || 'private';
    const shareUrl = getShareUrlForFile(fileId, null);

    if (shareState !== 'public' || !shareUrl) {
        window.toastSystem?.warning('Tệp đang ở chế độ riêng tư. Hãy bật chế độ công khai để sử dụng liên kết chia sẻ.', {
            duration: 3200
        });
        return;
    }

    window.copyToClipboard(shareUrl);
}

function buildShareDialogContent(fileDetails, fileId) {
    const container = document.createElement('div');
    container.className = 'share-dialog';
    container.setAttribute('data-file-id', fileId);

    const iconDescriptor = getFileIconDescriptor(fileDetails);
    const iconVariantAttr = iconDescriptor.variant ? ` data-icon-variant="${iconDescriptor.variant}"` : '';
    const displayName = escapeHtml(fileDetails.displayName || fileDetails.originalName || fileId);
    const rawSize = typeof fileDetails.size === 'number' ? fileDetails.size : Number(fileDetails.size) || 0;
    const readableSize = rawSize > 0 ? formatReadableFileSize(rawSize) : 'Không xác định';
    const lastUpdatedSource = fileDetails.modifiedDate || fileDetails.uploadDate || null;
    const lastUpdated = lastUpdatedSource ? formatRelativeDate(lastUpdatedSource) : 'Chưa có thông tin';
    const sanitizedIdSegment = String(fileId).replace(/[^a-zA-Z0-9_-]/g, '');
    const linkInputId = sanitizedIdSegment ? `share-link-${sanitizedIdSegment}` : `share-link-${Math.random().toString(36).slice(2, 10)}`;

    container.innerHTML = `
        <div class="share-dialog__section share-dialog__header">
            <div class="share-dialog__file">
                <span class="share-dialog__file-icon"${iconVariantAttr}><i class="fas ${iconDescriptor.icon} ${iconDescriptor.tone}"></i></span>
                <div>
                    <h4 class="share-dialog__file-name" title="${displayName}">${displayName}</h4>
                    <p class="share-dialog__file-meta">Dung lượng ${escapeHtml(readableSize)} · Cập nhật ${escapeHtml(lastUpdated)}</p>
                </div>
            </div>
        </div>
        <div class="share-dialog__section">
            <div class="share-dialog__people-header">
                <span class="share-dialog__section-title">Những người có quyền truy cập</span>
                <span class="share-dialog__hint-muted">Tính năng thêm người đang được phát triển</span>
            </div>
            <div class="share-dialog__person is-owner">
                <div class="share-dialog__avatar">B</div>
                <div class="share-dialog__person-info">
                    <span class="share-dialog__person-name">Bạn</span>
                    <span class="share-dialog__person-role">Chủ sở hữu</span>
                </div>
                <span class="share-dialog__badge">Chủ sở hữu</span>
            </div>
        </div>
        <div class="share-dialog__section">
            <div class="share-dialog__access">
                <div>
                    <span class="share-dialog__section-title">Quyền truy cập chung</span>
                    <p class="share-dialog__access-hint">Bất kỳ ai có đường liên kết đều có thể xem tệp này.</p>
                </div>
                <select class="share-access-select" aria-label="Quyền truy cập chung">
                    <option value="private">Bị giới hạn</option>
                    <option value="public">Bất kỳ ai có đường liên kết</option>
                </select>
            </div>
            <div class="share-dialog__link">
                <label for="${linkInputId}" class="sr-only">Đường liên kết chia sẻ</label>
                <input id="${linkInputId}" type="text" class="share-link-input" readonly placeholder="Liên kết chia sẻ sẽ xuất hiện ở đây">
                <div class="share-dialog__link-actions">
                    <button type="button" class="btn-secondary share-copy-btn"><i class="fas fa-link"></i> Sao chép liên kết</button>
                    <button type="button" class="btn-secondary share-open-btn"><i class="fas fa-external-link-alt"></i> Mở trang chia sẻ</button>
                    <button type="button" class="btn-secondary share-regenerate-btn"><i class="fas fa-redo"></i> Tạo liên kết mới</button>
                </div>
            </div>
        </div>
    `;

    return {
        container,
        accessSelect: container.querySelector('.share-access-select'),
        accessHint: container.querySelector('.share-dialog__access-hint'),
        linkInput: container.querySelector('.share-link-input'),
        copyBtn: container.querySelector('.share-copy-btn'),
        openBtn: container.querySelector('.share-open-btn'),
        regenerateBtn: container.querySelector('.share-regenerate-btn')
    };
}

function refreshShareDialogUI(dialogRefs, state, shareUrl) {
    const isPublic = state === 'public';
    const hasLink = Boolean(shareUrl);

    if (dialogRefs.accessSelect) {
        dialogRefs.accessSelect.value = isPublic ? 'public' : 'private';
    }

    if (dialogRefs.accessHint) {
        dialogRefs.accessHint.textContent = isPublic
            ? 'Bất kỳ ai có đường liên kết đều có thể xem tệp này.'
            : 'Chỉ bạn mới có thể truy cập. Tạo liên kết công khai để chia sẻ.';
    }

    if (dialogRefs.linkInput) {
        dialogRefs.linkInput.value = isPublic && hasLink ? shareUrl : '';
        dialogRefs.linkInput.disabled = !(isPublic && hasLink);
        dialogRefs.linkInput.placeholder = isPublic ? 'Đang tạo liên kết...' : 'Liên kết chỉ xuất hiện khi tệp công khai';
    }

    const actionDisabled = !(isPublic && hasLink);
    if (dialogRefs.copyBtn) {
        dialogRefs.copyBtn.disabled = actionDisabled;
    }
    if (dialogRefs.openBtn) {
        dialogRefs.openBtn.disabled = actionDisabled;
    }
    if (dialogRefs.regenerateBtn) {
        dialogRefs.regenerateBtn.disabled = !isPublic;
    }

    if (dialogRefs.roleButtons) {
        dialogRefs.roleButtons.forEach((button) => {
            const role = button.getAttribute('data-role');
            const isViewer = role === 'viewer';
            button.classList.toggle('is-active', isViewer);
        });
    }
}

function setShareDialogBusy(dialogRefs, isBusy) {
    const elements = [
        dialogRefs.accessSelect,
        dialogRefs.copyBtn,
        dialogRefs.openBtn,
        dialogRefs.regenerateBtn,
        dialogRefs.linkInput
    ].filter(Boolean);

    elements.forEach((element) => {
        if (isBusy) {
            element.dataset.prevDisabled = element.disabled ? '1' : '0';
            element.disabled = true;
        } else {
            const wasDisabled = element.dataset.prevDisabled === '1';
            element.disabled = Boolean(wasDisabled);
            delete element.dataset.prevDisabled;
        }
    });

    if (!isBusy) {
        refreshShareDialogUI(dialogRefs, dialogRefs.accessSelect?.value || 'private', dialogRefs.linkInput?.value || '');
    }
}

async function openFileShareModal(fileId) {
    const normalizedId = normalizeFileId(fileId);
    if (!normalizedId) {
        return;
    }

    if (window.modalSystem?.activeModal && typeof window.modalSystem.closeModal === 'function') {
        window.modalSystem.closeModal();
    }

    const cachedFile = allFiles.find(file => normalizeFileId(file) === normalizedId) || filteredFiles.find(file => normalizeFileId(file) === normalizedId) || {};

    try {
        const response = await fetch(`/api/files/${encodeURIComponent(normalizedId)}/details?ts=${Date.now()}`, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        const serverDetails = await response.json();
        if (!response.ok) {
            throw new Error(serverDetails.error || 'Không thể tải thông tin chia sẻ.');
        }

        const hydratedDetails = hydrateFileDetails(serverDetails, cachedFile);
        mergeFileDetailsIntoState(normalizedId, hydratedDetails);

        const initialState = hydratedDetails.shareState || 'private';
        const initialUrl = getShareUrlForFile(normalizedId, hydratedDetails.shareUrl || null);

        const dialogRefs = buildShareDialogContent(hydratedDetails, normalizedId);

        window.modalSystem.createModal({
            title: `Chia sẻ tệp`,
            content: dialogRefs.container,
            buttons: [
                {
                    text: 'Xong',
                    className: 'btn-primary',
                    onclick: () => {
                        window.modalSystem.closeModal();
                    }
                }
            ]
        });

        refreshShareDialogUI(dialogRefs, initialState, initialUrl);

        if (dialogRefs.linkInput) {
            dialogRefs.linkInput.addEventListener('focus', () => dialogRefs.linkInput.select());
            dialogRefs.linkInput.addEventListener('click', () => dialogRefs.linkInput.select());
        }

        let currentState = initialState;
        let currentUrl = initialUrl;

        if (dialogRefs.accessSelect) {
            dialogRefs.accessSelect.addEventListener('change', async (event) => {
                const requestedState = event.target.value === 'public' ? 'public' : 'private';
                if (requestedState === currentState) {
                    return;
                }

                try {
                    setShareDialogBusy(dialogRefs, true);
                    const result = await changeFileVisibility(normalizedId, requestedState, { regenerateToken: false, showToast: true });
                    currentState = result.visibility;
                    currentUrl = result.shareUrl;
                    refreshShareDialogUI(dialogRefs, currentState, currentUrl);
                } catch (error) {
                    console.error('Share update error:', error);
                    window.toastSystem?.error(error.message || 'Không thể cập nhật quyền chia sẻ.', {
                        duration: 3500
                    });
                    dialogRefs.accessSelect.value = currentState === 'public' ? 'public' : 'private';
                    refreshShareDialogUI(dialogRefs, currentState, currentUrl);
                } finally {
                    setShareDialogBusy(dialogRefs, false);
                }
            });
        }

        if (dialogRefs.copyBtn) {
            dialogRefs.copyBtn.addEventListener('click', () => {
                copyShareLinkForFile(normalizedId);
            });
        }

        if (dialogRefs.openBtn) {
            dialogRefs.openBtn.addEventListener('click', () => {
                openShareTabForFile(normalizedId, hydratedDetails.displayName, {
                    shareToken: getShareTokenForFile(normalizedId, hydratedDetails.shareToken || null),
                    visibility: currentState
                });
            });
        }

        if (dialogRefs.regenerateBtn) {
            dialogRefs.regenerateBtn.addEventListener('click', async () => {
                try {
                    setShareDialogBusy(dialogRefs, true);
                    const result = await regenerateShareLink(normalizedId);
                    if (result) {
                        currentState = result.visibility;
                        currentUrl = result.shareUrl;
                        refreshShareDialogUI(dialogRefs, currentState, currentUrl);
                    }
                } catch (error) {
                    // lỗi đã được hiển thị trong regenerateShareLink
                } finally {
                    setShareDialogBusy(dialogRefs, false);
                }
            });
        }

        if (dialogRefs.roleButtons) {
            dialogRefs.roleButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    if (button.hasAttribute('disabled')) {
                        window.toastSystem?.info('Quyền nâng cao sẽ sớm có mặt.', {
                            duration: 3000
                        });
                        return;
                    }

                    dialogRefs.roleButtons.forEach(btn => btn.classList.remove('is-active'));
                    button.classList.add('is-active');
                });
            });
        }

    } catch (error) {
        console.error('Open share modal error:', error);
        window.toastSystem?.error(error.message || 'Không thể mở giao diện chia sẻ.', {
            duration: 4000
        });
    }
}

async function regenerateShareLink(fileId) {
    if (!fileId) {
        return;
    }

    const currentState = getShareStateForFile({ id: fileId }) || 'private';
    if (currentState !== 'public') {
        window.toastSystem?.warning('Bật chế độ công khai trước khi tạo liên kết chia sẻ mới.', {
            duration: 3200
        });
        return;
    }

    const regenerateBtn = findShareElement('.file-share-regenerate', fileId);
    const originalContent = regenerateBtn ? regenerateBtn.innerHTML : null;

    if (regenerateBtn) {
        regenerateBtn.disabled = true;
        regenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
    }

    try {
        const result = await changeFileVisibility(fileId, 'public', {
            regenerateToken: true,
            showToast: false
        });

        if (window.toastSystem) {
            window.toastSystem.success('Đã tạo liên kết chia sẻ mới!', {
                duration: 2800
            });
        }

        return result;
    } catch (error) {
        console.error('Regenerate share link error:', error);
        window.toastSystem?.error(`Không thể tạo liên kết mới: ${error.message}`, {
            duration: 4000
        });
        throw error;
    } finally {
        if (regenerateBtn) {
            regenerateBtn.disabled = false;
            regenerateBtn.innerHTML = originalContent || '<i class="fas fa-redo"></i> Tạo liên kết mới';
        }
    }
}

// Copy to clipboard utility
window.copyToClipboard = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        window.toastSystem.success('Đã sao chép vào clipboard');
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        window.toastSystem.success('Đã sao chép vào clipboard');
    }
};

// Simplified file type detection (kept for compatibility)
function getEnhancedFileType(fileName, mimeType) {
    const ext = fileName.toLowerCase().split('.').pop();
    return { extension: ext };
}

function normalizeExtension(extension) {
    if (!extension) {
        return '';
    }
    const trimmed = extension.trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.startsWith('.') ? trimmed.toLowerCase() : `.${trimmed.toLowerCase()}`;
}

function extractExtension(file, fallbackName) {
    if (file && file.extension) {
        return normalizeExtension(file.extension);
    }
    const candidate = file?.originalName || fallbackName || '';
    const dotIndex = candidate.lastIndexOf('.');
    if (dotIndex >= 0 && dotIndex < candidate.length - 1) {
        return normalizeExtension(candidate.slice(dotIndex));
    }
    return '';
}

function inferMimeType(file, fallbackType, extension) {
    const directType = file?.type || file?.mimeType || file?.metadata?.mimeType;
    if (directType) {
        return directType;
    }
    if (fallbackType) {
        return fallbackType;
    }
    switch (extension) {
        case '.pdf':
            return 'application/pdf';
        case '.docx':
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case '.doc':
            return 'application/msword';
        case '.xlsx':
            return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case '.xls':
            return 'application/vnd.ms-excel';
        case '.pptx':
            return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case '.ppt':
            return 'application/vnd.ms-powerpoint';
        case '.json':
            return 'application/json';
        case '.txt':
            return 'text/plain';
        case '.csv':
            return 'text/csv';
        default:
            return '';
    }
}

function derivePreviewFlags(extension, mimeType, file) {
    const lowerMime = (mimeType || '').toLowerCase();
    const isImage = Boolean(file?.isImage || IMAGE_EXTENSIONS.has(extension) || lowerMime.startsWith('image/'));
    const isVideo = Boolean(file?.isVideo || VIDEO_EXTENSIONS.has(extension) || lowerMime.startsWith('video/'));
    const isAudio = Boolean(file?.isAudio || AUDIO_EXTENSIONS.has(extension) || lowerMime.startsWith('audio/'));

    return { isImage, isVideo, isAudio };
}

function getOwnerDisplayName() {
    const profile = window.currentUserProfile || {};
    const candidates = [
        profile.fullName,
        profile.displayName,
        profile.name,
        profile.username,
        profile.email
    ];

    for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    return 'Bạn';
}

function buildPreviewContext(fileId, file, fallbackName, fallbackType) {
    const extension = extractExtension(file, fallbackName);
    const mimeType = inferMimeType(file, fallbackType, extension);
    const flags = derivePreviewFlags(extension, mimeType, file);
    const ownerName = getOwnerDisplayName();

    const displayName = file?.displayName || file?.originalName || fallbackName || fileId || 'Không xác định';
    const originalName = file?.originalName || displayName;
    const sizeValue = typeof file?.size === 'number' ? file.size : Number(file?.size);
    const formattedSize = Number.isFinite(sizeValue) ? formatReadableFileSize(sizeValue) : (file?.formattedSize || null);

    const metadata = {
        id: fileId,
        displayName,
        originalName,
        extension,
        mimeType,
        formattedSize,
        isImage: flags.isImage,
        isVideo: flags.isVideo,
        isAudio: flags.isAudio,
        owner: ownerName
    };

    return {
        metadata,
        ownerName,
        downloadName: originalName
    };
}

function defaultClosePreviewModal() {
    const modal = document.getElementById(PREVIEW_MODAL_ID);
    if (modal && modal.parentElement) {
        modal.parentElement.removeChild(modal);
    }
}

function showPreviewModal({ fileId, metadata, ownerName, previewUrl, downloadName }) {
    if (!metadata) {
        return;
    }

    const existingModal = document.getElementById(PREVIEW_MODAL_ID);
    if (existingModal) {
        existingModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = PREVIEW_MODAL_ID;
    overlay.className = 'modal-overlay beam-preview-overlay';

    const safeTitle = escapeHtml(metadata.displayName || metadata.originalName || 'Xem trước tệp');
    const safeDownloadName = downloadName || metadata.originalName || metadata.displayName || fileId;

    overlay.innerHTML = `
        <div class="modal-content beam-preview-modal">
            <div class="modal-header">
                <h3>${safeTitle}</h3>
                <div class="modal-header-actions">
                    <button type="button" class="modal-action-icon" data-action="download" title="Tải xuống tệp">
                        <i class="fas fa-download"></i>
                    </button>
                    <button type="button" class="modal-close" aria-label="Đóng xem trước">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="modal-body beam-preview-body">
                <div class="beam-preview-wrapper">
                    <div class="beam-preview-container" id="beam-preview-container">
                        <p class="beam-preview-placeholder">Đang chuẩn bị xem trước…</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-download" data-action="download">
                    <i class="fas fa-download"></i>
                    Tải xuống
                </button>
                <button type="button" class="btn-close" data-action="close">Đóng</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const container = overlay.querySelector('#beam-preview-container');

    if (!window.BeamPreview || typeof window.BeamPreview.render !== 'function') {
        container.innerHTML = '<p class="share-preview-message">Không thể khởi tạo trình xem trước. Vui lòng tải xuống để xem chi tiết.</p>';
    } else {
        window.BeamPreview.render(container, metadata, {
            previewUrl,
            ownerName,
            pdfWithCredentials: true,
            showDisclaimer: true
        });
    }

    const restoreClose = defaultClosePreviewModal;

    const closeModal = () => {
        document.removeEventListener('keydown', handleKeydown);
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
        window.closePreviewModal = restoreClose;
    };

    const triggerDownload = () => {
        downloadFile(fileId, safeDownloadName);
    };

    const handleKeydown = (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    const closeButtons = overlay.querySelectorAll('[data-action="close"], .modal-close');
    closeButtons.forEach((button) => {
        button.addEventListener('click', closeModal);
    });

    const downloadButtons = overlay.querySelectorAll('[data-action="download"]');
    downloadButtons.forEach((button) => {
        button.addEventListener('click', triggerDownload);
    });

    window.closePreviewModal = closeModal;
}

// Preview file with BeamPreview module
window.previewFile = function(fileId, fileName, fileType) {
    const file = findFileById(fileId);
    const fallbackName = fileName || file?.displayName || file?.originalName || fileId;
    const fallbackType = fileType || file?.type || file?.metadata?.mimeType || '';
    const previewUrl = `/api/preview/${encodeURIComponent(fileId)}`;

    const context = buildPreviewContext(fileId, file, fallbackName, fallbackType);
    showPreviewModal({
        fileId,
        metadata: context.metadata,
        ownerName: context.ownerName,
        previewUrl,
        downloadName: context.downloadName
    });
};

// Helper function to get Office icon
function getOfficeIcon(fileExt) {
    switch (fileExt) {
        case 'doc':
        case 'docx':
            return 'fa-file-word';
        case 'xls':
        case 'xlsx':
            return 'fa-file-excel';
        case 'ppt':
        case 'pptx':
            return 'fa-file-powerpoint';
        default:
            return 'fa-file';
    }
}

// Helper function to get file type icon
function getFileTypeIcon(fileExt) {
    const normalisedExt = typeof fileExt === 'string' ? fileExt.replace(/^\./, '').toLowerCase() : '';
    const descriptor = window.FileIcons && typeof window.FileIcons.resolveFromExtension === 'function'
        ? window.FileIcons.resolveFromExtension(normalisedExt)
        : null;

    const icon = descriptor?.icon || 'fa-file-lines';
    const tone = descriptor?.tone || 'file-icon-tone--generic';
    return `${icon} ${tone}`;
}

// Open file preview (compatibility helper)
window.openFilePreview = function(fileId, fileName, fileType) {
    window.previewFile(fileId, fileName, fileType);
};

// Close preview modal fallback
window.closePreviewModal = defaultClosePreviewModal;

// Cleanup when navigating away from the page
window.cleanupMyFiles = function() {
    if (myFilesAutoRefreshIntervalId) {
        clearInterval(myFilesAutoRefreshIntervalId);
        myFilesAutoRefreshIntervalId = null;
    }

    if (typeof window.closePreviewModal === 'function') {
        try {
            window.closePreviewModal();
        } catch (_error) {
            // Ignore cleanup errors
        }
    }
};

// Auto-initialize if page is already loaded
document.addEventListener('DOMContentLoaded', function() {
    const myFilesPage = document.getElementById('myfiles-page');
    if (myFilesPage && myFilesPage.classList.contains('active')) {
        window.initMyFiles();
    }
});