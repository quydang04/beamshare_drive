// PDF.js Preview System with Enhanced Office File Support
const PDFJS_MAIN_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_MAIN_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const PDFJS_FALLBACK_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_FALLBACK_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFPreviewSystem {
    constructor() {
        this.currentModal = null;
        this.currentPdf = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.rotation = 0;
        this.pdfjsLib = null;
        this.pdfjsReadyPromise = null;
        this.boundKeyHandler = this.handleKeyboard.bind(this);

        // Initialize PDF.js
        this.initPDFJS();
    }

    initPDFJS() {
        if (typeof window.pdfjsLib !== 'undefined') {
            this.configurePdfjs(window.pdfjsLib, PDFJS_MAIN_WORKER);
            console.log('PDF.js detected globally');
            return;
        }

        if (!this.pdfjsReadyPromise) {
            this.pdfjsReadyPromise = this.loadPdfjsScript(PDFJS_MAIN_SRC, PDFJS_MAIN_WORKER)
                .catch((mainError) => {
                    console.warn('Failed to load primary PDF.js build:', mainError);
                    return this.loadPdfjsScript(PDFJS_FALLBACK_SRC, PDFJS_FALLBACK_WORKER);
                })
                .catch((fallbackError) => {
                    console.error('Unable to load any PDF.js build:', fallbackError);
                    throw fallbackError;
                });
        }
    }

    async ensurePdfjsReady() {
        if (this.pdfjsLib) return this.pdfjsLib;

        if (typeof window.pdfjsLib !== 'undefined') {
            this.configurePdfjs(window.pdfjsLib, PDFJS_MAIN_WORKER);
            return this.pdfjsLib;
        }

        if (!this.pdfjsReadyPromise) {
            this.initPDFJS();
        }

        if (!this.pdfjsReadyPromise) {
            throw new Error('PDF.js script loading was not initiated');
        }

        return this.pdfjsReadyPromise;
    }

    loadPdfjsScript(src, workerSrc) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                // Script tag already present; wait a tick for global to appear
                setTimeout(() => {
                    if (typeof window.pdfjsLib !== 'undefined') {
                        this.configurePdfjs(window.pdfjsLib, workerSrc);
                        resolve(this.pdfjsLib);
                    } else {
                        reject(new Error('PDF.js global not available after existing script load'));
                    }
                }, 0);
                return;
            }

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = src;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                if (typeof window.pdfjsLib === 'undefined') {
                    script.remove();
                    reject(new Error('PDF.js global missing after script load'));
                    return;
                }
                this.configurePdfjs(window.pdfjsLib, workerSrc);
                console.log(`PDF.js loaded from ${src}`);
                resolve(this.pdfjsLib);
            };
            script.onerror = (event) => {
                script.remove();
                reject(new Error(`Failed to load PDF.js script: ${event?.message || src}`));
            };
            document.head.appendChild(script);
        });
    }

    configurePdfjs(library, workerSrc) {
        this.pdfjsLib = library;
        if (this.pdfjsLib?.GlobalWorkerOptions) {
            this.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        }
    }
    
    async openPreview(fileId, fileName, fileType) {
        try {
            const fileUrl = `/api/preview/${fileId}`;
            this.currentFileId = fileId; // Store for download functionality

            // Show loading toast
            if (window.toastSystem) {
                window.toastSystem.info(`Đang tải ${fileName}...`, {
                    duration: 2000,
                    dismissible: false
                });
            }

            // Create modal
            this.createModal(fileName);

            // Determine file type and handle accordingly
            const ext = fileName.toLowerCase().split('.').pop();

            if (ext === 'pdf') {
                await this.loadPDF(fileUrl);
            } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
                await this.loadOfficeFile(fileUrl, fileName, ext);
            } else {
                this.showUnsupportedFile(fileName);
            }

        } catch (error) {
            console.error('Preview error:', error);
            if (window.toastSystem) {
                window.toastSystem.error(`Lỗi tải file: ${error.message}`, {
                    duration: 4000
                });
            }
            this.closePreview();
        }
    }
    
    createModal(fileName) {
        // Remove existing modal if any
        this.closePreview();
        
        const modal = document.createElement('div');
        modal.className = 'pdf-preview-modal';
        modal.innerHTML = `
            <div class="pdf-preview-content">
                <div class="pdf-preview-header">
                    <h3 class="file-name">${fileName}</h3>
                    <div class="pdf-preview-controls">
                        <div class="page-controls" style="display: none;">
                            <button class="control-btn" id="prev-page" title="Trang trước">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span class="page-info">
                                <span id="current-page">1</span> / <span id="total-pages">1</span>
                            </span>
                            <button class="control-btn" id="next-page" title="Trang sau">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="zoom-controls" style="display: none;">
                            <button class="control-btn" id="zoom-out" title="Thu nhỏ">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <span class="zoom-info" id="zoom-level">100%</span>
                            <button class="control-btn" id="zoom-in" title="Phóng to">
                                <i class="fas fa-search-plus"></i>
                            </button>
                        </div>
                        <div class="action-controls">
                            <button class="control-btn download-btn" id="download-file" title="Tải xuống">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="control-btn close-btn" id="close-preview" title="Đóng">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pdf-preview-body">
                    <div class="loading-container">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Đang tải file...</p>
                        </div>
                    </div>
                    <div class="pdf-container" style="display: none;">
                        <canvas id="pdf-canvas"></canvas>
                    </div>
                    <div class="office-container" style="display: none;">
                        <iframe id="office-iframe" frameborder="0"></iframe>
                    </div>
                    <div class="error-container" style="display: none;">
                        <div class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h4>Không thể tải file</h4>
                            <p class="error-text"></p>
                        </div>
                    </div>
                    <div class="unsupported-container" style="display: none;">
                        <div class="unsupported-message">
                            <i class="fas fa-file-alt"></i>
                            <h4 class="unsupported-filename"></h4>
                            <p>Loại file này chưa được hỗ trợ preview.</p>
                            <p>Vui lòng tải xuống để xem nội dung.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.currentModal = modal;
        
        // Add event listeners
        this.addEventListeners();
        
        // Show modal with animation
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    addEventListeners() {
        if (!this.currentModal) return;
        
        const modal = this.currentModal;
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePreview();
            }
        });
        
        // Control buttons
        modal.querySelector('#close-preview').addEventListener('click', () => this.closePreview());
        modal.querySelector('#download-file').addEventListener('click', () => this.downloadCurrentFile());
        
        // PDF controls
        modal.querySelector('#prev-page').addEventListener('click', () => this.previousPage());
        modal.querySelector('#next-page').addEventListener('click', () => this.nextPage());
        modal.querySelector('#zoom-in').addEventListener('click', () => this.zoomIn());
    modal.querySelector('#zoom-out').addEventListener('click', () => this.zoomOut());
        
    // Keyboard shortcuts
    document.addEventListener('keydown', this.boundKeyHandler);
    }
    
    handleKeyboard(e) {
        if (!this.currentModal) return;
        
        switch(e.key) {
            case 'Escape':
                this.closePreview();
                break;
            case 'ArrowLeft':
                this.previousPage();
                break;
            case 'ArrowRight':
                this.nextPage();
                break;
            case '+':
            case '=':
                this.zoomIn();
                break;
            case '-':
                this.zoomOut();
                break;
        }
    }
    
    async loadPDF(url) {
        try {
            const pdfjs = await this.ensurePdfjsReady();
            if (!pdfjs) {
                throw new Error('PDF.js library is unavailable');
            }

            const loadingTask = pdfjs.getDocument(url);
            this.currentPdf = await loadingTask.promise;
            this.totalPages = this.currentPdf.numPages;
            this.currentPage = 1;

            // Show PDF controls
            this.currentModal.querySelector('.page-controls').style.display = 'flex';
            this.currentModal.querySelector('.zoom-controls').style.display = 'flex';

            // Update page info
            this.updatePageInfo();

            // Render first page
            await this.renderPage(1);

            // Hide loading, show PDF
            this.currentModal.querySelector('.loading-container').style.display = 'none';
            this.currentModal.querySelector('.pdf-container').style.display = 'block';

            if (window.toastSystem) {
                window.toastSystem.success('PDF đã tải thành công', {
                    duration: 2000
                });
            }

        } catch (error) {
            console.error('PDF loading error:', error);
            this.showError('Không thể tải file PDF. Vui lòng thử lại.');
        }
    }
    
    async renderPage(pageNum) {
        if (!this.currentPdf) return;
        
        try {
            const page = await this.currentPdf.getPage(pageNum);
            const canvas = this.currentModal.querySelector('#pdf-canvas');
            const context = canvas.getContext('2d');
            
            const viewport = page.getViewport({ 
                scale: this.scale,
                rotation: this.rotation 
            });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            this.currentPage = pageNum;
            this.updatePageInfo();
            
        } catch (error) {
            console.error('Page rendering error:', error);
            this.showError('Lỗi hiển thị trang PDF.');
        }
    }
    
    async loadOfficeFile(url, fileName, ext) {
        try {
            // Enhanced office file loading with multiple fallback methods
            const approaches = [
                // Method 1: Server-side conversion to PDF (if available)
                () => this.loadWithServerConversion(url, fileName, ext),
                // Method 2: Office Online Viewer
                () => this.loadWithOfficeOnline(url, fileName, ext),
                // Method 3: Google Docs Viewer (fallback)
                () => this.loadWithGoogleDocs(url, fileName, ext),
                // Method 4: OnlyOffice Viewer (alternative)
                () => this.loadWithOnlyOffice(url, fileName, ext),
                // Method 5: Direct iframe (for some formats)
                () => this.loadWithDirectIframe(url, fileName, ext)
            ];

            // Show enhanced loading message
            this.updateLoadingMessage(`Đang tải file ${ext.toUpperCase()}...`);

            // Try each approach until one works
            for (let i = 0; i < approaches.length; i++) {
                try {
                    this.updateLoadingMessage(`Thử phương pháp ${i + 1}/${approaches.length}...`);
                    await approaches[i]();
                    return; // Success, exit
                } catch (error) {
                    console.warn(`Office loading method ${i + 1} failed:`, error);
                    if (i === approaches.length - 1) {
                        throw error; // Last method failed, throw error
                    }
                    // Wait a bit before trying next method
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

        } catch (error) {
            console.error('All office file loading methods failed:', error);
            this.showOfficeFileOptions(fileName, ext, url);
        }
    }

    updateLoadingMessage(message) {
        const loadingText = this.currentModal.querySelector('.loading-spinner p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    async loadWithServerConversion(url, fileName, ext) {
        // Try to convert office file to PDF on server side
        const convertUrl = `/api/convert-to-pdf${url}`;

        try {
            const response = await fetch(convertUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf'
                }
            });

            if (response.ok && response.headers.get('content-type')?.includes('application/pdf')) {
                // Successfully converted to PDF, load as PDF
                const pdfBlob = await response.blob();
                const pdfUrl = URL.createObjectURL(pdfBlob);

                await this.loadPDF(pdfUrl);

                if (window.toastSystem) {
                    window.toastSystem.success(`File ${ext.toUpperCase()} đã được chuyển đổi thành PDF`, {
                        duration: 3000
                    });
                }
                return;
            } else {
                throw new Error('Server conversion not available');
            }
        } catch (error) {
            throw new Error(`Server conversion failed: ${error.message}`);
        }
    }

    async loadWithOfficeOnline(url, fileName, ext) {
        const fullUrl = window.location.origin + url;
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`;

        const iframe = this.currentModal.querySelector('#office-iframe');

        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                // Check if iframe loaded successfully
                try {
                    // Hide loading, show office viewer
                    this.currentModal.querySelector('.loading-container').style.display = 'none';
                    this.currentModal.querySelector('.office-container').style.display = 'block';

                    if (window.toastSystem) {
                        window.toastSystem.success(`File ${ext.toUpperCase()} đã tải thành công`, {
                            duration: 2000
                        });
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            iframe.onerror = () => {
                reject(new Error('Office Online viewer failed'));
            };

            // Set timeout for loading
            setTimeout(() => {
                reject(new Error('Office Online viewer timeout'));
            }, 10000);

            iframe.src = officeUrl;
        });
    }

    async loadWithGoogleDocs(url, fileName, ext) {
        const fullUrl = window.location.origin + url;
        const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fullUrl)}&embedded=true`;

        const iframe = this.currentModal.querySelector('#office-iframe');

        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                this.currentModal.querySelector('.loading-container').style.display = 'none';
                this.currentModal.querySelector('.office-container').style.display = 'block';

                if (window.toastSystem) {
                    window.toastSystem.success(`File ${ext.toUpperCase()} đã tải với Google Docs Viewer`, {
                        duration: 2000
                    });
                }
                resolve();
            };

            iframe.onerror = () => {
                reject(new Error('Google Docs viewer failed'));
            };

            setTimeout(() => {
                reject(new Error('Google Docs viewer timeout'));
            }, 8000);

            iframe.src = googleUrl;
        });
    }

    async loadWithOnlyOffice(url, fileName, ext) {
        // OnlyOffice Document Server viewer
        const fullUrl = window.location.origin + url;
        const onlyOfficeUrl = `https://api.onlyoffice.com/editors/editor?url=${encodeURIComponent(fullUrl)}&lang=vi`;

        const iframe = this.currentModal.querySelector('#office-iframe');

        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                this.currentModal.querySelector('.loading-container').style.display = 'none';
                this.currentModal.querySelector('.office-container').style.display = 'block';

                if (window.toastSystem) {
                    window.toastSystem.success(`File ${ext.toUpperCase()} đã tải với OnlyOffice`, {
                        duration: 2000
                    });
                }
                resolve();
            };

            iframe.onerror = () => {
                reject(new Error('OnlyOffice viewer failed'));
            };

            setTimeout(() => {
                reject(new Error('OnlyOffice viewer timeout'));
            }, 8000);

            iframe.src = onlyOfficeUrl;
        });
    }

    async loadWithDirectIframe(url, fileName, ext) {
        const iframe = this.currentModal.querySelector('#office-iframe');

        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                this.currentModal.querySelector('.loading-container').style.display = 'none';
                this.currentModal.querySelector('.office-container').style.display = 'block';

                if (window.toastSystem) {
                    window.toastSystem.success(`File ${ext.toUpperCase()} đã tải trực tiếp`, {
                        duration: 2000
                    });
                }
                resolve();
            };

            iframe.onerror = () => {
                reject(new Error('Direct iframe loading failed'));
            };

            setTimeout(() => {
                reject(new Error('Direct iframe timeout'));
            }, 5000);

            iframe.src = url;
        });
    }

    showOfficeFileOptions(fileName, ext, url) {
        // Show enhanced options for office files when preview fails
        const optionsHtml = `
            <div class="office-options">
                <div class="office-icon">
                    <i class="fas fa-file-${this.getFileIcon(ext)}"></i>
                </div>
                <h4>${fileName}</h4>
                <p>Không thể xem trước file ${ext.toUpperCase()} này.</p>
                <p>Vui lòng chọn một trong các tùy chọn sau:</p>

                <div class="office-actions-grid">
                    <button class="office-action-btn primary" onclick="window.pdfPreviewSystem.downloadCurrentFile()">
                        <i class="fas fa-download"></i>
                        <span>Tải xuống</span>
                        <small>Tải về máy để xem</small>
                    </button>

                    <button class="office-action-btn" onclick="window.pdfPreviewSystem.openInNewTab('${url}')">
                        <i class="fas fa-external-link-alt"></i>
                        <span>Mở tab mới</span>
                        <small>Xem trong tab mới</small>
                    </button>

                    <button class="office-action-btn" onclick="window.pdfPreviewSystem.tryOfficeOnline('${url}', '${fileName}')">
                        <i class="fab fa-microsoft"></i>
                        <span>Office Online</span>
                        <small>Xem với Microsoft</small>
                    </button>

                    <button class="office-action-btn" onclick="window.pdfPreviewSystem.tryGoogleDocs('${url}', '${fileName}')">
                        <i class="fab fa-google"></i>
                        <span>Google Docs</span>
                        <small>Xem với Google</small>
                    </button>
                </div>

                <div class="office-info-text">
                    <p><strong>Gợi ý:</strong> Để có trải nghiệm tốt nhất, hãy tải file về và mở bằng ứng dụng tương ứng.</p>
                </div>
            </div>
        `;

        this.currentModal.querySelector('.loading-container').style.display = 'none';
        this.currentModal.querySelector('.unsupported-container').innerHTML = optionsHtml;
        this.currentModal.querySelector('.unsupported-container').style.display = 'block';
    }

    getFileIcon(ext) {
        const iconMap = {
            'doc': 'word',
            'docx': 'word',
            'xls': 'excel',
            'xlsx': 'excel',
            'ppt': 'powerpoint',
            'pptx': 'powerpoint',
            'pdf': 'pdf'
        };
        return iconMap[ext] || 'alt';
    }

    openInNewTab(url) {
        window.open(url, '_blank');
        if (window.toastSystem) {
            window.toastSystem.info('Đã mở file trong tab mới', { duration: 2000 });
        }
    }

    tryOfficeOnline(url, fileName) {
        const fullUrl = window.location.origin + url;
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`;
        window.open(officeUrl, '_blank');
        if (window.toastSystem) {
            window.toastSystem.info('Đã mở với Office Online', { duration: 2000 });
        }
    }

    tryGoogleDocs(url, fileName) {
        const fullUrl = window.location.origin + url;
        const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fullUrl)}`;
        window.open(googleUrl, '_blank');
        if (window.toastSystem) {
            window.toastSystem.info('Đã mở với Google Docs Viewer', { duration: 2000 });
        }
    }
    
    showUnsupportedFile(fileName) {
        this.currentModal.querySelector('.unsupported-filename').textContent = fileName;
        this.currentModal.querySelector('.loading-container').style.display = 'none';
        this.currentModal.querySelector('.unsupported-container').style.display = 'block';
    }
    
    showError(message) {
        this.currentModal.querySelector('.error-text').textContent = message;
        this.currentModal.querySelector('.loading-container').style.display = 'none';
        this.currentModal.querySelector('.error-container').style.display = 'block';
    }
    
    updatePageInfo() {
        if (!this.currentModal) return;
        
        this.currentModal.querySelector('#current-page').textContent = this.currentPage;
        this.currentModal.querySelector('#total-pages').textContent = this.totalPages;
        this.currentModal.querySelector('#zoom-level').textContent = Math.round(this.scale * 100) + '%';
        
        // Update button states
        this.currentModal.querySelector('#prev-page').disabled = this.currentPage <= 1;
        this.currentModal.querySelector('#next-page').disabled = this.currentPage >= this.totalPages;
    }
    
    async previousPage() {
        if (this.currentPage > 1) {
            await this.renderPage(this.currentPage - 1);
        }
    }
    
    async nextPage() {
        if (this.currentPage < this.totalPages) {
            await this.renderPage(this.currentPage + 1);
        }
    }
    
    async zoomIn() {
        this.scale = Math.min(this.scale * 1.25, 3.0);
        await this.renderPage(this.currentPage);
    }
    
    async zoomOut() {
        this.scale = Math.max(this.scale / 1.25, 0.25);
        await this.renderPage(this.currentPage);
    }
    
    downloadCurrentFile() {
        const fileName = this.currentModal.querySelector('.file-name').textContent;

        // Extract file ID from the current context
        if (this.currentFileId) {
            // Create download link
            const downloadUrl = `/api/download/${this.currentFileId}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (window.toastSystem) {
                window.toastSystem.success(`Đang tải xuống ${fileName}...`, {
                    duration: 3000
                });
            }
        } else {
            if (window.toastSystem) {
                window.toastSystem.error('Không thể tải xuống file', {
                    duration: 3000
                });
            }
        }
    }
    
    closePreview() {
        if (this.currentModal) {
            this.currentModal.classList.remove('show');
            setTimeout(() => {
                if (this.currentModal && this.currentModal.parentNode) {
                    this.currentModal.parentNode.removeChild(this.currentModal);
                }
                this.currentModal = null;
                this.currentPdf = null;
                this.currentPage = 1;
                this.totalPages = 0;
                this.scale = 1.0;
                this.rotation = 0;
            }, 300);
        }
        
        // Remove keyboard listener
        document.removeEventListener('keydown', this.boundKeyHandler);
    }
}

// Initialize PDF Preview System when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (!window.pdfPreviewSystem) {
        window.pdfPreviewSystem = new PDFPreviewSystem();
        console.log('PDF Preview System initialized');
    }
});

// Global function for compatibility
window.openFilePreview = function(fileId, fileName, fileType) {
    if (window.pdfPreviewSystem) {
        window.pdfPreviewSystem.openPreview(fileId, fileName, fileType);
    } else {
        console.error('PDF Preview System not initialized');
    }
};
