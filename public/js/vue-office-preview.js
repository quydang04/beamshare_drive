// Vue Office Preview Component
const { createApp } = Vue;

// Vue Office Preview App
let vueOfficeApp = null;

// Initialize Vue Office Preview
function initVueOfficePreview() {
    if (vueOfficeApp) {
        vueOfficeApp.unmount();
    }
    
    // Create Vue app for office preview
    vueOfficeApp = createApp({
        data() {
            return {
                showPreview: false,
                currentFile: null,
                previewType: '',
                fileUrl: '',
                fileName: '',
                loading: false,
                error: null
            };
        },
        methods: {
            openPreview(fileId, fileName, fileType) {
                console.log('Opening Vue Office preview:', fileName, fileType);
                console.log('Vue Office components available:', {
                    docx: typeof VueOfficeDocx !== 'undefined',
                    excel: typeof VueOfficeExcel !== 'undefined', 
                    pdf: typeof VueOfficePdf !== 'undefined'
                });
                
                this.currentFile = fileId;
                this.fileName = fileName;
                this.fileUrl = `/api/preview/${fileId}`;
                this.loading = true;
                this.error = null;
                
                // Determine preview type based on file extension
                const ext = fileName.toLowerCase().split('.').pop();
                console.log('File extension:', ext);
                
                if (['pdf'].includes(ext)) {
                    this.previewType = 'pdf';
                } else if (['doc', 'docx'].includes(ext)) {
                    this.previewType = 'docx';
                } else if (['xls', 'xlsx'].includes(ext)) {
                    this.previewType = 'excel';
                } else {
                    this.previewType = 'unsupported';
                    console.log('Unsupported file type:', ext);
                }
                
                console.log('Preview type set to:', this.previewType);
                this.showPreview = true;
                
                // Set loading to false after a short delay to show the component
                setTimeout(() => {
                    this.loading = false;
                }, 500);
            },
            
            closePreview() {
                this.showPreview = false;
                this.currentFile = null;
                this.previewType = '';
                this.fileUrl = '';
                this.fileName = '';
                this.error = null;
            },
            
            onDocxLoad() {
                console.log('DOCX loaded successfully');
                this.loading = false;
            },
            
            onDocxError(error) {
                console.error('DOCX load error:', error);
                this.error = 'Không thể tải file Word. Vui lòng thử lại.';
                this.loading = false;
            },
            
            onExcelLoad() {
                console.log('Excel loaded successfully');
                this.loading = false;
            },
            
            onExcelError(error) {
                console.error('Excel load error:', error);
                this.error = 'Không thể tải file Excel. Vui lòng thử lại.';
                this.loading = false;
            },
            
            onPdfLoad() {
                console.log('PDF loaded successfully');
                this.loading = false;
            },
            
            onPdfError(error) {
                console.error('PDF load error:', error);
                this.error = 'Không thể tải file PDF. Vui lòng thử lại.';
                this.loading = false;
            },
            
            downloadFile() {
                if (this.currentFile) {
                    window.downloadFile(this.currentFile, this.fileName);
                }
            }
        },
        
        template: `
            <div v-if="showPreview" class="vue-office-modal" @click.self="closePreview">
                <div class="vue-office-content">
                    <div class="vue-office-header">
                        <h3>{{ fileName }}</h3>
                        <div class="vue-office-actions">
                            <button @click="downloadFile" class="btn-download">
                                <i class="fas fa-download"></i>
                                Tải xuống
                            </button>
                            <button @click="closePreview" class="btn-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="vue-office-body">
                        <div v-if="loading" class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Đang tải file...</p>
                        </div>
                        
                        <div v-if="error" class="error-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>{{ error }}</p>
                        </div>
                        
                        <!-- PDF Preview -->
                        <vue-office-pdf 
                            v-if="previewType === 'pdf' && !loading && !error"
                            :src="fileUrl"
                            @rendered="onPdfLoad"
                            @error="onPdfError"
                            style="height: 70vh;"
                        />
                        
                        <!-- Word Preview -->
                        <vue-office-docx 
                            v-if="previewType === 'docx' && !loading && !error"
                            :src="fileUrl"
                            @rendered="onDocxLoad"
                            @error="onDocxError"
                            style="height: 70vh; overflow: auto;"
                        />
                        
                        <!-- Excel Preview -->
                        <vue-office-excel 
                            v-if="previewType === 'excel' && !loading && !error"
                            :src="fileUrl"
                            @rendered="onExcelLoad"
                            @error="onExcelError"
                            style="height: 70vh; overflow: auto;"
                        />
                        
                        <!-- Unsupported File Type -->
                        <div v-if="previewType === 'unsupported'" class="unsupported-file">
                            <i class="fas fa-file-alt"></i>
                            <h4>{{ fileName }}</h4>
                            <p>Loại file này chưa được hỗ trợ preview.</p>
                            <p>Vui lòng tải xuống để xem nội dung.</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    });
    
    // Register Vue Office components - handle different export formats
    try {
        const docxComponent = VueOfficeDocx?.default || VueOfficeDocx;
        const excelComponent = VueOfficeExcel?.default || VueOfficeExcel; 
        const pdfComponent = VueOfficePdf?.default || VueOfficePdf;
        
        if (docxComponent) {
            vueOfficeApp.component('vue-office-docx', docxComponent);
            console.log('Registered vue-office-docx component');
        } else {
            console.error('vue-office-docx component not found');
        }
        
        if (excelComponent) {
            vueOfficeApp.component('vue-office-excel', excelComponent);
            console.log('Registered vue-office-excel component');
        } else {
            console.error('vue-office-excel component not found');
        }
        
        if (pdfComponent) {
            vueOfficeApp.component('vue-office-pdf', pdfComponent);
            console.log('Registered vue-office-pdf component');
        } else {
            console.error('vue-office-pdf component not found');
        }
    } catch (error) {
        console.error('Error registering Vue Office components:', error);
    }
    
    // Mount to a container
    const container = document.createElement('div');
    container.id = 'vue-office-preview';
    document.body.appendChild(container);
    
    const vm = vueOfficeApp.mount('#vue-office-preview');
    
    // Make globally accessible
    window.vueOfficePreview = vm;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking Vue...');
    
    // Wait a bit for Vue to load
    setTimeout(() => {
        console.log('Vue available:', typeof Vue !== 'undefined');
        console.log('VueOfficeDocx available:', typeof VueOfficeDocx !== 'undefined');
        console.log('VueOfficeExcel available:', typeof VueOfficeExcel !== 'undefined');
        console.log('VueOfficePdf available:', typeof VueOfficePdf !== 'undefined');
        
        if (typeof Vue !== 'undefined') {
            try {
                initVueOfficePreview();
                console.log('Vue Office Preview initialized successfully');
            } catch (error) {
                console.error('Error initializing Vue Office Preview:', error);
            }
        } else {
            console.error('Vue is not available');
        }
    }, 500);
});