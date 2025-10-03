// Vue Files Preview Wrapper
class VueFilePreview {
    constructor() {
        this.app = null;
        this.isVueLoaded = false;
    }

    // Initialize Vue app for file preview
    init() {
        if (typeof Vue === 'undefined') {
            console.error('Vue is not loaded!');
            return false;
        }

        this.isVueLoaded = true;
        return true;
    }

    // Show file preview using a simpler approach
    showPreview(fileUrl, fileName, fileType) {
        console.log('Showing preview for:', fileName, fileType);

        // Create modal container
        const modalHtml = `
            <div id="vue-preview-modal" class="modal-overlay">
                <div class="modal-content vue-preview-modal">
                    <div class="modal-header">
                        <h3>${fileName}</h3>
                        <button class="modal-close" onclick="closeVuePreview()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="vue-preview-container">
                        ${this.getPreviewContent(fileUrl, fileName, fileType)}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-download" onclick="window.open('${fileUrl}', '_blank')">
                            <i class="fas fa-download"></i>
                            Tải xuống
                        </button>
                        <button class="btn-close" onclick="closeVuePreview()">
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('vue-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add click outside to close
        const modal = document.getElementById('vue-preview-modal');
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeVuePreview();
            }
        });
    }

    // Get preview content based on file type
    getPreviewContent(fileUrl, fileName, fileType) {
        const ext = fileName.toLowerCase().split('.').pop();

        // Images
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
            return `<img src="${fileUrl}" alt="${fileName}" class="preview-image" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">`;
        }

        // Videos
        if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext)) {
            return `
                <video controls class="preview-video" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">
                    <source src="${fileUrl}" type="${fileType}">
                    Trình duyệt không hỗ trợ video.
                </video>
            `;
        }

        // Audio
        if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
            return `
                <div class="audio-preview" style="text-align: center; padding: 40px;">
                    <div class="audio-icon" style="font-size: 60px; color: #667eea; margin-bottom: 24px;">
                        <i class="fas fa-music"></i>
                    </div>
                    <h4>${fileName}</h4>
                    <audio controls class="preview-audio" style="width: 100%; max-width: 400px; margin-top: 20px;">
                        <source src="${fileUrl}" type="${fileType}">
                        Trình duyệt không hỗ trợ audio.
                    </audio>
                </div>
            `;
        }

        // PDF
        if (ext === 'pdf') {
            return `
                <div class="pdf-preview" style="width: 100%; height: 70vh;">
                    <iframe src="${fileUrl}" style="width: 100%; height: 100%; border: none; border-radius: 8px;">
                        <p>Trình duyệt không hỗ trợ hiển thị PDF. 
                        <a href="${fileUrl}" target="_blank">Mở trong tab mới</a></p>
                    </iframe>
                </div>
            `;
        }

        // Text files
        if (['txt', 'js', 'css', 'html', 'json', 'xml', 'csv', 'log', 'md', 'py', 'java', 'cpp', 'c', 'php'].includes(ext)) {
            const containerId = 'text-content-' + Date.now();
            setTimeout(() => this.loadTextContent(containerId, fileUrl), 100);
            
            return `
                <div class="text-preview" style="width: 100%; max-height: 70vh; overflow: hidden;">
                    <div class="text-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8f9fa; border-radius: 8px 8px 0 0; color: #059669;">
                        <i class="fas fa-file-code" style="font-size: 24px;"></i>
                        <h4 style="margin: 0; font-size: 16px; color: #1a202c;">${fileName}</h4>
                    </div>
                    <div class="text-content" id="${containerId}" style="flex: 1; overflow: auto; background: #f8f9fa; padding: 0; max-height: 60vh;">
                        <div class="loading-text" style="padding: 40px; text-align: center; color: #718096;">Đang tải nội dung...</div>
                    </div>
                </div>
            `;
        }

        // Office documents
        if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
            const officeIcon = this.getOfficeIcon(ext);
            return `
                <div class="office-preview" style="text-align: center; padding: 40px;">
                    <div class="office-header" style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; color: #2563eb;">
                        <i class="fas ${officeIcon}" style="font-size: 48px;"></i>
                        <h4 style="margin: 0; font-size: 18px; color: #1a202c;">${fileName}</h4>
                    </div>
                    <div class="office-info" style="margin-bottom: 24px;">
                        <p style="color: #718096; margin-bottom: 8px;">Tài liệu Microsoft Office</p>
                        <p style="color: #718096; margin-bottom: 8px;">Để xem trước tài liệu này, vui lòng tải xuống và mở bằng ứng dụng tương ứng.</p>
                    </div>
                    <div class="office-actions" style="margin-top: 24px;">
                        <button class="btn-office-online" onclick="window.open('https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + fileUrl)}', '_blank')" 
                                style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: all 0.2s ease;">
                            <i class="fas fa-external-link-alt"></i>
                            Xem trên Office Online
                        </button>
                    </div>
                </div>
            `;
        }

        // Default
        const icon = this.getFileTypeIcon(ext);
        return `
            <div class="file-info-preview" style="text-align: center; padding: 40px;">
                <div class="file-icon-large" style="font-size: 80px; color: #667eea; opacity: 0.7; margin-bottom: 24px;">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="file-details-preview">
                    <h4 style="font-size: 20px; font-weight: 600; color: #1a202c; margin-bottom: 12px;">${fileName}</h4>
                    <p style="color: #718096; margin-bottom: 8px;">Loại: ${fileType || ext.toUpperCase()}</p>
                    <p style="color: #718096; margin-bottom: 8px;">Tải xuống để xem nội dung file này</p>
                </div>
            </div>
        `;
    }

    // Load text content
    loadTextContent(containerId, fileUrl) {
        fetch(fileUrl)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(text => {
                const container = document.getElementById(containerId);
                if (container && text.length < 100000) {
                    container.innerHTML = 
                        '<pre style="margin: 0; padding: 20px; font-family: \'Consolas\', \'Monaco\', \'Courier New\', monospace; font-size: 14px; line-height: 1.5; background: #ffffff; border-radius: 0 0 8px 8px; overflow: auto;"><code>' + 
                        text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
                        '</code></pre>';
                } else if (container) {
                    container.innerHTML = 
                        '<div class="error-text" style="padding: 40px; text-align: center; color: #e53e3e;">File quá lớn để hiển thị. Vui lòng tải xuống để xem.</div>';
                }
            })
            .catch(error => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = 
                        '<div class="error-text" style="padding: 40px; text-align: center; color: #e53e3e;">Không thể tải nội dung file</div>';
                }
            });
    }

    // Helper functions
    getOfficeIcon(ext) {
        switch (ext) {
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

    getFileTypeIcon(ext) {
        const iconMap = {
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word', 'docx': 'fa-file-word',
            'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel',
            'ppt': 'fa-file-powerpoint', 'pptx': 'fa-file-powerpoint',
            'js': 'fa-file-code', 'html': 'fa-file-code', 'css': 'fa-file-code',
            'txt': 'fa-file-alt', 'md': 'fa-file-alt',
            'jpg': 'fa-file-image', 'png': 'fa-file-image',
            'mp3': 'fa-file-audio', 'wav': 'fa-file-audio',
            'mp4': 'fa-file-video', 'avi': 'fa-file-video',
            'zip': 'fa-file-archive', 'rar': 'fa-file-archive'
        };
        return iconMap[ext] || 'fa-file';
    }
}

// Global instance
window.vueFilePreview = new VueFilePreview();

// Global function to close preview
window.closeVuePreview = function() {
    const modal = document.getElementById('vue-preview-modal');
    if (modal) {
        modal.remove();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.vueFilePreview.init();
});