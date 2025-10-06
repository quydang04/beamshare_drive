// Simple Upload Page JavaScript - Working Version
window.initUpload = function() {
    console.log('=== INITIALIZING UPLOAD PAGE ===');
    
    // Wait for DOM to be ready
    setTimeout(() => {
        setupUpload();
    }, 300);
};

function setupUpload() {
    console.log('Setting up upload functionality...');
    
    const fileInput = document.getElementById('fileInput');
    const uploadButtons = document.querySelectorAll('.btn-upload-primary');
    const dropZone = document.querySelector('.upload-drop-zone');
    
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
            handleFiles(e.target.files);
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
            handleFiles(e.dataTransfer.files);
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
function handleFiles(files) {
    console.log('Handling files:', files.length);
    
    // Prevent duplicate uploads
    if (isUploading) {
        console.log('Upload already in progress, ignoring...');
        return;
    }
    
    if (files.length === 0) {
        showMessage('Không có file nào được chọn!', 'error');
        return;
    }
    
    if (files.length > 5) {
        showMessage('Chỉ có thể tải lên tối đa 5 file cùng lúc!', 'error');
        return;
    }
    
    // Check file sizes
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    for (let file of files) {
        if (file.size > maxSize) {
            showMessage(`File "${file.name}" vượt quá kích thước tối đa 2GB!`, 'error');
            return;
        }
    }
    
    // Show upload progress
    showUploadProgress(files);
    
    // Start upload
    uploadFiles(files);
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
            <h3>Đang tải lên ${files.length} file</h3>
        </div>
        <div class="upload-progress-list">
            ${Array.from(files).map((file, index) => `
                <div class="upload-progress-item" data-index="${index}">
                    <div class="file-info">
                        <i class="fas fa-file"></i>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${formatFileSize(file.size)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            `).join('')}
        </div>
    `;
    
    uploadMain.appendChild(progressContainer);
}

// Upload files to server
async function uploadFiles(files) {
    console.log('Starting upload for', files.length, 'files');
    
    isUploading = true; // Set uploading flag
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    try {
        // Simulate progress
        simulateProgress();
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        // Check if response is ok first
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Upload response:', result);

        if (result.success) {
            const fileCount = result.files ? result.files.length : files.length;
            showMessage(`Đã tải lên thành công ${fileCount} file!`, 'success');

            // Update progress to 100%
            updateProgressBars(100);

            // Redirect to My Files after delay
            setTimeout(() => {
                showMessage('Chuyển đến trang quản lý file...', 'info');
                window.loadPage('myfiles');
            }, 2000);
        } else {
            // More detailed error handling
            const errorMsg = result.error || result.message || 'Upload failed - no error details provided';
            console.error('Server returned error:', result);
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('Upload error:', error);

        // Hide progress UI on error
        const progressContainer = document.querySelector('.upload-progress-container');
        if (progressContainer) {
            progressContainer.remove();
        }

        // Show detailed error message
        let errorMessage = 'Lỗi tải lên';
        if (error.message) {
            if (error.message.includes('HTTP Error')) {
                errorMessage = `Lỗi kết nối server: ${error.message}`;
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
            } else {
                errorMessage = `Lỗi tải lên: ${error.message}`;
            }
        }

        showMessage(errorMessage, 'error');
    } finally {
        isUploading = false; // Reset uploading flag
    }
}

// Simulate upload progress
function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        
        updateProgressBars(progress);
        
        if (progress >= 90) {
            clearInterval(interval);
        }
    }, 200);
}

// Update progress bars
function updateProgressBars(percentage) {
    const progressBars = document.querySelectorAll('.progress-fill');
    const progressTexts = document.querySelectorAll('.progress-text');
    
    progressBars.forEach(bar => {
        bar.style.width = percentage + '%';
    });
    
    progressTexts.forEach(text => {
        text.textContent = Math.round(percentage) + '%';
    });
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