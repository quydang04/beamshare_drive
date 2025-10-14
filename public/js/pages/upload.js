// Simple Upload Page JavaScript - Working Version
window.initUpload = function() {
    console.log('=== INITIALIZING UPLOAD PAGE ===');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        setupUpload();
    }, 300);
};

window.cleanupUpload = function cleanupUpload() {
    // Currently no long-lived listeners to remove; placeholder for future use
};

function setupUpload() {
    console.log('Setting up upload functionality...');
    
    const fileInput = document.getElementById('fileInput');
    const uploadButtons = document.querySelectorAll('.btn-upload-primary');
    const dropZone = document.querySelector('.upload-drop-zone');

    const MAX_BATCH_FILES = 5;
    const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
    
    console.log('Elements found:', {
        fileInput: !!fileInput,
        uploadButtons: uploadButtons.length,
        dropZone: !!dropZone
    });
    
    if (!fileInput) {
        console.error('File input element not found!');
        return;
    }
    
    // 1. Handle file input change
    fileInput.addEventListener('change', function(e) {
        console.log('File input changed:', e.target.files.length, 'files');
        if (e.target.files.length > 0) {
            handleFiles(e.target.files, {
                maxFiles: MAX_BATCH_FILES,
                maxFileSize: MAX_FILE_SIZE_BYTES
            });
        }
    });
    
    // 2. Handle button clicks
    uploadButtons.forEach((button, index) => {
        console.log(`Adding click listener to button ${index}`);
        // Remove any existing listeners to prevent duplicates
        button.removeEventListener('click', handleUploadClick);
        button.addEventListener('click', handleUploadClick);
    });
    
    // 3. Handle drag and drop
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            console.log('Files dropped:', e.dataTransfer.files.length);
            handleFiles(e.dataTransfer.files, {
                maxFiles: MAX_BATCH_FILES,
                maxFileSize: MAX_FILE_SIZE_BYTES
            });
        });
        
        // Also allow clicking drop zone
        dropZone.addEventListener('click', function(e) {
            console.log('Drop zone clicked');
            fileInput.click();
        });
    }
    
    console.log('Upload functionality setup complete!');
}

// Handle upload button click with debounce
let lastClickTime = 0;
function handleUploadClick(e) {
    e.preventDefault();
    
    // Debounce - prevent multiple clicks within 500ms
    const now = Date.now();
    if (now - lastClickTime < 500) {
        console.log('Upload click ignored - too soon after last click');
        return;
    }
    lastClickTime = now;
    
    console.log('Upload button clicked!');
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Handle files (upload or drag/drop)
let isUploading = false;
async function handleFiles(fileList, options = {}) {
    console.log('Handling files:', fileList.length);

    if (isUploading) {
        showMessage('Hệ thống đang tải lên, vui lòng đợi hoàn tất trước khi thử lại.', 'warning');
        return;
    }

    const maxFiles = options.maxFiles || 5;
    const maxFileSize = options.maxFileSize || (2 * 1024 * 1024 * 1024);
    const files = Array.from(fileList || []);

    if (!files.length) {
        showMessage('Không có file nào được chọn!', 'error');
        return;
    }

    if (files.length > maxFiles) {
        showMessage(`Chỉ có thể tải lên tối đa ${maxFiles} file cùng lúc!`, 'error');
        return;
    }

    const oversizeFile = files.find(file => file.size > maxFileSize);
    if (oversizeFile) {
        showMessage(`File "${oversizeFile.name}" vượt quá kích thước tối đa 2GB!`, 'error');
        return;
    }

    showUploadProgress(files);

    try {
        await uploadFilesSequential(files);
    } finally {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

// Show upload progress UI
function showUploadProgress(files) {
    console.log('Showing upload progress for', files.length, 'files');
    
    const uploadMain = document.querySelector('.upload-main');
    if (!uploadMain) return;
    
    // Remove existing progress
    const existingProgress = document.querySelector('.upload-progress-container');
    if (existingProgress) {
        existingProgress.remove();
    }
    
    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress-container';
    progressContainer.innerHTML = `
        <div class="upload-progress-header">
            <h3>Đang chuẩn bị ${files.length} tệp</h3>
        </div>
        <div class="upload-progress-list">
            ${files.map((file, index) => `
                <div class="upload-progress-item" data-index="${index}" data-original-name="${escapeHtml(file.name)}">
                    <div class="file-info">
                        <i class="fas fa-file"></i>
                        <span class="file-name">${escapeHtml(file.name)}</span>
                        <span class="file-size">${formatFileSize(file.size)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">Đang chờ...</div>
                </div>
            `).join('')}
        </div>
    `;
    
    uploadMain.appendChild(progressContainer);
}

// Upload files to server sequentially with conflict handling
async function uploadFilesSequential(files) {
    console.log('Starting upload for', files.length, 'files');

    isUploading = true;
    const successfulUploads = [];
    const skippedUploads = [];

    setProgressHeaderText(`Đang xử lý ${files.length} tệp...`);

    try {
        for (let index = 0; index < files.length; index++) {
            const originalFile = files[index];
            let currentFile = originalFile;

            setProgressHeaderText(`Đang xử lý "${originalFile.name}" (${index + 1}/${files.length})`);

            updateProgressItem(index, { percent: 5, text: 'Đang kiểm tra...', state: 'active' });

            let preparation;
            try {
                preparation = await prepareFileForUpload(currentFile, index);
            } catch (prepError) {
                console.error('Preparation error:', prepError);
                markProgressError(index, prepError.message || 'Lỗi kiểm tra');
                showMessage(prepError.message || `Lỗi khi kiểm tra tệp "${originalFile.name}"`, 'error');
                continue;
            }

            if (!preparation) {
                markProgressSkipped(index, 'Đã bỏ qua');
                skippedUploads.push(originalFile.name);
                continue;
            }

            currentFile = preparation.file;
            const uploadMeta = preparation.meta || {};

            updateProgressItem(index, { percent: 35, text: 'Đang tải lên...', state: 'active' });

            try {
                const result = await uploadSingleFile(currentFile, uploadMeta);
                markProgressSuccess(index);
                successfulUploads.push(result.file || { displayName: uploadMeta.customName || currentFile.name });
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                markProgressError(index, uploadError.message || 'Lỗi tải lên');
                showMessage(uploadError.message || `Không thể tải lên "${currentFile.name}"`, 'error');
            }
        }
    } finally {
        isUploading = false;
    }

    if (successfulUploads.length) {
        setProgressHeaderText('Tải lên hoàn tất');
        showMessage(`Đã tải lên thành công ${successfulUploads.length} tệp.`, 'success');
        setTimeout(() => {
            showMessage('Chuyển đến trang quản lý file...', 'info');
            window.loadPage('myfiles');
        }, 1500);
    } else if (!skippedUploads.length) {
        setProgressHeaderText('Không có tệp nào được tải lên');
        showMessage('Không có tệp nào được tải lên thành công.', 'warning');
    } else {
        setProgressHeaderText('Quy trình tải lên đã kết thúc');
        showMessage('Một số tệp đã bị bỏ qua theo lựa chọn của bạn.', 'info');
    }
}

async function prepareFileForUpload(file, index) {
    const conflictInfo = await requestFileConflict(file.name, file.size, file.type);

    if (!conflictInfo || !conflictInfo.hasConflict) {
        return {
            file,
            meta: { customName: file.name }
        };
    }

    const decision = await showConflictResolutionModal(conflictInfo, file);

    if (!decision || decision.action === 'skip') {
        showMessage(`Đã bỏ qua "${file.name}" do trùng tên.`, 'info');
        return null;
    }

    if (decision.action === 'replace') {
        updateProgressItem(index, { percent: 15, text: 'Sẽ thay thế tệp hiện có', state: 'active' });
        return {
            file,
            meta: {
                conflictAction: 'replace',
                customName: file.name
            }
        };
    }

    if (decision.action === 'rename') {
        const renamedFile = createRenamedFile(file, decision.newName);
        updateProgressFileName(index, decision.newName, { renamed: true });
        updateProgressItem(index, { percent: 20, text: 'Tên mới đã sẵn sàng', state: 'active' });
        return {
            file: renamedFile,
            meta: {
                conflictAction: 'rename',
                customName: decision.newName
            }
        };
    }

    return {
        file,
        meta: { customName: file.name }
    };
}

async function uploadSingleFile(file, meta = {}) {
    const formData = new FormData();
    formData.append('file', file);

    if (meta.conflictAction) {
        formData.append('conflictAction', meta.conflictAction);
    }

    if (meta.customName) {
        formData.append('customName', meta.customName);
    }

    const response = await fetch('/api/upload-single', {
        method: 'POST',
        body: formData
    });

    let result = null;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error('Không thể đọc phản hồi từ máy chủ.');
    }

    if (!response.ok || !result.success) {
        throw new Error(result && (result.error || result.message) || 'Upload failed');
    }

    return result;
}

async function requestFileConflict(filename, fileSize, fileType) {
    try {
        const response = await fetch('/api/files/check-conflict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename,
                fileSize,
                fileType
            })
        });

        if (!response.ok) {
            throw new Error('Không thể kiểm tra tên tệp, vui lòng thử lại.');
        }

        return await response.json();
    } catch (error) {
        console.error('Conflict check error:', error);
        throw error;
    }
}

function createRenamedFile(file, newName) {
    try {
        return new File([file], newName, {
            type: file.type,
            lastModified: file.lastModified
        });
    } catch (error) {
        console.warn('File constructor not supported, falling back to original file name.');
        return file;
    }
}

function updateProgressItem(index, { percent, text, state }) {
    const { item, bar, textEl } = getProgressElements(index);
    if (!item) return;

    if (typeof percent === 'number' && bar) {
        const clamped = Math.max(0, Math.min(100, percent));
        bar.style.width = `${clamped}%`;
    }

    if (text && textEl) {
        textEl.textContent = text;
    }

    if (state) {
        setProgressStateClass(item, state);
    }
}

function markProgressSuccess(index) {
    updateProgressItem(index, { percent: 100, text: 'Hoàn tất', state: 'success' });
}

function markProgressError(index, message) {
    updateProgressItem(index, { percent: 0, text: message || 'Lỗi', state: 'error' });
}

function markProgressSkipped(index, message) {
    updateProgressItem(index, { percent: 0, text: message || 'Đã bỏ qua', state: 'skipped' });
}

function updateProgressFileName(index, name, options = {}) {
    const { item, fileNameEl } = getProgressElements(index);
    if (!item || !fileNameEl) return;

    fileNameEl.textContent = name;
    if (options.renamed) {
        fileNameEl.classList.add('is-renamed');
    }
}

function setProgressStateClass(item, state) {
    const states = ['is-active', 'is-success', 'is-error', 'is-skipped'];
    item.classList.remove(...states);

    switch (state) {
        case 'success':
            item.classList.add('is-success');
            break;
        case 'error':
            item.classList.add('is-error');
            break;
        case 'skipped':
            item.classList.add('is-skipped');
            break;
        case 'active':
        default:
            item.classList.add('is-active');
            break;
    }
}

function getProgressElements(index) {
    const item = document.querySelector(`.upload-progress-item[data-index="${index}"]`);
    if (!item) {
        return { item: null, bar: null, textEl: null, fileNameEl: null };
    }

    return {
        item,
        bar: item.querySelector('.progress-fill'),
        textEl: item.querySelector('.progress-text'),
        fileNameEl: item.querySelector('.file-name')
    };
}

function setProgressHeaderText(text) {
    const headerTitle = document.querySelector('.upload-progress-header h3');
    if (headerTitle) {
        headerTitle.textContent = text;
    }
}

async function showConflictResolutionModal(conflictInfo, incomingFile) {
    const modalSystem = window.modalSystem;

    if (!modalSystem) {
        const replace = window.confirm(
            `Tệp "${incomingFile.name}" đã tồn tại.\nChọn OK để thay thế, Cancel để hủy bỏ.`
        );

        if (replace) {
            return { action: 'replace' };
        }

        const newName = window.prompt('Nhập tên mới cho tệp (hoặc để trống để bỏ qua):', incomingFile.name);
        if (newName && newName.trim() && newName.trim() !== incomingFile.name) {
            return { action: 'rename', newName: ensureExtension(newName.trim(), splitFilename(incomingFile.name).extension) };
        }

        return { action: 'skip' };
    }

    return new Promise((resolve) => {
    const existingFile = conflictInfo.existingFile || {};
    const { base, extension } = splitFilename(incomingFile.name);
    const suggestions = collectConflictSuggestions(conflictInfo, incomingFile.name);
        const existingSizeLabel = typeof existingFile.size === 'number' && existingFile.size >= 0
            ? formatFileSize(existingFile.size)
            : (existingFile.formattedSize || 'Không rõ');
        const incomingSizeLabel = formatFileSize(incomingFile.size);

        const container = document.createElement('div');
        container.className = 'conflict-dialog';
        container.innerHTML = `
            <div class="conflict-summary">
                <div class="conflict-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="conflict-details">
                    <p class="conflict-title">Tệp <strong>${escapeHtml(existingFile.displayName || incomingFile.name)}</strong> đã tồn tại trong thư mục của bạn.</p>
                    <ul class="conflict-meta">
                        <li><span>Hiện có:</span><strong>${existingSizeLabel}</strong></li>
                        <li><span>Tệp mới:</span><strong>${incomingSizeLabel}</strong></li>
                    </ul>
                </div>
            </div>
        `;

        const recommendation = document.createElement('div');
        recommendation.className = 'conflict-recommendation';
        if (conflictInfo.recommendations && conflictInfo.recommendations.action) {
            recommendation.innerHTML = `
                <span class="conflict-recommendation-label">Gợi ý hệ thống:</span>
                <strong>${translateRecommendation(conflictInfo.recommendations.action)}</strong>
            `;
        } else {
            recommendation.textContent = 'Bạn muốn xử lý tệp trùng tên như thế nào?';
        }
        container.appendChild(recommendation);

        const renameSection = document.createElement('div');
        renameSection.className = 'conflict-rename-section';
        renameSection.innerHTML = `
            <label for="conflict-rename-input" class="conflict-label">Đổi tên tệp</label>
        `;

        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.id = 'conflict-rename-input';
        renameInput.className = 'conflict-rename-input';
        renameInput.value = suggestions[0] || `${base} (1)${extension}`;
        renameInput.placeholder = 'Nhập tên mới...';
        renameInput.setAttribute('maxlength', '255');

        const errorFeedback = document.createElement('div');
        errorFeedback.className = 'conflict-error';
        errorFeedback.style.display = 'none';

        const suggestionsWrapper = document.createElement('div');
        suggestionsWrapper.className = 'conflict-suggestions';

        suggestions.forEach((suggestion) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'conflict-suggestion-chip';
            chip.textContent = suggestion;
            chip.addEventListener('click', () => {
                renameInput.value = suggestion;
                errorFeedback.style.display = 'none';
                renameInput.classList.remove('has-error');
                renameInput.focus();
                renameInput.select();
            });
            suggestionsWrapper.appendChild(chip);
        });

        renameSection.appendChild(renameInput);
        renameSection.appendChild(errorFeedback);
        renameSection.appendChild(suggestionsWrapper);
        container.appendChild(renameSection);

        const modal = modalSystem.createModal({
            title: 'Đã phát hiện tệp trùng tên',
            content: container,
            autoFocus: '#conflict-rename-input',
            buttons: [
                {
                    text: 'Bỏ qua tệp này',
                    className: 'btn-secondary',
                    onclick: () => finalize({ action: 'skip' })
                },
                {
                    text: 'Thay thế tệp hiện có',
                    className: 'btn-danger',
                    onclick: () => finalize({ action: 'replace' })
                },
                {
                    text: 'Đổi tên và tải lên',
                    className: 'btn-primary',
                    onclick: async () => {
                        const proposedName = ensureExtension(renameInput.value.trim(), extension);
                        const validation = validateFilenameCandidate(proposedName);

                        if (!validation.valid) {
                            showRenameError(validation.message);
                            return;
                        }

                        if (proposedName === existingFile.displayName) {
                            showRenameError('Tên mới phải khác với tên hiện có.');
                            return;
                        }

                        try {
                            modalSystem.setProcessing(true);
                            const check = await requestFileConflict(proposedName, incomingFile.size, incomingFile.type);
                            if (check && check.hasConflict) {
                                showRenameError('Tên này vẫn đang được sử dụng. Vui lòng chọn tên khác.');
                                modalSystem.setProcessing(false);
                                return;
                            }
                            finalize({ action: 'rename', newName: proposedName });
                        } catch (error) {
                            console.error('Rename validation failed:', error);
                            showRenameError(error.message || 'Không thể kiểm tra tên tệp.');
                            modalSystem.setProcessing(false);
                        }
                    }
                }
            ]
        });

        const originalClose = modalSystem.closeModal.bind(modalSystem);
        let resolved = false;

        function cleanup() {
            modalSystem.closeModal = originalClose;
        }

        function finalize(result) {
            if (resolved) return;
            resolved = true;
            cleanup();
            modalSystem.setProcessing(false);
            originalClose();
            resolve(result);
        }

        modalSystem.closeModal = function overrideClose() {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve({ action: 'skip' });
            }
            originalClose();
        };

        function showRenameError(message) {
            errorFeedback.textContent = message;
            errorFeedback.style.display = 'block';
            renameInput.classList.add('has-error');
            renameInput.focus();
        }

        renameInput.addEventListener('input', () => {
            errorFeedback.style.display = 'none';
            renameInput.classList.remove('has-error');
        });

        modal.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && document.activeElement === renameInput) {
                event.preventDefault();
                const primaryButton = modal.querySelector('.btn-primary');
                if (primaryButton) {
                    primaryButton.click();
                }
            }
        });
    });
}

function translateRecommendation(action) {
    switch (action) {
        case 'rename':
            return 'Nên đổi tên để giữ cả hai phiên bản';
        case 'replace':
            return 'Nên thay thế vì tệp mới có dung lượng lớn hơn';
        case 'keep':
            return 'Nên giữ nguyên tệp hiện tại';
        default:
            return 'Không có gợi ý cụ thể';
    }
}

function collectConflictSuggestions(conflictInfo, originalName) {
    const serverSuggestions = Array.isArray(conflictInfo && conflictInfo.suggestions)
        ? conflictInfo.suggestions
        : [];
    const generated = generateNameSuggestions(originalName, 6);
    const combined = new Set([...serverSuggestions, ...generated]);
    return Array.from(combined).slice(0, 6);
}

function generateNameSuggestions(originalName, limit = 4) {
    const { base, extension } = splitFilename(originalName);
    const suggestions = new Set();

    for (let i = 1; i <= limit; i++) {
        suggestions.add(`${base} (${i})${extension}`);
    }

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    suggestions.add(`${base}-${timestamp}${extension}`);

    return Array.from(suggestions).slice(0, limit);
}

function ensureExtension(name, extension) {
    if (!extension) return name;
    if (name.toLowerCase().endsWith(extension.toLowerCase())) {
        return name;
    }
    return `${name}${extension}`;
}

function splitFilename(name) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) {
        return { base: name, extension: '' };
    }
    return {
        base: name.slice(0, lastDot),
        extension: name.slice(lastDot)
    };
}

function validateFilenameCandidate(name) {
    if (!name || !name.trim()) {
        return { valid: false, message: 'Tên tệp không được để trống.' };
    }

    const trimmed = name.trim();

    if (trimmed.length > 255) {
        return { valid: false, message: 'Tên tệp quá dài (tối đa 255 ký tự).' };
    }

    if (/[\\/:*?"<>|]/.test(trimmed)) {
        return { valid: false, message: 'Tên tệp không được chứa ký tự đặc biệt: \\ / : * ? " < > |' };
    }

    return { valid: true };
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Show message to user using toast system
function showMessage(message, type = 'info') {
    console.log(`Message (${type}):`, message);

    // Use the toast system with proper method calls
    if (window.toastSystem) {
        // Use the convenience methods for better consistency
        switch(type) {
            case 'success':
                window.toastSystem.success(message);
                break;
            case 'error':
                window.toastSystem.error(message);
                break;
            case 'warning':
                window.toastSystem.warning(message);
                break;
            case 'info':
            default:
                window.toastSystem.info(message);
                break;
        }
    } else {
        // Fallback to console log
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Only show alert for errors as fallback
        if (type === 'error') {
            alert(`Lỗi: ${message}`);
        }
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global test function
window.testUpload = function() {
    console.log('Testing upload functionality...');
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        console.log('File input found, clicking...');
        fileInput.click();
    } else {
        console.error('File input not found!');
    }
};

console.log('Upload script loaded successfully');