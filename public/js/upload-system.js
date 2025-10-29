// Unified Upload System - Combines enhanced UI with robust conflict resolution
class UnifiedUploadSystem {
    constructor() {
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.maxConcurrentUploads = 3;
        this.chunkSize = 1024 * 1024; // 1MB chunks
        this.retryAttempts = 3;
        this.supportedFormats = {
            images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
            documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'],
            archives: ['zip', 'rar', '7z', 'tar', 'gz'],
            audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'],
            code: ['js', 'css', 'html', 'json', 'xml', 'py', 'java', 'cpp', 'c']
        };

        // Conflict resolution preferences
        this.conflictPreferences = {
            defaultAction: 'ask', // 'ask', 'auto_rename', 'replace', 'skip'
            autoBackup: true,
            showDetailedInfo: true,
            batchMode: true
        };

        this.loadConflictPreferences();
    }

    // Initialize upload UI
    initializeUploadUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Upload container not found:', containerId);
            return;
        }

        container.innerHTML = this.createUploadHTML();
        this.setupEventListeners(container);
        this.setupDragAndDrop(container);
    }

    // Create modern upload HTML
    createUploadHTML() {
        return `
            <div class="unified-upload-container">
                <div class="upload-header">
                    <h2><i class="fas fa-cloud-upload-alt"></i> Tải lên tệp</h2>
                    <div class="upload-stats">
                        <span class="stat-item">
                            <i class="fas fa-file"></i>
                            <span id="total-files">0</span> tệp
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-hdd"></i>
                            <span id="total-size">0 MB</span>
                        </span>
                    </div>
                </div>

                <div class="upload-drop-zone" id="dropZone">
                    <div class="drop-zone-content">
                        <i class="fas fa-cloud-upload-alt drop-icon"></i>
                        <h3>Kéo thả tệp vào đây</h3>
                        <p>hoặc <button class="btn-link" id="browseBtn">chọn tệp từ máy tính</button></p>
                        <div class="supported-formats">
                            <small>Hỗ trợ: Hình ảnh, Tài liệu, Video, Audio, Archives (Tối đa 2GB/tệp)</small>
                        </div>
                    </div>
                    <input type="file" id="fileInput" multiple accept="*/*" style="display: none;">
                </div>

                <div class="upload-queue" id="uploadQueue" style="display: none;">
                    <div class="queue-header">
                        <h3>Hàng đợi tải lên</h3>
                        <div class="queue-actions">
                            <button class="btn btn-sm btn-success" id="startAllBtn">
                                <i class="fas fa-play"></i> Bắt đầu tất cả
                            </button>
                            <button class="btn btn-sm btn-warning" id="pauseAllBtn">
                                <i class="fas fa-pause"></i> Tạm dừng
                            </button>
                            <button class="btn btn-sm btn-danger" id="clearAllBtn">
                                <i class="fas fa-trash"></i> Xóa tất cả
                            </button>
                        </div>
                    </div>
                    <div class="queue-list" id="queueList"></div>
                </div>

                <div class="upload-summary" id="uploadSummary" style="display: none;">
                    <div class="summary-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="overallProgress"></div>
                        </div>
                        <span class="progress-text" id="overallProgressText">0%</span>
                    </div>
                    <div class="summary-stats">
                        <span>Đã tải: <strong id="uploadedCount">0</strong></span>
                        <span>Thất bại: <strong id="failedCount">0</strong></span>
                        <span>Tốc độ: <strong id="uploadSpeed">0 MB/s</strong></span>
                    </div>
                </div>
            </div>
        `;
    }

    // Setup event listeners
    setupEventListeners(container) {
        const fileInput = container.querySelector('#fileInput');
        const browseBtn = container.querySelector('#browseBtn');
        const startAllBtn = container.querySelector('#startAllBtn');
        const pauseAllBtn = container.querySelector('#pauseAllBtn');
        const clearAllBtn = container.querySelector('#clearAllBtn');

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(Array.from(e.target.files));
            e.target.value = '';
        });

        browseBtn.addEventListener('click', () => fileInput.click());
        startAllBtn.addEventListener('click', () => this.startAllUploads());
        pauseAllBtn.addEventListener('click', () => this.pauseAllUploads());
        clearAllBtn.addEventListener('click', () => this.clearAllUploads());
    }

    // Setup drag and drop
    setupDragAndDrop(container) {
        const dropZone = container.querySelector('#dropZone');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });
    }

    // Handle file selection with validation
    handleFileSelection(files) {
        if (files.length === 0) return;

        const validFiles = [];
        const errors = [];

        files.forEach(file => {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push({ file: file.name, error: validation.error });
            }
        });

        if (errors.length > 0) {
            this.showValidationErrors(errors);
        }

        if (validFiles.length > 0) {
            this.addFilesToQueue(validFiles);
        }
    }

    // Validate file
    validateFile(file) {
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        
        if (file.size > maxSize) {
            return { valid: false, error: 'Tệp quá lớn (tối đa 2GB)' };
        }

        if (file.name.length > 255) {
            return { valid: false, error: 'Tên tệp quá dài (tối đa 255 ký tự)' };
        }

        if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
            return { valid: false, error: 'Tên tệp chứa ký tự không hợp lệ' };
        }

        return { valid: true };
    }

    // Add files to queue
    addFilesToQueue(files) {
        files.forEach(file => {
            const uploadItem = {
                id: this.generateId(),
                file: file,
                status: 'pending',
                progress: 0,
                speed: 0,
                error: null,
                retryCount: 0,
                startTime: null,
                thumbnail: null
            };

            this.uploadQueue.push(uploadItem);
            this.generateThumbnail(uploadItem);
        });

        this.updateQueueUI();
        this.updateStats();
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Generate thumbnail for images
    async generateThumbnail(uploadItem) {
        if (!uploadItem.file.type.startsWith('image/')) return;

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                const maxSize = 100;
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                uploadItem.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                this.updateQueueItemUI(uploadItem);
            };
            
            img.src = URL.createObjectURL(uploadItem.file);
        } catch (error) {
            console.warn('Could not generate thumbnail:', error);
        }
    }

    // Check if file exists on server
    async checkFileExists(filename) {
        try {
            const response = await fetch('/api/files/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            if (!response.ok) return false;
            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('Error checking file existence:', error);
            return false;
        }
    }

    // Generate suggested filenames for duplicates
    generateSuggestedName(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
        
        const suggestions = [];
        for (let i = 1; i <= 5; i++) {
            suggestions.push(`${nameWithoutExt}(${i})${extension}`);
        }
        
        return suggestions;
    }

    // Comprehensive conflict resolution modal with detailed file comparison
    async handleDuplicateFile(file, conflictInfo = null) {
        // Get detailed conflict information if not provided
        if (!conflictInfo) {
            conflictInfo = await this.getConflictInfo(file.name, file.size, file.type);
        }

        // Get detailed existing file information
        const existingFileDetails = await this.getExistingFileDetails(file.name);
        const suggestions = conflictInfo.suggestions || this.generateSuggestedName(file.name);

        const fileForExistingIcon = conflictInfo.existingFile || existingFileDetails || file;
        const existingIconDescriptor = this.getFileIconDescriptor(fileForExistingIcon);
        const newIconDescriptor = this.getFileIconDescriptor(file);
        const existingIconMarkup = this.buildFileIconMarkup(existingIconDescriptor, {
            tag: 'div',
            size: 'xl',
            extraClasses: 'file-icon-large'
        });
        const newIconMarkup = this.buildFileIconMarkup(newIconDescriptor, {
            tag: 'div',
            size: 'xl',
            extraClasses: 'file-icon-large'
        });

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="comprehensive-conflict-modal">
                <div class="conflict-header">
                    <div class="conflict-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="conflict-title">
                        <h3>File Name Conflict Detected</h3>
                        <p>A file with the name "<strong>${file.name}</strong>" already exists</p>
                    </div>
                </div>

                <div class="file-comparison-section">
                    <div class="file-comparison-grid">
                        <div class="existing-file-panel">
                            <h4><i class="fas fa-file-alt"></i> Existing File</h4>
                            <div class="file-preview">
                                ${existingFileDetails && existingFileDetails.thumbnail ?
                                    `<img src="${existingFileDetails.thumbnail}" alt="Existing file preview" class="file-thumbnail-large">` :
                                    `${existingIconMarkup}`
                                }
                            </div>
                            <div class="file-details">
                                <div class="detail-row">
                                    <span class="label">Name:</span>
                                    <span class="value">${conflictInfo.existingFile?.displayName || file.name}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Size:</span>
                                    <span class="value">${conflictInfo.existingFile?.formattedSize || 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Type:</span>
                                    <span class="value">${conflictInfo.existingFile?.mimeType || 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Uploaded:</span>
                                    <span class="value">${conflictInfo.existingFile?.uploadDate ?
                                        new Date(conflictInfo.existingFile.uploadDate).toLocaleString('vi-VN') : 'Unknown'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Version:</span>
                                    <span class="value">${conflictInfo.existingFile?.version || 1}</span>
                                </div>
                            </div>
                        </div>

                        <div class="comparison-arrow">
                            <i class="fas fa-exchange-alt"></i>
                        </div>

                        <div class="new-file-panel">
                            <h4><i class="fas fa-file-upload"></i> New File</h4>
                            <div class="file-preview">
                                ${file.type.startsWith('image/') ?
                                    `<div class="file-thumbnail-large" id="new-file-preview">
                                        <div class="loading-thumbnail">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>Loading preview...</span>
                                        </div>
                                    </div>` :
                                    `${newIconMarkup}`
                                }
                            </div>
                            <div class="file-details">
                                <div class="detail-row">
                                    <span class="label">Name:</span>
                                    <span class="value">${file.name}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Size:</span>
                                    <span class="value">${this.formatFileSize(file.size)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Type:</span>
                                    <span class="value">${file.type}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Modified:</span>
                                    <span class="value">${new Date(file.lastModified).toLocaleString('vi-VN')}</span>
                                </div>
                                <div class="detail-row size-comparison">
                                    <span class="label">Size Difference:</span>
                                    <span class="value ${this.getSizeDifferenceClass(file.size, conflictInfo.existingFile?.size)}">
                                        ${this.formatSizeDifference(file.size, conflictInfo.existingFile?.size)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                ${conflictInfo.recommendations && conflictInfo.recommendations.length > 0 ? `
                <div class="recommendations-section">
                    <h4><i class="fas fa-lightbulb"></i> Smart Recommendations</h4>
                    <div class="recommendations-list">
                        ${conflictInfo.recommendations.map(rec => `
                            <div class="recommendation-item ${rec.confidence}">
                                <div class="rec-action">
                                    <i class="fas ${this.getRecommendationIcon(rec.action)}"></i>
                                    <strong>${this.getActionDisplayName(rec.action)}</strong>
                                </div>
                                <div class="rec-reason">${rec.reason}</div>
                                <div class="rec-confidence">
                                    <span class="confidence-badge ${rec.confidence}">${rec.confidence} confidence</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="resolution-options-section">
                    <h4><i class="fas fa-cogs"></i> Choose Resolution Strategy</h4>

                    <div class="resolution-options-grid">
                        <div class="resolution-option ${conflictInfo.existingFile?.canBackup ? '' : 'disabled'}">
                            <input type="radio" id="action-replace" name="conflict-action" value="replace"
                                   ${conflictInfo.existingFile?.canBackup ? '' : 'disabled'}>
                            <label for="action-replace" class="resolution-card">
                                <div class="card-icon replace">
                                    <i class="fas fa-sync-alt"></i>
                                </div>
                                <div class="card-content">
                                    <h5>Overwrite Existing File</h5>
                                    <p>Replace the existing file with the new upload</p>
                                    <div class="card-features">
                                        <span class="feature"><i class="fas fa-shield-alt"></i> Automatic backup created</span>
                                        <span class="feature"><i class="fas fa-undo"></i> Can be undone</span>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div class="resolution-option">
                            <input type="radio" id="action-auto-rename" name="conflict-action" value="auto_rename" checked>
                            <label for="action-auto-rename" class="resolution-card">
                                <div class="card-icon auto-rename">
                                    <i class="fas fa-magic"></i>
                                </div>
                                <div class="card-content">
                                    <h5>Auto-Generate Unique Name</h5>
                                    <p>Automatically create a unique filename</p>
                                    <div class="card-features">
                                        <span class="feature"><i class="fas fa-check"></i> Safe - keeps both files</span>
                                        <span class="feature"><i class="fas fa-robot"></i> Smart numbering system</span>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div class="resolution-option">
                            <input type="radio" id="action-rename" name="conflict-action" value="rename">
                            <label for="action-rename" class="resolution-card">
                                <div class="card-icon manual-rename">
                                    <i class="fas fa-edit"></i>
                                </div>
                                <div class="card-content">
                                    <h5>Choose Custom Name</h5>
                                    <p>Manually specify a new filename</p>
                                    <div class="card-features">
                                        <span class="feature"><i class="fas fa-user"></i> Full control</span>
                                        <span class="feature"><i class="fas fa-spell-check"></i> Real-time validation</span>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div class="resolution-option">
                            <input type="radio" id="action-skip" name="conflict-action" value="skip">
                            <label for="action-skip" class="resolution-card">
                                <div class="card-icon skip">
                                    <i class="fas fa-times"></i>
                                </div>
                                <div class="card-content">
                                    <h5>Skip This File</h5>
                                    <p>Don't upload this file</p>
                                    <div class="card-features">
                                        <span class="feature"><i class="fas fa-ban"></i> No changes made</span>
                                        <span class="feature"><i class="fas fa-fast-forward"></i> Continue with others</span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="manual-rename-section" id="manual-rename-section" style="display: none;">
                    <div class="rename-input-section">
                        <h5><i class="fas fa-keyboard"></i> Enter Custom Filename</h5>

                        <div class="suggestions-section">
                            <label>Quick suggestions:</label>
                            <div class="suggestions-grid">
                                ${suggestions.map(name => `
                                    <button type="button" class="suggestion-btn" onclick="selectSuggestion('${name.replace(/'/g, "\\'")}')">
                                        ${name}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="custom-input-section">
                            <label for="custom-filename">Or enter custom name:</label>
                            <div class="input-with-validation">
                                <input type="text" id="custom-filename" class="filename-input"
                                       placeholder="Enter new filename" value="${file.name}" />
                                <div class="filename-validation" id="filename-validation">
                                    <i class="fas fa-info-circle"></i>
                                    <span>Enter a unique filename</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Generate preview for new image file
        if (file.type.startsWith('image/')) {
            this.generateNewFilePreview(file, content);
        }

        window.selectSuggestion = (suggestedName) => {
            const input = document.getElementById('custom-filename');
            if (input) {
                input.value = suggestedName;
                input.dispatchEvent(new Event('input'));
            }
        };

        return new Promise((resolve) => {
            const modal = window.modalSystem.createModal({
                title: 'Resolve File Name Conflict',
                content: content,
                size: 'large',
                className: 'conflict-resolution-modal',
                buttons: [
                    {
                        text: 'Cancel',
                        className: 'btn-secondary',
                        onclick: () => {
                            window.modalSystem.closeModal();
                            resolve(null);
                        }
                    },
                    {
                        text: 'Apply Resolution',
                        className: 'btn-primary',
                        onclick: async () => {
                            const selectedAction = modal.querySelector('input[name="conflict-action"]:checked').value;
                            let result = { action: selectedAction };

                            if (selectedAction === 'rename') {
                                const input = document.getElementById('custom-filename');
                                const newName = input.value.trim();

                                if (!newName) {
                                    this.showToast('Please enter a filename', 'error');
                                    return;
                                }

                                if (!(await this.validateNewFilename(newName))) {
                                    return;
                                }

                                result.newName = newName;
                            }

                            window.modalSystem.closeModal();
                            resolve(result);
                        }
                    }
                ]
            });

            this.setupConflictModalListeners(modal);
        });
    }

    // Get detailed conflict information with file analysis
    async getConflictInfo(filename, fileSize = null, fileType = null) {
        try {
            const response = await fetch('/api/files/check-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename,
                    fileSize,
                    fileType
                })
            });

            if (!response.ok) return { hasConflict: false };
            return await response.json();
        } catch (error) {
            console.error('Error getting conflict info:', error);
            return { hasConflict: false };
        }
    }

    // Get detailed existing file information
    async getExistingFileDetails(filename) {
        try {
            const response = await fetch('/api/files/get-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error getting existing file details:', error);
            return null;
        }
    }

    // Generate preview for new image file
    generateNewFilePreview(file, container) {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewElement = container.querySelector('#new-file-preview');
            if (previewElement) {
                previewElement.innerHTML = `<img src="${e.target.result}" alt="New file preview" class="preview-image">`;
            }
        };
        reader.readAsDataURL(file);
    }

    // Get size difference class for styling
    getSizeDifferenceClass(newSize, existingSize) {
        if (!existingSize) return '';

        const ratio = newSize / existingSize;
        if (ratio > 1.5) return 'size-larger';
        if (ratio < 0.5) return 'size-smaller';
        return 'size-similar';
    }

    // Format size difference
    formatSizeDifference(newSize, existingSize) {
        if (!existingSize) return 'N/A';

        const diff = newSize - existingSize;
        const ratio = newSize / existingSize;

        if (Math.abs(diff) < 1024) {
            return `${diff > 0 ? '+' : ''}${diff} bytes`;
        }

        const formattedDiff = this.formatFileSize(Math.abs(diff));
        const percentage = Math.round((ratio - 1) * 100);

        if (diff > 0) {
            return `+${formattedDiff} (${percentage}% larger)`;
        } else {
            return `-${formattedDiff} (${Math.abs(percentage)}% smaller)`;
        }
    }

    // Get recommendation icon
    getRecommendationIcon(action) {
        const icons = {
            'replace': 'fa-sync-alt',
            'auto_rename': 'fa-magic',
            'rename': 'fa-edit',
            'skip': 'fa-times'
        };
        return icons[action] || 'fa-question';
    }

    // Get action display name
    getActionDisplayName(action) {
        const names = {
            'replace': 'Overwrite File',
            'auto_rename': 'Auto-Rename',
            'rename': 'Manual Rename',
            'skip': 'Skip File'
        };
        return names[action] || action;
    }

    // Setup conflict modal event listeners
    setupConflictModalListeners(modal) {
        const actionRadios = modal.querySelectorAll('input[name="conflict-action"]');
        const manualRenameSection = modal.querySelector('#manual-rename-section');
        const input = modal.querySelector('#custom-filename');
        const validation = modal.querySelector('#filename-validation');

        // Handle resolution option changes
        actionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                // Update card selection visual state
                modal.querySelectorAll('.resolution-card').forEach(card => {
                    card.classList.remove('selected');
                });

                const selectedCard = modal.querySelector(`label[for="${radio.id}"]`);
                if (selectedCard) {
                    selectedCard.classList.add('selected');
                }

                // Show/hide manual rename section
                if (radio.value === 'rename') {
                    manualRenameSection.style.display = 'block';
                    setTimeout(() => input.focus(), 100);
                } else {
                    manualRenameSection.style.display = 'none';
                }
            });
        });

        // Set initial selection
        const checkedRadio = modal.querySelector('input[name="conflict-action"]:checked');
        if (checkedRadio) {
            checkedRadio.dispatchEvent(new Event('change'));
        }

        // Handle filename validation
        if (input && validation) {
            input.addEventListener('input', async () => {
                const newName = input.value.trim();
                await this.validateNewFilename(newName, validation);
            });

            // Initial validation
            setTimeout(() => {
                input.dispatchEvent(new Event('input'));
            }, 100);
        }
    }

    // Validate new filename
    async validateNewFilename(filename, validationElement = null) {
        let isValid = true;
        let message = '';

        if (!filename) {
            isValid = false;
            message = 'Tên tệp không được để trống';
        } else if (filename.length > 255) {
            isValid = false;
            message = 'Tên tệp quá dài (tối đa 255 ký tự)';
        } else if (/[<>:"/\\|?*]/.test(filename)) {
            isValid = false;
            message = 'Tên tệp chứa ký tự không hợp lệ';
        } else if (await this.checkFileExists(filename)) {
            isValid = false;
            message = 'Tên tệp này cũng đã tồn tại';
        }

        if (validationElement) {
            if (isValid) {
                validationElement.innerHTML = '<i class="fas fa-check text-success"></i> Tên tệp hợp lệ';
                validationElement.className = 'filename-validation valid';
            } else {
                validationElement.innerHTML = `<i class="fas fa-exclamation-triangle text-error"></i> ${message}`;
                validationElement.className = 'filename-validation invalid';
            }
        }

        return isValid;
    }

    // Update queue UI
    updateQueueUI() {
        const queueContainer = document.getElementById('uploadQueue');
        const queueList = document.getElementById('queueList');

        if (this.uploadQueue.length === 0) {
            queueContainer.style.display = 'none';
            return;
        }

        queueContainer.style.display = 'block';
        queueList.innerHTML = this.uploadQueue.map(item => this.createQueueItemHTML(item)).join('');
        this.setupActionButtonListeners(queueList);
    }

    // Create queue item HTML
    createQueueItemHTML(item) {
        const iconDescriptor = this.getFileIconDescriptor(item.file);
        const iconMarkup = this.buildFileIconMarkup(iconDescriptor, {
            extraClasses: 'queue-item__icon'
        });
        const statusIcon = this.getStatusIcon(item.status);
        const thumbnail = item.thumbnail ?
            `<img src="${item.thumbnail}" class="file-thumbnail" alt="thumbnail">` :
            iconMarkup;

        return `
            <div class="queue-item" data-id="${item.id}">
                <div class="item-thumbnail">${thumbnail}</div>
                <div class="item-info">
                    <div class="item-name" title="${item.file.name}">${item.file.name}</div>
                    <div class="item-details">
                        <span class="file-size">${this.formatFileSize(item.file.size)}</span>
                        <span class="file-type">${item.file.type || 'Unknown'}</span>
                    </div>
                </div>
                <div class="item-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                    <div class="progress-info">
                        <span class="progress-percent">${Math.round(item.progress)}%</span>
                        <span class="upload-speed">${item.speed > 0 ? this.formatSpeed(item.speed) : ''}</span>
                    </div>
                </div>
                <div class="item-status">
                    <i class="${statusIcon}"></i>
                    <span class="status-text">${this.getStatusText(item.status)}</span>
                </div>
                <div class="item-actions">${this.getActionButtons(item)}</div>
            </div>
        `;
    }

    // Setup action button listeners
    setupActionButtonListeners(container) {
        const buttons = container.querySelectorAll('[data-action]');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                const itemId = button.getAttribute('data-id');

                switch (action) {
                    case 'start': this.startUpload(itemId); break;
                    case 'pause': this.pauseUpload(itemId); break;
                    case 'retry': this.retryUpload(itemId); break;
                    case 'remove': this.removeFromQueue(itemId); break;
                    case 'view': this.viewFile(itemId); break;
                }
            });
        });
    }

    // Get file icon based on type
    getFileIcon(file) {
        const descriptor = this.getFileIconDescriptor(file);
        const iconClass = descriptor?.icon ? descriptor.icon : 'fa-file-lines';
        return `fas ${iconClass}`;
    }

    // Get status icon
    getStatusIcon(status) {
        const icons = {
            pending: 'fas fa-clock text-warning',
            uploading: 'fas fa-spinner fa-spin text-primary',
            completed: 'fas fa-check-circle text-success',
            failed: 'fas fa-exclamation-circle text-danger',
            paused: 'fas fa-pause-circle text-warning'
        };
        return icons[status] || 'fas fa-question-circle';
    }

    // Get status text
    getStatusText(status) {
        const texts = {
            pending: 'Chờ xử lý',
            uploading: 'Đang tải lên',
            completed: 'Hoàn thành',
            failed: 'Thất bại',
            paused: 'Tạm dừng'
        };
        return texts[status] || 'Không xác định';
    }

    // Get action buttons for queue item
    getActionButtons(item) {
        switch (item.status) {
            case 'pending':
            case 'paused':
                return `
                    <button class="btn btn-sm btn-primary" data-action="start" data-id="${item.id}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="remove" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            case 'uploading':
                return `
                    <button class="btn btn-sm btn-warning" data-action="pause" data-id="${item.id}">
                        <i class="fas fa-pause"></i>
                    </button>
                `;
            case 'failed':
                return `
                    <button class="btn btn-sm btn-primary" data-action="retry" data-id="${item.id}">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="remove" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            case 'completed':
                return `
                    <button class="btn btn-sm btn-success" data-action="view" data-id="${item.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                `;
            default:
                return '';
        }
    }

    getFileIconDescriptor(fileLike) {
        const fallbackDescriptor = {
            icon: 'fa-file-lines',
            variant: 'generic',
            tone: 'file-icon-tone--generic',
            label: 'Tệp BeamShare'
        };

        if (window.FileIcons && typeof window.FileIcons.resolve === 'function') {
            try {
                const candidate = this.normaliseFileForIcon(fileLike);
                const descriptor = window.FileIcons.resolve(candidate);
                if (descriptor && descriptor.icon) {
                    return descriptor;
                }
            } catch (error) {
                console.warn('FileIcons resolver failed', error);
            }
        }

        return fallbackDescriptor;
    }

    buildFileIconMarkup(descriptor, options = {}) {
        const settings = {
            tag: 'span',
            size: 'md',
            extraClasses: '',
            ...options
        };

        const { tag, size, extraClasses } = settings;
        const classes = ['file-icon-badge'];

        if (size === 'sm') {
            classes.push('file-icon-badge--sm');
        } else if (size === 'lg') {
            classes.push('file-icon-badge--lg');
        } else if (size === 'xl') {
            classes.push('file-icon-badge--xl');
        }

        if (extraClasses) {
            classes.push(extraClasses);
        }

        const variantAttr = descriptor?.variant ? ` data-icon-variant="${descriptor.variant}"` : '';
        const labelValue = descriptor?.label ? this.escapeHtml(descriptor.label) : '';
        const labelAttr = labelValue ? ` title="${labelValue}" aria-label="${labelValue}"` : '';
        const iconClass = descriptor?.icon ? descriptor.icon : 'fa-file-lines';
        const toneClass = descriptor?.tone ? descriptor.tone : 'file-icon-tone--generic';
        const classAttr = classes.join(' ');

        return `<${tag} class="${classAttr}"${variantAttr}${labelAttr}><i class="fas ${iconClass} ${toneClass}"></i></${tag}>`;
    }

    normaliseFileForIcon(fileLike) {
        if (!fileLike) {
            return {};
        }

        const name = fileLike.originalName || fileLike.displayName || fileLike.filename || fileLike.fileName || fileLike.name || '';
        const mimeType = fileLike.mimeType || fileLike.mime || fileLike.type || '';
        let extension = fileLike.extension || fileLike.ext || '';

        if (!extension && typeof name === 'string') {
            const lastDotIndex = name.lastIndexOf('.');
            if (lastDotIndex > -1 && lastDotIndex < name.length - 1) {
                extension = name.slice(lastDotIndex + 1);
            }
        }

        if (extension) {
            extension = String(extension).toLowerCase();
        }

        const lowerMime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

        const isImage = this.coerceMimeFlag(fileLike.isImage, lowerMime, 'image/');
        const isVideo = this.coerceMimeFlag(fileLike.isVideo, lowerMime, 'video/');
        const isAudio = this.coerceMimeFlag(fileLike.isAudio, lowerMime, 'audio/');
        const isSheet = typeof fileLike.isSheet === 'boolean' ? fileLike.isSheet : undefined;
        const isCode = typeof fileLike.isCode === 'boolean' ? fileLike.isCode : undefined;
        const isDocument = typeof fileLike.isDocument === 'boolean' ? fileLike.isDocument : undefined;

        return {
            name,
            originalName: fileLike.originalName || fileLike.displayName || fileLike.name,
            displayName: fileLike.displayName || fileLike.originalName || fileLike.name,
            extension,
            ext: extension,
            mime: lowerMime,
            mimeType: lowerMime,
            type: lowerMime,
            isImage,
            isVideo,
            isAudio,
            isSheet,
            isCode,
            isDocument
        };
    }

    coerceMimeFlag(flagValue, mimeValue, prefix) {
        if (typeof flagValue === 'boolean') {
            return flagValue;
        }

        if (typeof mimeValue === 'string' && mimeValue.startsWith(prefix)) {
            return true;
        }

        return undefined;
    }

    escapeHtml(value) {
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

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Format upload speed
    formatSpeed(bytesPerSecond) {
        return this.formatFileSize(bytesPerSecond) + '/s';
    }

    // Update statistics
    updateStats() {
        const totalFiles = this.uploadQueue.length;
        const totalSize = this.uploadQueue.reduce((sum, item) => sum + item.file.size, 0);

        document.getElementById('total-files').textContent = totalFiles;
        document.getElementById('total-size').textContent = this.formatFileSize(totalSize);
    }

    // Enhanced start all uploads with batch conflict detection
    async startAllUploads() {
        const pendingItems = this.uploadQueue.filter(item => item.status === 'pending');

        if (pendingItems.length === 0) return;

        // Check for conflicts in batch
        const conflictItems = [];
        for (const item of pendingItems) {
            const conflictInfo = await this.getConflictInfo(item.file.name);
            if (conflictInfo.hasConflict) {
                conflictItems.push({ item, conflictInfo });
            }
        }

        // Handle batch conflicts if any
        if (conflictItems.length > 0) {
            const resolutions = await this.handleBatchConflicts(conflictItems);

            if (!resolutions) {
                // User cancelled
                return;
            }

            // Apply resolutions
            conflictItems.forEach((conflictItem, index) => {
                const resolution = resolutions[index];
                if (resolution) {
                    conflictItem.item.conflictResolution = resolution;
                }
            });
        }

        // Start uploads
        for (const item of pendingItems) {
            if (this.activeUploads.size < this.maxConcurrentUploads) {
                this.startUpload(item.id);
            }
        }
    }

    // Pause all uploads
    pauseAllUploads() {
        this.activeUploads.forEach((upload, id) => {
            this.pauseUpload(id);
        });
    }

    // Clear all uploads
    clearAllUploads() {
        if (confirm('Bạn có chắc muốn xóa tất cả tệp khỏi hàng đợi?')) {
            this.activeUploads.forEach((upload, id) => {
                if (upload.xhr) {
                    upload.xhr.abort();
                }
            });
            this.activeUploads.clear();
            this.uploadQueue = [];
            this.updateQueueUI();
            this.updateStats();
        }
    }

    // Start individual upload with enhanced conflict handling
    async startUpload(itemId) {
        const item = this.uploadQueue.find(i => i.id === itemId);
        if (!item || item.status === 'uploading' || item.status === 'completed') return;

        item.status = 'uploading';
        item.startTime = Date.now();
        this.updateQueueItemUI(item);

        try {
            // Check for conflicts first
            const conflictInfo = await this.getConflictInfo(item.file.name);

            if (conflictInfo.hasConflict) {
                const resolution = await this.handleDuplicateFile(item.file, conflictInfo);

                if (!resolution) {
                    item.status = 'pending';
                    this.updateQueueItemUI(item);
                    return;
                }

                // Apply resolution
                item.conflictResolution = resolution;

                if (resolution.action === 'rename') {
                    item.customName = resolution.newName;
                } else if (resolution.action === 'skip') {
                    item.status = 'completed';
                    item.progress = 100;
                    item.skipped = true;
                    this.updateQueueItemUI(item);
                    this.processNextInQueue();
                    return;
                }
            }

            // Perform upload
            await this.performUpload(item);

        } catch (error) {
            console.error('Upload error:', error);
            item.status = 'failed';
            item.error = error.message;
            this.updateQueueItemUI(item);
        }
    }

    // Batch conflict resolution for multiple files
    async handleBatchConflicts(conflictItems) {
        if (conflictItems.length === 0) return [];

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="batch-conflict-header">
                <i class="fas fa-exclamation-triangle text-warning"></i>
                <h4>Phát hiện ${conflictItems.length} tệp trùng tên</h4>
                <p>Chọn cách xử lý cho từng tệp hoặc áp dụng cho tất cả:</p>
            </div>

            <div class="batch-actions">
                <div class="global-actions">
                    <h5>Áp dụng cho tất cả:</h5>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="applyToAll('auto_rename')">
                            <i class="fas fa-magic"></i> Tự động đổi tên tất cả
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="applyToAll('replace')">
                            <i class="fas fa-sync-alt"></i> Thay thế tất cả
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="applyToAll('skip')">
                            <i class="fas fa-times"></i> Bỏ qua tất cả
                        </button>
                    </div>
                </div>
            </div>

            <div class="conflict-list" id="conflict-list">
                ${conflictItems.map((item, index) => this.createConflictItemHTML(item, index)).join('')}
            </div>
        `;

        const resolutions = new Array(conflictItems.length).fill(null);

        window.applyToAll = (action) => {
            const selects = content.querySelectorAll('.conflict-action-select');
            selects.forEach(select => {
                select.value = action;
                select.dispatchEvent(new Event('change'));
            });
        };

        return new Promise((resolve) => {
            const modal = window.modalSystem.createModal({
                title: 'Xử lý tệp trùng tên hàng loạt',
                content: content,
                size: 'large',
                buttons: [
                    {
                        text: 'Hủy tất cả',
                        className: 'btn-secondary',
                        onclick: () => {
                            window.modalSystem.closeModal();
                            resolve(null);
                        }
                    },
                    {
                        text: 'Áp dụng',
                        className: 'btn-primary',
                        onclick: () => {
                            const results = [];
                            const selects = content.querySelectorAll('.conflict-action-select');

                            selects.forEach((select, index) => {
                                const action = select.value;
                                const result = { action };

                                if (action === 'rename') {
                                    const input = content.querySelector(`#custom-name-${index}`);
                                    result.newName = input.value.trim();
                                }

                                results.push(result);
                            });

                            window.modalSystem.closeModal();
                            resolve(results);
                        }
                    }
                ]
            });

            // Setup event listeners for each conflict item
            this.setupBatchConflictListeners(modal, conflictItems, resolutions);
        });
    }

    // Create HTML for individual conflict item in batch
    createConflictItemHTML(item, index) {
        const iconDescriptor = this.getFileIconDescriptor(item.file);
        const iconMarkup = this.buildFileIconMarkup(iconDescriptor, {
            extraClasses: 'conflict-item__icon',
            size: 'sm'
        });

        return `
            <div class="conflict-item" data-index="${index}">
                <div class="conflict-item-header">
                    <div class="file-info">
                        ${iconMarkup}
                        <span class="file-name">${item.file.name}</span>
                        <span class="file-size">(${this.formatFileSize(item.file.size)})</span>
                    </div>
                </div>

                <div class="conflict-resolution">
                    <select class="conflict-action-select" data-index="${index}">
                        <option value="auto_rename" selected>Tự động đổi tên</option>
                        <option value="replace">Thay thế</option>
                        <option value="rename">Đổi tên thủ công</option>
                        <option value="skip">Bỏ qua</option>
                    </select>

                    <div class="manual-rename" id="manual-rename-${index}" style="display: none;">
                        <input type="text" id="custom-name-${index}" class="form-control"
                               placeholder="Tên tệp mới" value="${item.file.name}">
                        <div class="validation-message" id="validation-${index}"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Setup event listeners for batch conflict resolution
    setupBatchConflictListeners(modal, conflictItems, resolutions) {
        const selects = modal.querySelectorAll('.conflict-action-select');

        selects.forEach((select, index) => {
            select.addEventListener('change', () => {
                const manualRename = modal.querySelector(`#manual-rename-${index}`);
                const input = modal.querySelector(`#custom-name-${index}`);

                if (select.value === 'rename') {
                    manualRename.style.display = 'block';
                    input.focus();
                } else {
                    manualRename.style.display = 'none';
                }
            });

            const input = modal.querySelector(`#custom-name-${index}`);
            if (input) {
                input.addEventListener('input', async () => {
                    const validation = modal.querySelector(`#validation-${index}`);
                    await this.validateNewFilename(input.value.trim(), validation);
                });
            }
        });
    }

    // Enhanced upload with conflict resolution
    async performUpload(item) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('files', item.file);

            // Add conflict resolution parameters
            if (item.customName) {
                formData.append('customName', item.customName);
            }

            if (item.conflictResolution) {
                formData.append('conflictAction', item.conflictResolution.action);
                if (item.conflictResolution.newName) {
                    formData.append('customName', item.conflictResolution.newName);
                }
            }

            // Enable auto-resolve for smoother experience
            formData.append('autoResolve', 'false'); // Let user handle conflicts

            const xhr = new XMLHttpRequest();
            this.activeUploads.set(item.id, { xhr, item });

            // Track progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    const speed = this.calculateSpeed(item, e.loaded);

                    item.progress = percent;
                    item.speed = speed;
                    this.updateQueueItemUI(item);
                    this.updateOverallProgress();
                }
            });

            xhr.addEventListener('load', () => {
                this.activeUploads.delete(item.id);

                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);

                        if (result.success) {
                            item.status = 'completed';
                            item.progress = 100;

                            // Show appropriate success message
                            const displayName = item.customName || item.file.name;
                            if (item.conflictResolution) {
                                switch (item.conflictResolution.action) {
                                    case 'replace':
                                        this.showToast(`Đã thay thế "${displayName}"`, 'success');
                                        break;
                                    case 'rename':
                                    case 'auto_rename':
                                        this.showToast(`Đã tải lên "${displayName}" với tên mới`, 'success');
                                        break;
                                    default:
                                        this.showToast(`Đã tải lên "${displayName}"`, 'success');
                                }
                            } else {
                                this.showToast(`Đã tải lên "${displayName}"`, 'success');
                            }

                            resolve(result);
                        } else if (result.conflicts && result.conflicts.length > 0) {
                            // Handle server-side conflict detection
                            item.status = 'pending';
                            item.progress = 0;
                            this.handleServerConflicts(item, result.conflicts);
                            resolve(result);
                        } else {
                            throw new Error(result.error || 'Upload failed');
                        }
                    } catch (error) {
                        item.status = 'failed';
                        item.error = error.message;
                        reject(error);
                    }
                } else {
                    item.status = 'failed';
                    item.error = `Server error: ${xhr.status}`;
                    reject(new Error(item.error));
                }

                this.updateQueueItemUI(item);
                this.processNextInQueue();
            });

            xhr.addEventListener('error', () => {
                this.activeUploads.delete(item.id);
                item.status = 'failed';
                item.error = 'Network error';
                this.updateQueueItemUI(item);
                reject(new Error(item.error));
            });

            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        });
    }

    // Handle server-side conflicts
    async handleServerConflicts(item, conflicts) {
        if (conflicts.length === 1) {
            const conflict = conflicts[0];
            const resolution = await this.handleDuplicateFile(item.file, {
                hasConflict: true,
                existingFile: conflict.existingFile,
                suggestions: conflict.suggestions
            });

            if (resolution) {
                item.conflictResolution = resolution;
                this.startUpload(item.id);
            }
        }
    }

    // Calculate upload speed
    calculateSpeed(item, loadedBytes) {
        if (!item.startTime) return 0;
        const elapsed = (Date.now() - item.startTime) / 1000;
        return elapsed > 0 ? loadedBytes / elapsed : 0;
    }

    // Update individual queue item UI
    updateQueueItemUI(item) {
        const itemElement = document.querySelector(`[data-id="${item.id}"]`);
        if (itemElement) {
            const newElement = document.createElement('div');
            newElement.innerHTML = this.createQueueItemHTML(item);
            const newItem = newElement.firstElementChild;
            this.setupActionButtonListeners(newItem);
            itemElement.replaceWith(newItem);
        }
    }

    // Update overall progress
    updateOverallProgress() {
        const totalFiles = this.uploadQueue.length;
        const completedFiles = this.uploadQueue.filter(item => item.status === 'completed').length;
        const failedFiles = this.uploadQueue.filter(item => item.status === 'failed').length;
        const overallPercent = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

        const progressBar = document.getElementById('overallProgress');
        const progressText = document.getElementById('overallProgressText');
        const uploadedCount = document.getElementById('uploadedCount');
        const failedCount = document.getElementById('failedCount');

        if (progressBar) progressBar.style.width = overallPercent + '%';
        if (progressText) progressText.textContent = Math.round(overallPercent) + '%';
        if (uploadedCount) uploadedCount.textContent = completedFiles;
        if (failedCount) failedCount.textContent = failedFiles;

        const summary = document.getElementById('uploadSummary');
        if (summary) {
            summary.style.display = totalFiles > 0 ? 'block' : 'none';
        }
    }

    // Process next item in queue
    processNextInQueue() {
        if (this.activeUploads.size >= this.maxConcurrentUploads) return;
        const nextItem = this.uploadQueue.find(item => item.status === 'pending');
        if (nextItem) {
            this.startUpload(nextItem.id);
        }
    }

    // Pause upload
    pauseUpload(itemId) {
        const upload = this.activeUploads.get(itemId);
        if (upload && upload.xhr) {
            upload.xhr.abort();
            upload.item.status = 'paused';
            this.activeUploads.delete(itemId);
            this.updateQueueItemUI(upload.item);
        }
    }

    // Retry upload
    async retryUpload(itemId) {
        const item = this.uploadQueue.find(i => i.id === itemId);
        if (item && item.retryCount < this.retryAttempts) {
            item.retryCount++;
            item.status = 'pending';
            item.progress = 0;
            item.error = null;
            this.updateQueueItemUI(item);
            await this.startUpload(itemId);
        }
    }

    // Remove from queue
    removeFromQueue(itemId) {
        const upload = this.activeUploads.get(itemId);
        if (upload && upload.xhr) {
            upload.xhr.abort();
            this.activeUploads.delete(itemId);
        }
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== itemId);
        this.updateQueueUI();
        this.updateStats();
    }

    // View uploaded file
    viewFile(itemId) {
        const item = this.uploadQueue.find(i => i.id === itemId);
        if (item && item.status === 'completed') {
            if (window.loadPage) {
                window.loadPage('myfiles');
            }
        }
    }

    // Show validation errors
    showValidationErrors(errors) {
        const errorList = errors.map(e => `• ${e.file}: ${e.error}`).join('\n');
        this.showToast(`Một số tệp không hợp lệ:\n${errorList}`, 'error');
    }

    // Show toast notification
    showToast(message, type = 'info') {
        if (window.toastSystem && window.toastSystem[type]) {
            window.toastSystem[type](message);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Simple upload API for backward compatibility
    async uploadFiles(files, progressCallback = null) {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.showToast(`Đang xử lý "${file.name}" (${i + 1}/${files.length})...`, 'info');

            const result = await this.processFileUpload(file, null, progressCallback);
            results.push(result);

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        if (successful > 0) {
            this.showToast(`Đã tải lên thành công ${successful} tệp`, 'success');
        }
        if (failed > 0) {
            this.showToast(`Lỗi tải lên ${failed} tệp`, 'error');
        }

        return results;
    }

    // Process single file upload (simple API)
    async processFileUpload(file, customName = null, progressCallback = null) {
        try {
            if (await this.checkFileExists(file.name)) {
                const newName = await this.handleDuplicateFile(file);
                if (!newName) {
                    return { success: false, cancelled: true };
                }
                customName = newName;
            }

            const formData = new FormData();
            formData.append('file', file);
            if (customName) {
                formData.append('customName', customName);
            }

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && progressCallback) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressCallback(percentComplete, file.name);
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        if (xhr.status === 200 && result.success) {
                            this.showToast(`Đã tải lên "${result.file.displayName}"`, 'success');
                            resolve({ success: true, filename: result.file.displayName, result });
                        } else {
                            throw new Error(result.error || 'Upload failed');
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Network error during upload'));
                });

                xhr.open('POST', '/api/upload');
                xhr.send(formData);
            });

        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Lỗi tải lên "${file.name}": ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Load conflict preferences from localStorage
    loadConflictPreferences() {
        try {
            const saved = localStorage.getItem('beamshare_conflict_preferences');
            if (saved) {
                this.conflictPreferences = { ...this.conflictPreferences, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Could not load conflict preferences:', error);
        }
    }

    // Save conflict preferences to localStorage
    saveConflictPreferences() {
        try {
            localStorage.setItem('beamshare_conflict_preferences', JSON.stringify(this.conflictPreferences));
        } catch (error) {
            console.warn('Could not save conflict preferences:', error);
        }
    }

    // Show conflict preferences modal
    showConflictPreferences() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="preferences-section">
                <h4>Cài đặt xử lý tệp trùng tên</h4>
                <p>Tùy chỉnh cách hệ thống xử lý khi phát hiện tệp trùng tên.</p>

                <div class="preference-group">
                    <label class="preference-label">Hành động mặc định:</label>
                    <select id="default-action" class="preference-select">
                        <option value="ask" ${this.conflictPreferences.defaultAction === 'ask' ? 'selected' : ''}>Hỏi người dùng</option>
                        <option value="auto_rename" ${this.conflictPreferences.defaultAction === 'auto_rename' ? 'selected' : ''}>Tự động đổi tên</option>
                        <option value="replace" ${this.conflictPreferences.defaultAction === 'replace' ? 'selected' : ''}>Thay thế tệp cũ</option>
                        <option value="skip" ${this.conflictPreferences.defaultAction === 'skip' ? 'selected' : ''}>Bỏ qua tệp mới</option>
                    </select>
                </div>

                <div class="preference-group">
                    <label class="preference-checkbox">
                        <input type="checkbox" id="auto-backup" ${this.conflictPreferences.autoBackup ? 'checked' : ''}>
                        <span>Tự động sao lưu khi thay thế tệp</span>
                    </label>
                </div>

                <div class="preference-group">
                    <label class="preference-checkbox">
                        <input type="checkbox" id="detailed-info" ${this.conflictPreferences.showDetailedInfo ? 'checked' : ''}>
                        <span>Hiển thị thông tin chi tiết về tệp hiện có</span>
                    </label>
                </div>

                <div class="preference-group">
                    <label class="preference-checkbox">
                        <input type="checkbox" id="batch-mode" ${this.conflictPreferences.batchMode ? 'checked' : ''}>
                        <span>Cho phép xử lý hàng loạt nhiều tệp</span>
                    </label>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            const modal = window.modalSystem.createModal({
                title: 'Cài đặt xử lý tệp trùng tên',
                content: content,
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onclick: () => {
                            window.modalSystem.closeModal();
                            resolve(false);
                        }
                    },
                    {
                        text: 'Lưu cài đặt',
                        className: 'btn-primary',
                        onclick: () => {
                            // Save preferences
                            this.conflictPreferences.defaultAction = modal.querySelector('#default-action').value;
                            this.conflictPreferences.autoBackup = modal.querySelector('#auto-backup').checked;
                            this.conflictPreferences.showDetailedInfo = modal.querySelector('#detailed-info').checked;
                            this.conflictPreferences.batchMode = modal.querySelector('#batch-mode').checked;

                            this.saveConflictPreferences();
                            this.showToast('Đã lưu cài đặt xử lý tệp trùng tên', 'success');

                            window.modalSystem.closeModal();
                            resolve(true);
                        }
                    }
                ]
            });
        });
    }

    // Apply default conflict resolution
    async applyDefaultConflictResolution(item, conflictInfo) {
        switch (this.conflictPreferences.defaultAction) {
            case 'auto_rename':
                return { action: 'auto_rename' };

            case 'replace':
                return { action: 'replace' };

            case 'skip':
                return { action: 'skip' };

            case 'ask':
            default:
                return await this.handleDuplicateFile(item.file, conflictInfo);
        }
    }
}

// Global instances
window.uploadSystem = new UnifiedUploadSystem();
window.uploadManager = window.uploadSystem; // Backward compatibility

// Enhanced drag and drop setup function
window.setupEnhancedUpload = function(uploadAreaSelector) {
    const uploadArea = document.querySelector(uploadAreaSelector);
    if (!uploadArea) return;

    const fileInput = uploadArea.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await window.uploadSystem.uploadFiles(files);
                e.target.value = '';
            }
        });
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        });
    });

    uploadArea.addEventListener('drop', async (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            await window.uploadSystem.uploadFiles(files);
        }
    });
};
