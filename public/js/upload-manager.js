// Enhanced Upload Manager with duplicate handling and original filename preservation
class UploadManager {
    constructor() {
        this.pendingUploads = [];
        this.uploadQueue = [];
        this.isProcessing = false;
    }

    // Check if filename already exists
    async checkFileExists(filename) {
        try {
            const response = await fetch('/api/files/check-exists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename })
            });

            if (!response.ok) {
                console.warn('Could not check file existence, proceeding with upload');
                return false;
            }

            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('Error checking file existence:', error);
            // If check fails, proceed with upload (don't block)
            return false;
        }
    }

    // Generate suggested filename for duplicates
    generateSuggestedName(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
        
        // Generate suggestions like "filename(1).ext", "filename(2).ext", etc.
        const suggestions = [];
        for (let i = 1; i <= 5; i++) {
            suggestions.push(`${nameWithoutExt}(${i})${extension}`);
        }
        
        return suggestions;
    }

    // Handle duplicate filename with user input
    async handleDuplicateFile(file, originalName) {
        const suggestions = this.generateSuggestedName(originalName);
        
        // Create content for duplicate handling modal
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Tệp "<strong>${originalName}</strong>" đã tồn tại. Vui lòng chọn tên mới:</p>
            <div class="duplicate-suggestions">
                <p><strong>Gợi ý:</strong></p>
                <ul>
                    ${suggestions.map(name => `<li><button class="suggestion-btn" onclick="selectSuggestion('${name}')">${name}</button></li>`).join('')}
                </ul>
            </div>
            <div class="custom-name-input">
                <label for="custom-filename">Hoặc nhập tên tùy chỉnh:</label>
                <input type="text" id="custom-filename" class="modal-input" placeholder="Tên tệp mới" />
                <div class="filename-validation" id="filename-validation"></div>
            </div>
        `;

        // Add suggestion click handlers
        window.selectSuggestion = (suggestedName) => {
            const input = document.getElementById('custom-filename');
            if (input) {
                input.value = suggestedName;
                input.dispatchEvent(new Event('input'));
            }
        };

        return new Promise((resolve) => {
            const modal = window.modalSystem.createModal({
                title: 'Tệp trùng tên',
                content: content,
                autoFocus: '#custom-filename',
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onclick: () => {
                            window.modalSystem.closeModal();
                            resolve(null);
                        }
                    },
                    {
                        text: 'Sử dụng tên này',
                        className: 'btn-primary',
                        disabled: true,
                        onclick: async () => {
                            const input = document.getElementById('custom-filename');
                            const newName = input.value.trim();
                            
                            if (newName && await this.validateNewFilename(newName)) {
                                window.modalSystem.closeModal();
                                resolve(newName);
                            }
                        }
                    }
                ]
            });

            // Setup real-time validation
            const input = modal.querySelector('#custom-filename');
            const validation = modal.querySelector('#filename-validation');
            const confirmBtn = modal.querySelector('.btn-primary');

            input.addEventListener('input', async () => {
                const newName = input.value.trim();
                const isValid = await this.validateNewFilename(newName, validation);
                confirmBtn.disabled = !isValid;
            });
        });
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

    // Process file upload with conflict resolution and progress tracking
    async processFileUpload(file, customName = null, progressCallback = null) {
        const filename = customName || file.name;
        console.log('Starting upload for:', filename, 'Size:', file.size);

        try {
            // Use conflict resolution system
            const uploadFunction = async (file, resolution) => {
                const formData = new FormData();
                formData.append('file', file);

                // Add conflict resolution parameters
                if (resolution.action === 'replace') {
                    formData.append('conflictAction', 'replace');
                } else if (resolution.action === 'rename' && resolution.newName) {
                    formData.append('conflictAction', 'rename');
                    formData.append('customName', resolution.newName);
                } else if (customName) {
                    formData.append('customName', customName);
                }

                console.log('FormData created, starting XMLHttpRequest');

                // Create XMLHttpRequest for progress tracking
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    // Track upload progress
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable && progressCallback) {
                            const percentComplete = (e.loaded / e.total) * 100;
                            progressCallback(percentComplete, filename);
                        }
                    });

                    xhr.addEventListener('load', () => {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            if (xhr.status === 200) {
                                if (result.success) {
                                    console.log('Upload successful:', result);
                                    this.showToast(`Đã tải lên "${result.file.displayName}"`, 'success');
                                    resolve({ success: true, filename: result.file.displayName, result });
                                } else if (result.conflict) {
                                    // Server detected conflict, shouldn't happen with our pre-check
                                    console.warn('Unexpected conflict from server:', result);
                                    resolve({ success: false, conflict: true, result });
                                } else {
                                    throw new Error(result.error || 'Upload failed');
                                }
                            } else {
                                throw new Error(`Server error: ${xhr.status}`);
                            }
                        } catch (error) {
                            console.error('Error parsing response:', error);
                            reject(error);
                        }
                    });

                    xhr.addEventListener('error', (e) => {
                        console.error('XHR error:', e);
                        reject(new Error('Network error during upload'));
                    });

                    xhr.addEventListener('timeout', () => {
                        console.error('XHR timeout');
                        reject(new Error('Upload timeout'));
                    });

                    xhr.open('POST', '/api/upload');
                    xhr.timeout = 30000; // 30 second timeout
                    xhr.send(formData);
                });
            };

            // Handle upload with conflict resolution
            const result = await window.conflictResolution.handleUploadWithConflictResolution(file, uploadFunction);

            if (result.cancelled) {
                this.showToast(`Đã hủy tải lên "${filename}"`, 'info');
                return { success: false, cancelled: true };
            }

            return result;

        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Lỗi tải lên "${filename}": ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Safe toast notification with fallback
    showToast(message, type = 'info') {
        if (window.toastSystem && window.toastSystem[type]) {
            window.toastSystem[type](message);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            // Fallback to alert for errors
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
        }
    }

    // Upload multiple files with progress tracking
    async uploadFiles(files, progressCallback = null) {
        const results = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.showToast(`Đang xử lý "${file.name}" (${i + 1}/${files.length})...`, 'info');

            // Create individual progress callback
            const fileProgressCallback = progressCallback ?
                (percent, filename) => progressCallback(percent, filename, i) : null;

            const result = await this.processFileUpload(file, null, fileProgressCallback);
            results.push(result);

            // Small delay between uploads to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Summary notification
        const successful = results.filter(r => r.success).length;
        const cancelled = results.filter(r => r.cancelled).length;
        const failed = results.filter(r => !r.success && !r.cancelled).length;

        if (successful > 0) {
            this.showToast(`Đã tải lên thành công ${successful} tệp`, 'success');
        }
        if (cancelled > 0) {
            this.showToast(`Đã hủy ${cancelled} tệp`, 'info');
        }
        if (failed > 0) {
            this.showToast(`Lỗi tải lên ${failed} tệp`, 'error');
        }

        return results;
    }
}

// Global upload manager instance
window.uploadManager = new UploadManager();

// Enhanced drag and drop handler for upload page
window.setupEnhancedUpload = function(uploadAreaSelector) {
    const uploadArea = document.querySelector(uploadAreaSelector);
    if (!uploadArea) return;

    // File input handler
    const fileInput = uploadArea.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await window.uploadManager.uploadFiles(files);
                // Clear input for next upload
                e.target.value = '';
            }
        });
    }

    // Drag and drop handlers
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
            await window.uploadManager.uploadFiles(files);
        }
    });
};
