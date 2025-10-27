// My Files Page JavaScript - Compact
const DEFAULT_SORT_OPTION = 'date-desc';
const DEFAULT_VIEW_MODE = 'list';
const VIEW_MODE_STORAGE_KEY = 'myfiles:view-mode';
const SHARE_STATE_STORAGE_KEY = 'myfiles:share-overrides';
const DETAIL_SNAPSHOT_STORAGE_KEY = 'myfiles:detail-snapshots';
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

function openShareTabForFile(fileId, displayName) {
    if (!fileId) {
        if (window.toastSystem) {
            window.toastSystem.error('Không thể xác định tệp để chia sẻ.', {
                duration: 4000
            });
        }
        return;
    }

    const shareUrl = `/share?driveFile=${encodeURIComponent(fileId)}`;
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
        window.toastSystem.info(`Đang mở BeamShare Share cho: ${displayName}`, {
            duration: 3500
        });
    }
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
    }

    return nextFile;
}

function persistShareOverride(fileId, state) {
    if (!fileId) {
        return;
    }

    shareOverrides[fileId] = {
        state,
        updatedAt: new Date().toISOString()
    };
    saveShareOverrides();

    detailSnapshots[fileId] = {
        ...(detailSnapshots[fileId] || {}),
        shareState: state,
        shareUpdatedAt: shareOverrides[fileId].updatedAt,
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

    if (fileId) {
        detailSnapshots[fileId] = {
            name: merged.displayName,
            shareState: merged.shareState,
            version: merged.version || fallbackFile.version || 1,
            size: merged.size,
            updatedAt: merged.modifiedDate || merged.uploadDate,
            shareUpdatedAt: merged.shareUpdatedAt,
            fetchedAt: new Date().toISOString()
        };
        saveDetailSnapshots();
    }

    return merged;
}

function buildFileDetailsModal(fileDetails) {
    const container = document.createElement('div');
    container.className = 'file-details-modal';

    const fileId = normalizeFileId(fileDetails);
    const shareState = getShareStateForFile(fileDetails);
    const shareChipClass = shareState === 'public' ? 'details-chip is-public' : 'details-chip is-private';
    const formattedSize = formatReadableFileSize(fileDetails.size);
    const uploadLabel = formatAbsoluteDateTime(fileDetails.uploadDate);
    const modifiedLabel = formatAbsoluteDateTime(fileDetails.modifiedDate);
    const timelineItems = createTimelineItems(fileDetails, detailSnapshots[fileId]);
    const hashHtml = fileDetails.hash
        ? `<div class="details-hash-row"><code>${escapeHtml(fileDetails.hash)}</code><button class="hash-copy-btn" onclick="copyToClipboard('${escapeForJsString(fileDetails.hash)}')"><i class="fas fa-copy"></i></button></div>`
        : 'Đang tạo...';

    container.innerHTML = `
        <div class="file-details-hero">
            <div class="file-icon-bubble">
                <i class="fas ${getFileIconClass(fileDetails)}"></i>
            </div>
            <div class="file-details-heading">
                <h4 title="${escapeHtml(fileDetails.displayName || '')}">${escapeHtml(fileDetails.displayName || '')}</h4>
                <div class="file-detail-meta">
                    <span class="details-chip"><i class="fas fa-database"></i>${escapeHtml(fileDetails.type || 'Không xác định')}</span>
                    <span class="${shareChipClass}"><i class="fas ${shareState === 'public' ? 'fa-lock-open' : 'fa-lock'}"></i>${shareState === 'public' ? 'Đang công khai' : 'Đang riêng tư'}</span>
                    <span class="details-chip"><i class="fas fa-code-branch"></i>Phiên bản ${escapeHtml(String(fileDetails.version || '1.0'))}</span>
                </div>
            </div>
        </div>
    `;

    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'file-details-grid';
    detailsGrid.innerHTML = `
        <div class="details-card">
            <span class="label">Dung lượng</span>
            <span class="value">${escapeHtml(formattedSize)}</span>
        </div>
        <div class="details-card">
            <span class="label">Tải lên</span>
            <span class="value">${escapeHtml(uploadLabel || '—')}</span>
        </div>
        <div class="details-card">
            <span class="label">Cập nhật</span>
            <span class="value">${escapeHtml(modifiedLabel || '—')}</span>
        </div>
        <div class="details-card">
            <span class="label">Mã Hash</span>
            <span class="value">${hashHtml}</span>
        </div>
    `;

    const overview = document.createElement('div');
    overview.className = 'file-details-overview';
    overview.innerHTML = `
        <div class="file-details-section">
            <h5>Ghi chú nhanh</h5>
            <p>Bạn có thể đổi tên, cập nhật quyền chia sẻ hoặc tải xuống tệp trực tiếp từ trang này. Thông tin luôn được đồng bộ mỗi khi mở cửa sổ chi tiết.</p>
        </div>
    `;

    if (timelineItems.length) {
        const timelineWrapper = document.createElement('div');
        timelineWrapper.className = 'file-activity-timeline';
        timelineWrapper.innerHTML = timelineItems.map(item => `
            <div class="timeline-item">
                <div class="timeline-icon"><i class="fas ${item.icon}"></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">${escapeHtml(item.title)}</div>
                    <div class="timeline-subtitle">${escapeHtml(item.subtitle)}</div>
                </div>
            </div>
        `).join('');

        overview.appendChild(timelineWrapper);
    }

    container.appendChild(detailsGrid);
    container.appendChild(overview);

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
    allFiles = Array.isArray(files) ? files.map(applyShareOverrideToFile) : [];
    applyFiltersAndRender();
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
                const typeLabelRaw = mimeTypeRaw || (file.extension ? file.extension.replace('.', '').toUpperCase() : 'Không xác định');
                const sizeLabel = formatReadableFileSize(file.size);
                const dateValue = getDisplayDateValue(file);
                const dateLabel = formatRelativeDate(dateValue);
                const dateTitle = formatAbsoluteDateTime(dateValue);

                const displayNameHtml = escapeHtml(displayNameRaw);
                const fileIdAttr = escapeHtml(fileIdRaw);
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

                return `
                <div class="file-item" data-file-id="${fileIdAttr}" data-file-name="${displayNameHtml}" data-share-state="${shareState}">
                    <div class="file-icon-wrapper ${file.isImage ? 'image-preview' : ''}" ${previewBackground}>
                        ${!file.isImage ? `<i class="fas ${getFileIconClass(file)}"></i>` : ''}
                    </div>
                    <div class="file-details">
                        <div class="file-name" title="${displayNameHtml}">${displayNameHtml}</div>
                        <div class="file-meta">
                            <span class="file-size">${sizeLabelHtml}</span>
                            <span class="file-date" title="${dateTitleHtml}">${dateLabelHtml}</span>
                            <span class="file-type">${typeLabelHtml}</span>
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
                        <button class="action-btn lan-share-btn" title="Gửi qua Share">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        <button class="action-btn share-toggle-btn" title="${shareState === 'public' ? 'Đang công khai' : 'Đang riêng tư'}" data-share-state="${shareState}">
                            <i class="fas ${shareState === 'public' ? 'fa-lock-open' : 'fa-lock'}"></i>
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
function getFileIconClass(file) {
    if (file.isImage) return 'fa-file-image';
    if (file.isVideo) return 'fa-file-video';
    if (file.isAudio) return 'fa-file-audio';
    if (file.isDocument) return 'fa-file-pdf';
    
    const ext = file.extension;
    if (['.doc', '.docx'].includes(ext)) return 'fa-file-word';
    if (['.xls', '.xlsx'].includes(ext)) return 'fa-file-excel';
    if (['.ppt', '.pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['.zip', '.rar', '.7z'].includes(ext)) return 'fa-file-archive';
    if (['.txt', '.log'].includes(ext)) return 'fa-file-alt';
    if (['.js', '.html', '.css', '.json'].includes(ext)) return 'fa-file-code';
    
    return 'fa-file';
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
        if (btn.classList.contains('share-toggle-btn') || btn.classList.contains('lan-share-btn')) {
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

    const shareToggleButtons = document.querySelectorAll('.share-toggle-btn');
    shareToggleButtons.forEach(button => {
        const state = button.getAttribute('data-share-state') || 'private';
        updateShareToggleVisuals(button, state);

        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const newState = toggleShareStatus(button);
            const fileItem = button.closest('.file-item');
            if (fileItem) {
                fileItem.setAttribute('data-share-state', newState);
                const fileId = fileItem.getAttribute('data-file-id');
                persistShareOverride(fileId, newState);
                updateFileInsights(allFiles);

                if (window.toastSystem) {
                    const fileName = fileItem.getAttribute('data-file-name');
                    const stateLabel = newState === 'public' ? 'công khai' : 'riêng tư';
                    window.toastSystem.success(`Đã chuyển "${fileName}" sang chế độ ${stateLabel}`, {
                        duration: 2500
                    });
                }
            }
        });
    });

    const lanShareButtons = document.querySelectorAll('.lan-share-btn');
    lanShareButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const fileItem = this.closest('.file-item');
            if (!fileItem) {
                openShareTabForFile(null);
                return;
            }

            const fileId = fileItem.getAttribute('data-file-id');
            const fileName = fileItem.getAttribute('data-file-name') || 'tệp đã chọn';

            openShareTabForFile(fileId, fileName);
        });
    });
}

function toggleShareStatus(button) {
    const currentState = button.getAttribute('data-share-state') === 'public' ? 'public' : 'private';
    const newState = currentState === 'public' ? 'private' : 'public';
    button.setAttribute('data-share-state', newState);
    updateShareToggleVisuals(button, newState);
    return newState;
}

function updateShareToggleVisuals(button, state) {
    const icon = button.querySelector('i');
    if (icon) {
        icon.className = `fas ${state === 'public' ? 'fa-lock-open' : 'fa-lock'}`;
    }

    button.title = state === 'public' ? 'Đang công khai' : 'Đang riêng tư';
    if (state === 'public') {
        button.classList.add('is-public');
    } else {
        button.classList.remove('is-public');
    }
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
        title: 'Xác nhận xóa tệp',
        message: `Bạn có chắc muốn xóa "${fileName}"? Hành động này không thể hoàn tác.`,
        confirmText: 'Xóa',
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
            window.toastSystem.success(`Đã xóa ${fileName}`);
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
        const shareUrl = `${window.location.origin}/api/download/${encodeURIComponent(normalizedId)}`;

        window.modalSystem.createModal({
            title: 'Chi tiết tệp',
            content: modalContent,
            buttons: [
                {
                    text: 'Sao chép liên kết',
                    className: 'btn-secondary',
                    onclick: () => {
                        copyToClipboard(shareUrl);
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

// Preview file - Enhanced version with PDF.js support
window.previewFile = function(fileId, fileName, fileType) {
    console.log('Preview file called:', fileId, fileName, fileType);

    const ext = fileName.toLowerCase().split('.').pop();

    // Use PDF.js preview system for supported documents
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        if (window.pdfPreviewSystem) {
            window.pdfPreviewSystem.openPreview(fileId, fileName, fileType);
        } else {
            console.error('PDF Preview System not initialized');
            // Fallback to basic preview
            createBasicPreviewModal(fileId, fileName, fileType);
        }
    } else {
        // Use basic preview for other file types (images, videos, text, etc.)
        createBasicPreviewModal(fileId, fileName, fileType);
    }
};

// Create basic preview modal for non-office files
function createBasicPreviewModal(fileId, fileName, fileType) {
    const ext = fileName.toLowerCase().split('.').pop();
    const previewUrl = `/api/preview/${fileId}`;
    
    // Remove existing modal
    const existingModal = document.getElementById('basic-preview-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'basic-preview-modal';
    modal.className = 'modal-overlay';
    
    let previewContent = '';
    
    // Handle different file types
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
        previewContent = `<img src="${previewUrl}" alt="${fileName}" class="preview-image">`;
    } else if (['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(ext)) {
        previewContent = `
            <video controls class="preview-video">
                <source src="${previewUrl}" type="${fileType}">
                Trình duyệt không hỗ trợ video.
            </video>
        `;
    } else if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
        previewContent = `
            <div class="audio-preview">
                <div class="audio-icon">
                    <i class="fas fa-music"></i>
                </div>
                <h4>${fileName}</h4>
                <audio controls class="preview-audio">
                    <source src="${previewUrl}" type="${fileType}">
                    Trình duyệt không hỗ trợ audio.
                </audio>
            </div>
        `;
    } else if (['txt', 'js', 'css', 'html', 'json', 'xml', 'csv', 'log', 'md'].includes(ext)) {
        previewContent = `
            <div class="text-preview">
                <div class="text-header">
                    <i class="fas fa-file-code"></i>
                    <h4>${fileName}</h4>
                </div>
                <div class="text-content" id="text-content-${fileId}">
                    <div class="loading-text">Đang tải nội dung...</div>
                </div>
            </div>
        `;
        // Load text content after modal is created
        setTimeout(() => loadTextContent(fileId, previewUrl), 100);
    } else {
        previewContent = `
            <div class="file-info-preview">
                <div class="file-icon-large">
                    <i class="fas fa-file"></i>
                </div>
                <div class="file-details-preview">
                    <h4>${fileName}</h4>
                    <p>Loại: ${fileType || ext.toUpperCase()}</p>
                    <p>Tải xuống để xem nội dung file này</p>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${fileName}</h3>
                <button class="modal-close" onclick="closeBasicPreviewModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${previewContent}
            </div>
            <div class="modal-footer">
                <button class="btn-download" onclick="downloadFile('${fileId}', '${fileName}')">
                    <i class="fas fa-download"></i>
                    Tải xuống
                </button>
                <button class="btn-close" onclick="closeBasicPreviewModal()">
                    Đóng
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeBasicPreviewModal();
        }
    });
}

// Close basic preview modal
window.closeBasicPreviewModal = function() {
    const modal = document.getElementById('basic-preview-modal');
    if (modal) {
        modal.remove();
    }
};

// Get preview content based on file type - Enhanced version
function getPreviewContent(fileId, fileName, fileType, fileInfo) {
    const previewUrl = `/api/preview/${fileId}`;
    
    if (fileInfo.isImage) {
        return `<img src="${previewUrl}" alt="${fileName}" class="preview-image">`;
    } 
    else if (fileInfo.isVideo) {
        return `
            <video controls class="preview-video">
                <source src="${previewUrl}" type="${fileType}">
                Trình duyệt không hỗ trợ video.
            </video>
        `;
    } 
    else if (fileInfo.isAudio) {
        return `
            <div class="audio-preview">
                <div class="audio-icon">
                    <i class="fas fa-music"></i>
                </div>
                <h4>${fileName}</h4>
                <audio controls class="preview-audio">
                    <source src="${previewUrl}" type="${fileType}">
                    Trình duyệt không hỗ trợ audio.
                </audio>
            </div>
        `;
    }
    // PDF Preview
    else if (fileInfo.isPdf) {
        return `
            <div class="pdf-preview">
                <div class="pdf-header">
                    <i class="fas fa-file-pdf"></i>
                    <h4>${fileName}</h4>
                </div>
                <iframe src="${previewUrl}" class="preview-pdf" frameborder="0">
                    <p>Trình duyệt không hỗ trợ hiển thị PDF. 
                    <a href="${previewUrl}" target="_blank">Mở trong tab mới</a></p>
                </iframe>
            </div>
        `;
    }
    // Text files
    else if (fileInfo.isText) {
        // Load text content after modal is created
        setTimeout(() => loadTextContent(fileId, previewUrl), 100);
        
        return `
            <div class="text-preview">
                <div class="text-header">
                    <i class="fas fa-file-code"></i>
                    <h4>${fileName}</h4>
                </div>
                <div class="text-content" id="text-content-${fileId}">
                    <div class="loading-text">Đang tải nội dung...</div>
                </div>
            </div>
        `;
    }
    // Office documents
    else if (fileInfo.isOffice) {
        const officeIcon = getOfficeIcon(fileInfo.extension);
        return `
            <div class="office-preview">
                <div class="office-header">
                    <i class="fas ${officeIcon}"></i>
                    <h4>${fileName}</h4>
                </div>
                <div class="office-info">
                    <p>Tài liệu Microsoft Office</p>
                    <p>Sử dụng PDF.js Preview để xem trước tài liệu này.</p>
                </div>
                <div class="office-actions">
                    <button class="btn-office-online" onclick="window.pdfPreviewSystem.openPreview('${fileId}', '${fileName}', '${fileType}')">
                        <i class="fas fa-eye"></i>
                        Xem trước với PDF.js
                    </button>
                </div>
            </div>
        `;
    }
    // Archive files
    else if (fileInfo.isArchive) {
        return `
            <div class="archive-preview">
                <div class="archive-header">
                    <i class="fas fa-file-archive"></i>
                    <h4>${fileName}</h4>
                </div>
                <div class="archive-info">
                    <p>File nén</p>
                    <p>Tải xuống để giải nén và xem nội dung.</p>
                </div>
            </div>
        `;
    }
    // Other files
    else {
        const icon = getFileTypeIcon(fileInfo.extension);
        return `
            <div class="file-info-preview">
                <div class="file-icon-large">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="file-details-preview">
                    <h4>${fileName}</h4>
                    <p>Loại: ${fileType || fileInfo.extension.toUpperCase()}</p>
                    <p>Tải xuống để xem nội dung file này</p>
                </div>
            </div>
        `;
    }
}

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
    const iconMap = {
        // Documents
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        
        // Code files
        'js': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'php': 'fa-file-code',
        'py': 'fa-file-code',
        'java': 'fa-file-code',
        'cpp': 'fa-file-code',
        'c': 'fa-file-code',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
        
        // Text files
        'txt': 'fa-file-alt',
        'md': 'fa-file-alt',
        'log': 'fa-file-alt',
        'csv': 'fa-file-csv',
        
        // Media files
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'svg': 'fa-file-image',
        'mp3': 'fa-file-audio',
        'wav': 'fa-file-audio',
        'mp4': 'fa-file-video',
        'avi': 'fa-file-video',
        'mov': 'fa-file-video',
        
        // Archive files
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        'tar': 'fa-file-archive',
        'gz': 'fa-file-archive'
    };
    
    return iconMap[fileExt] || 'fa-file';
}

// Load text content for preview
function loadTextContent(fileId, previewUrl) {
    console.log('Loading text content for:', fileId);
    
    fetch(previewUrl)
        .then(response => {
            console.log('Text fetch response:', response.status);
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(text => {
            console.log('Text loaded, length:', text.length);
            const container = document.getElementById('text-content-' + fileId);
            if (container && text.length < 100000) { // Limit to 100KB for performance
                container.innerHTML = 
                    '<pre><code>' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
            } else if (container) {
                container.innerHTML = 
                    '<div class="error-text">File quá lớn để hiển thị. Vui lòng tải xuống để xem.</div>';
            }
        })
        .catch(error => {
            console.error('Error loading text content:', error);
            const container = document.getElementById('text-content-' + fileId);
            if (container) {
                container.innerHTML = 
                    '<div class="error-text">Không thể tải nội dung file</div>';
            }
        });
}

// Open file with PDF.js preview system
window.openFilePreview = function(fileId, fileName, fileType) {
    if (window.pdfPreviewSystem) {
        window.pdfPreviewSystem.openPreview(fileId, fileName, fileType);
    } else {
        console.error('PDF Preview System not available');
        if (window.toastSystem) {
            window.toastSystem.error('Hệ thống xem trước chưa sẵn sàng', {
                duration: 3000
            });
        }
    }
};

// Close preview modal
window.closePreviewModal = function() {
    const modal = document.getElementById('file-preview-modal');
    if (modal) {
        modal.remove();
    }
};

// Cleanup when navigating away from the page
window.cleanupMyFiles = function() {
    if (myFilesAutoRefreshIntervalId) {
        clearInterval(myFilesAutoRefreshIntervalId);
        myFilesAutoRefreshIntervalId = null;
    }
};

// Auto-initialize if page is already loaded
document.addEventListener('DOMContentLoaded', function() {
    const myFilesPage = document.getElementById('myfiles-page');
    if (myFilesPage && myFilesPage.classList.contains('active')) {
        window.initMyFiles();
    }
});