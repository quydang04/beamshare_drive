// My Files Page JavaScript - Compact
window.initMyFiles = function() {
    console.log('Initializing My Files page...');
    
    // Simple view toggle functionality
    const viewToggle = document.querySelector('.view-toggle');
    const filesContent = document.getElementById('files-content');
    let currentView = 'list';
    
    if (viewToggle) {
        viewToggle.addEventListener('click', function() {
            currentView = currentView === 'list' ? 'grid' : 'list';
            
            // Update icon
            const icon = this.querySelector('i');
            icon.className = currentView === 'list' ? 'fas fa-list' : 'fas fa-th';
            
            // Apply view transformation (if files exist)
            if (filesContent) {
                if (currentView === 'grid') {
                    filesContent.classList.add('grid-view');
                    filesContent.classList.remove('list-view');
                } else {
                    filesContent.classList.add('list-view');
                    filesContent.classList.remove('grid-view');
                }
            }
            
            // Show notification for view change
            if (window.toastSystem) {
                window.toastSystem.info(`Chế độ xem: ${currentView === 'grid' ? 'Lưới' : 'Danh sách'}`, {
                    duration: 2000
                });
            }
        });
    }
    
    // Initialize drag and drop for the entire page
    initDragAndDrop();
    
    // Initialize UI
    initializeUI();
    
    // Load existing files from server
    loadFiles();
    
    // Auto refresh every 10 seconds to show new uploads
    setInterval(loadFiles, 10000);
    
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
    // Simple UI setup if needed
    console.log('UI initialized');
}

// Load files from server
async function loadFiles() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        
        const filesContent = document.getElementById('files-content');
        const emptyState = document.getElementById('empty-state');
        
        if (files && files.length > 0) {
            // Hide empty state and show files
            if (emptyState) emptyState.style.display = 'none';
            if (filesContent) {
                filesContent.classList.add('has-files');
                filesContent.style.display = 'block';
                filesContent.innerHTML = createFileListHTML(files);
                
                // Update file count
                updateFileCount(files);
                
                // Add file interactions
                addFileInteractions();
            }
            
            console.log(`Loaded ${files.length} files successfully`);
        } else {
            // Show empty state
            if (emptyState) emptyState.style.display = 'block';
            if (filesContent) {
                filesContent.classList.remove('has-files');
                filesContent.style.display = 'none';
            }
            
            // Update file count
            updateFileCount([]);
            
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

// Create sample files for demonstration
window.createSampleFiles = function() {
    const sampleFiles = [
        { name: 'Tài liệu dự án.pdf', size: '2.5 MB', type: 'pdf', date: '2 giờ trước' },
        { name: 'Hình ảnh logo.png', size: '890 KB', type: 'image', date: '1 ngày trước' },
        { name: 'Bản trình bày.pptx', size: '5.2 MB', type: 'presentation', date: '3 ngày trước' },
        { name: 'Dữ liệu bán hàng.xlsx', size: '1.8 MB', type: 'spreadsheet', date: '1 tuần trước' }
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
    const filesContent = document.getElementById('files-content');
    const emptyState = document.getElementById('empty-state');
    
    if (emptyState) emptyState.style.display = 'none';
    if (filesContent) {
        filesContent.classList.add('has-files');
        filesContent.style.display = 'block';
        filesContent.innerHTML = createFileListHTML(files);
        
        // Update file count
        updateFileCount(files);
        
        // Add file interactions
        addFileInteractions();
    }
}

// Generate HTML for file list
function createFileListHTML(files) {
    return `
        <div class="file-list list-view">
            ${files.map(file => `
                <div class="file-item" data-file-id="${file.id}" data-file-name="${file.originalName}">
                    <div class="file-icon-wrapper ${file.isImage ? 'image-preview' : ''}" ${file.isImage ? `style="background-image: url('/api/preview/${file.id}'); background-size: cover; background-position: center;"` : ''}>
                        ${!file.isImage ? `<i class="fas ${getFileIconClass(file)}"></i>` : ''}
                    </div>
                    <div class="file-details">
                        <div class="file-name" title="${file.originalName}">${file.originalName}</div>
                        <div class="file-meta">
                            <span class="file-size">${formatFileSize(file.size)}</span>
                            <span class="file-date">${formatDate(file.uploadDate)}</span>
                            <span class="file-type">${file.type}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="action-btn preview-btn" title="Xem trước" onclick="previewFile('${file.id}', '${file.originalName}', '${file.type}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn details-btn" title="Xem chi tiết" onclick="viewFileDetails('${file.id}', '${file.originalName}')">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="action-btn download-btn" title="Tải xuống" onclick="downloadFile('${file.id}', '${file.originalName}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn rename-btn" title="Đổi tên" onclick="renameFile('${file.id}', '${file.displayName || file.originalName}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" title="Xóa" onclick="deleteFile('${file.id}', '${file.displayName || file.originalName}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date; // Remove Math.abs to get correct direction
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Handle future dates (shouldn't happen but just in case)
    if (diffTime < 0) {
        return date.toLocaleDateString('vi-VN');
    }

    // Less than 1 minute
    if (diffMinutes < 1) {
        return 'Vừa xong';
    }

    // Less than 1 hour
    if (diffMinutes < 60) {
        return `${diffMinutes} phút trước`;
    }

    // Less than 24 hours
    if (diffHours < 24) {
        return `${diffHours} giờ trước`;
    }

    // Exactly 1 day
    if (diffDays === 1) {
        return 'Hôm qua';
    }

    // Less than 7 days
    if (diffDays < 7) {
        return `${diffDays} ngày trước`;
    }

    // More than a week - show actual date
    return date.toLocaleDateString('vi-VN');
}

// Update file count display
function updateFileCount(files) {
    const fileCount = document.querySelector('.file-count');
    if (fileCount) {
        fileCount.textContent = `${files.length} tệp tin`;
    }
}

// Add file interaction handlers
function addFileInteractions() {
    const fileItems = document.querySelectorAll('.file-item');
    const actionBtns = document.querySelectorAll('.action-btn');
    
    fileItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.closest('.action-btn')) {
                const fileName = this.getAttribute('data-file-name');
                if (window.toastSystem) {
                    window.toastSystem.info(`Đang mở tệp: ${fileName}`, {
                        duration: 2000
                    });
                }
            }
        });
    });
    
    actionBtns.forEach(btn => {
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

// View file details
window.viewFileDetails = async function(fileId, fileName) {
    // Prevent double-click by checking if modal is already open
    if (window.modalSystem.activeModal) {
        return;
    }

    try {
        // Fetch detailed file information
        const response = await fetch(`/api/files/${fileId}/details`);
        const fileDetails = await response.json();

        if (!response.ok) {
            throw new Error(fileDetails.error || 'Failed to fetch file details');
        }

        // Create file details content
        const detailsContent = document.createElement('div');
        detailsContent.className = 'file-details-container';

        // File icon and basic info
        const headerSection = document.createElement('div');
        headerSection.className = 'file-details-header';
        headerSection.innerHTML = `
            <div class="file-icon-large">
                <i class="fas ${getFileIconClass(fileDetails)}"></i>
            </div>
            <div class="file-basic-info">
                <h4>${fileDetails.originalName}</h4>
                <p class="file-type">${fileDetails.type || 'Unknown'}</p>
            </div>
        `;

        // Details grid
        const detailsGrid = document.createElement('div');
        detailsGrid.className = 'file-details-grid';

        const details = [
            { label: 'Tên tệp', value: fileDetails.originalName },
            { label: 'Kích thước', value: formatFileSize(fileDetails.size) },
            { label: 'Loại MIME', value: fileDetails.type || 'Không xác định' },
            { label: 'Thời điểm tải lên', value: formatDate(fileDetails.uploadDate) },
            { label: 'Người sở hữu', value: fileDetails.owner || 'User' },
            { label: 'Quyền truy cập', value: fileDetails.permissions || 'Riêng tư' }
        ];

        if (fileDetails.hash) {
            details.push({
                label: 'SHA-256 Hash',
                value: `
                    <div class="file-hash-container">
                        <code class="file-hash">${fileDetails.hash}</code>
                        <button class="copy-hash-btn" onclick="copyToClipboard('${fileDetails.hash}')">
                            <i class="fas fa-copy"></i> Sao chép
                        </button>
                    </div>
                `
            });
        }

        if (fileDetails.version) {
            details.push({ label: 'Phiên bản', value: fileDetails.version });
        }

        details.forEach(detail => {
            const item = document.createElement('div');
            item.className = 'file-details-item';
            item.innerHTML = `
                <div class="file-details-label">${detail.label}</div>
                <div class="file-details-value">${detail.value}</div>
            `;
            detailsGrid.appendChild(item);
        });

        detailsContent.appendChild(headerSection);
        detailsContent.appendChild(detailsGrid);

        // Create modal
        window.modalSystem.createModal({
            title: 'Chi tiết tệp',
            content: detailsContent,
            buttons: [
                {
                    text: 'Tải xuống',
                    className: 'btn-primary',
                    onclick: () => {
                        downloadFile(fileId, fileName);
                        window.modalSystem.closeModal();
                    }
                },
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onclick: () => window.modalSystem.closeModal()
                }
            ]
        });

    } catch (error) {
        console.error('Error fetching file details:', error);
        window.toastSystem.error(`Lỗi tải thông tin tệp: ${error.message}`);
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

// Auto-initialize if page is already loaded
document.addEventListener('DOMContentLoaded', function() {
    const myFilesPage = document.getElementById('myfiles-page');
    if (myFilesPage && myFilesPage.classList.contains('active')) {
        window.initMyFiles();
    }
});