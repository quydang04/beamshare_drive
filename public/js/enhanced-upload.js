// Enhanced Upload System with Modern UI and Advanced Features
class EnhancedUploadManager {
    constructor() {
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.maxConcurrentUploads = 3;
        this.chunkSize = 1024 * 1024; // 1MB chunks for large files
        this.retryAttempts = 3;
        this.supportedFormats = {
            images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
            documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'],
            archives: ['zip', 'rar', '7z', 'tar', 'gz'],
            audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
            video: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'],
            code: ['js', 'css', 'html', 'json', 'xml', 'py', 'java', 'cpp', 'c']
        };
    }

    // Initialize enhanced upload UI
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
            <div class="enhanced-upload-container">
                <!-- Upload Header -->
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

                <!-- Upload Drop Zone -->
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

                <!-- Upload Queue -->
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

                <!-- Upload Progress Summary -->
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

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(Array.from(e.target.files));
            e.target.value = ''; // Reset for next selection
        });

        // Browse button
        browseBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Queue control buttons
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

    // Handle file selection
    handleFileSelection(files) {
        if (files.length === 0) return;

        // Validate files
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

        // Show errors if any
        if (errors.length > 0) {
            this.showValidationErrors(errors);
        }

        // Add valid files to queue
        if (validFiles.length > 0) {
            this.addFilesToQueue(validFiles);
        }
    }

    // Validate individual file
    validateFile(file) {
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        
        // Check file size
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `Tệp quá lớn (tối đa 2GB)`
            };
        }

        // Check filename
        if (file.name.length > 255) {
            return {
                valid: false,
                error: `Tên tệp quá dài (tối đa 255 ký tự)`
            };
        }

        // Check for dangerous characters
        if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
            return {
                valid: false,
                error: `Tên tệp chứa ký tự không hợp lệ`
            };
        }

        return { valid: true };
    }

    // Add files to upload queue
    addFilesToQueue(files) {
        files.forEach(file => {
            const uploadItem = {
                id: this.generateId(),
                file: file,
                status: 'pending', // pending, uploading, completed, failed, paused
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

        // Add event listeners for action buttons
        this.setupActionButtonListeners(queueList);
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
                    case 'start':
                        this.startUpload(itemId);
                        break;
                    case 'pause':
                        this.pauseUpload(itemId);
                        break;
                    case 'retry':
                        this.retryUpload(itemId);
                        break;
                    case 'remove':
                        this.removeFromQueue(itemId);
                        break;
                    case 'view':
                        this.viewFile(itemId);
                        break;
                }
            });
        });
    }

    // Create queue item HTML
    createQueueItemHTML(item) {
        const fileIcon = this.getFileIcon(item.file);
        const statusIcon = this.getStatusIcon(item.status);
        const thumbnail = item.thumbnail ? 
            `<img src="${item.thumbnail}" class="file-thumbnail" alt="thumbnail">` : 
            `<i class="${fileIcon} file-icon"></i>`;

        return `
            <div class="queue-item" data-id="${item.id}">
                <div class="item-thumbnail">
                    ${thumbnail}
                </div>
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
                <div class="item-actions">
                    ${this.getActionButtons(item)}
                </div>
            </div>
        `;
    }

    // Get file icon based on file type
    getFileIcon(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (this.supportedFormats.images.includes(ext)) return 'fas fa-image';
        if (this.supportedFormats.documents.includes(ext)) return 'fas fa-file-alt';
        if (this.supportedFormats.archives.includes(ext)) return 'fas fa-file-archive';
        if (this.supportedFormats.audio.includes(ext)) return 'fas fa-file-audio';
        if (this.supportedFormats.video.includes(ext)) return 'fas fa-file-video';
        if (this.supportedFormats.code.includes(ext)) return 'fas fa-file-code';
        
        return 'fas fa-file';
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
        const self = this;
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

    // Start all uploads
    async startAllUploads() {
        const pendingItems = this.uploadQueue.filter(item => item.status === 'pending');
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

    // Start individual upload
    async startUpload(itemId) {
        const item = this.uploadQueue.find(i => i.id === itemId);
        if (!item || item.status === 'uploading' || item.status === 'completed') return;

        item.status = 'uploading';
        item.startTime = Date.now();
        this.updateQueueItemUI(item);

        try {
            // Check for conflicts first
            const conflictCheck = await this.checkFileConflict(item.file.name);
            if (conflictCheck.hasConflict) {
                const resolution = await this.handleConflict(item, conflictCheck);
                if (!resolution) {
                    item.status = 'pending';
                    this.updateQueueItemUI(item);
                    return;
                }
            }

            // Start upload
            await this.performUpload(item);

        } catch (error) {
            console.error('Upload error:', error);
            item.status = 'failed';
            item.error = error.message;
            this.updateQueueItemUI(item);
        }
    }

    // Check for file conflicts
    async checkFileConflict(filename) {
        try {
            const response = await fetch('/api/files/check-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            return await response.json();
        } catch (error) {
            console.warn('Could not check file conflict:', error);
            return { hasConflict: false };
        }
    }

    // Handle file conflict
    async handleConflict(item, conflictInfo) {
        return new Promise((resolve) => {
            const modal = this.createConflictModal(item, conflictInfo, resolve);
            document.body.appendChild(modal);
        });
    }

    // Create conflict resolution modal
    createConflictModal(item, conflictInfo, callback) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn btn-primary';
        replaceBtn.innerHTML = '<i class="fas fa-sync"></i> Thay thế tệp cũ';
        replaceBtn.onclick = () => {
            modal.remove();
            callback({action: 'replace'});
        };

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn btn-secondary';
        renameBtn.innerHTML = '<i class="fas fa-edit"></i> Đổi tên tệp mới';
        renameBtn.onclick = () => {
            modal.remove();
            callback({action: 'rename'});
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-danger';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Bỏ qua';
        cancelBtn.onclick = () => {
            modal.remove();
            callback(null);
        };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            modal.remove();
            callback(null);
        };

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Tệp trùng tên</h3>
                </div>
                <div class="modal-body">
                    <p>Tệp "<strong>${item.file.name}</strong>" đã tồn tại. Bạn muốn làm gì?</p>
                    <div class="conflict-options">
                    </div>
                </div>
            </div>
        `;

        // Add buttons to modal
        const header = modal.querySelector('.modal-header');
        header.appendChild(closeBtn);

        const options = modal.querySelector('.conflict-options');
        options.appendChild(replaceBtn);
        options.appendChild(renameBtn);
        options.appendChild(cancelBtn);

        return modal;
    }

    // Perform actual upload
    async performUpload(item) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('files', item.file);

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
                            this.showToast(`Đã tải lên "${item.file.name}"`, 'success');
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

    // Calculate upload speed
    calculateSpeed(item, loadedBytes) {
        if (!item.startTime) return 0;

        const elapsed = (Date.now() - item.startTime) / 1000; // seconds
        return elapsed > 0 ? loadedBytes / elapsed : 0;
    }

    // Update individual queue item UI
    updateQueueItemUI(item) {
        const itemElement = document.querySelector(`[data-id="${item.id}"]`);
        if (itemElement) {
            const newElement = document.createElement('div');
            newElement.innerHTML = this.createQueueItemHTML(item);
            const newItem = newElement.firstElementChild;

            // Setup event listeners for the new item
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

        // Show/hide summary
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
            // Navigate to My Files page
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
}

// Global instance
window.enhancedUpload = new EnhancedUploadManager();
