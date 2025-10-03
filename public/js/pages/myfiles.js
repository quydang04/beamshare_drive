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
            if (window.showNotification) {
                showNotification(`Chế độ xem: ${currentView === 'grid' ? 'Lưới' : 'Danh sách'}`, 'info');
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
    showNotification('Đang làm mới danh sách tệp...', 'info');
    
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
            showNotification(`Đã thả ${files.length} tệp. Chuyển đến trang tải lên...`, 'success');
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
        showNotification('Lỗi tải danh sách tệp', 'error');
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
    showNotification('Đã tạo 4 tệp mẫu để bạn trải nghiệm!', 'success');
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
                        <button class="action-btn download-btn" title="Tải xuống" onclick="downloadFile('${file.id}', '${file.originalName}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn rename-btn" title="Đổi tên" onclick="renameFile('${file.id}', '${file.originalName}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" title="Xóa" onclick="deleteFile('${file.id}', '${file.originalName}')">
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
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays <= 7) return `${diffDays} ngày trước`;
    
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
                showNotification(`Đang mở tệp: ${fileName}`, 'info');
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
                    showNotification(`Đang tải xuống: ${fileName}`, 'success');
                    break;
                case 'Chia sẻ':
                    showNotification(`Đã tạo link chia sẻ cho: ${fileName}`, 'success');
                    break;
                case 'Xóa':
                    if (confirm(`Bạn có chắc muốn xóa "${fileName}"?`)) {
                        this.closest('.file-item').remove();
                        showNotification(`Đã xóa: ${fileName}`, 'info');
                    }
                    break;
            }
        });
    });
}

// CRUD Operations

// Download file
window.downloadFile = async function(fileId, fileName) {
    try {
        showNotification(`Đang tải xuống ${fileName}...`, 'info');
        
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
        
        showNotification(`Đã tải xuống ${fileName}`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification(`Lỗi tải xuống: ${error.message}`, 'error');
    }
};

// Delete file
window.deleteFile = async function(fileId, fileName) {
    if (!confirm(`Bạn có chắc muốn xóa "${fileName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Đã xóa ${fileName}`, 'success');
            // Reload file list
            loadFiles();
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification(`Lỗi xóa tệp: ${error.message}`, 'error');
    }
};

// Rename file
window.renameFile = async function(fileId, currentName) {
    const newName = prompt('Nhập tên mới:', currentName.replace(/\.[^/.]+$/, ""));
    
    if (!newName || newName.trim() === '') {
        return;
    }
    
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName: newName.trim() })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Đã đổi tên thành ${newName}`, 'success');
            // Reload file list
            loadFiles();
        } else {
            throw new Error(result.error || 'Rename failed');
        }
    } catch (error) {
        console.error('Rename error:', error);
        showNotification(`Lỗi đổi tên: ${error.message}`, 'error');
    }
};

// Simplified file type detection (kept for compatibility)
function getEnhancedFileType(fileName, mimeType) {
    const ext = fileName.toLowerCase().split('.').pop();
    return { extension: ext };
}

// Preview file - Enhanced version with Vue Office support
window.previewFile = function(fileId, fileName, fileType) {
    console.log('Preview file called:', fileId, fileName, fileType);
    
    const ext = fileName.toLowerCase().split('.').pop();
    
    // Use Vue Office for supported office documents
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
        if (window.vueOfficePreview) {
            window.vueOfficePreview.openPreview(fileId, fileName, fileType);
        } else {
            console.error('Vue Office Preview not initialized');
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
                    <p>Để xem trước tài liệu này, vui lòng tải xuống và mở bằng ứng dụng tương ứng.</p>
                </div>
                <div class="office-actions">
                    <button class="btn-office-online" onclick="openOfficeOnline('${previewUrl}', '${fileName}')">
                        <i class="fas fa-external-link-alt"></i>
                        Xem trên Office Online
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

// Open Office file in Office Online viewer
window.openOfficeOnline = function(fileUrl, fileName) {
    const officeOnlineUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + fileUrl)}`;
    window.open(officeOnlineUrl, '_blank');
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