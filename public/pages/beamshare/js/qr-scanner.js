// QR Scanner for Join Room functionality
// Handles camera access and QR code detection

class QRScanner {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.stream = null;
        this.scanning = false;
        this.scanInterval = null;
        this.onScanSuccess = null;
        this.onScanError = null;
    }

    async initialize(videoElement, onSuccess, onError) {
        this.video = videoElement;
        this.onScanSuccess = onSuccess;
        this.onScanError = onError;

        // Create canvas for image processing
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Prefer back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.video.srcObject = this.stream;
            this.video.play();

            console.log('✅ Camera initialized for QR scanning');
            return true;
        } catch (error) {
            console.error('❌ Camera access failed:', error);
            this.onScanError?.('Camera access denied. Please allow camera permissions.');
            return false;
        }
    }

    startScanning() {
        if (this.scanning) return;
        
        this.scanning = true;
        console.log('🔍 Started QR code scanning');

        // Wait for video to be ready
        this.video.addEventListener('loadedmetadata', () => {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            // Start scanning interval
            this.scanInterval = setInterval(() => {
                this.scan();
            }, 100); // Scan every 100ms
        });
    }

    stopScanning() {
        if (!this.scanning) return;

        this.scanning = false;
        console.log('⏹️ Stopped QR code scanning');

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }
    }

    scan() {
        if (!this.video || !this.canvas || !this.context) return;

        try {
            // Draw video frame to canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Try to decode QR code using jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
                console.log('✅ QR Code detected:', code.data);
                this.handleQRCodeDetected(code.data);
            }
        } catch (error) {
            console.warn('⚠️ QR scan error:', error);
        }
    }

    handleQRCodeDetected(data) {
        // Stop scanning first
        this.stopScanning();

        // Parse the QR code data
        try {
            let roomCode = null;

            // Check if it's a URL with room parameter
            if (data.includes('room=')) {
                const url = new URL(data);
                roomCode = url.searchParams.get('room');
            } 
            // Check if it's just a room code (5 characters)
            else if (data.length === 5 && /^[A-Z0-9]+$/i.test(data)) {
                roomCode = data.toUpperCase();
            }
            // Check if it's a room code with prefix
            else if (data.startsWith('ROOM:')) {
                roomCode = data.substring(5).toUpperCase();
            }

            if (roomCode && roomCode.length === 5) {
                console.log('✅ Valid room code from QR:', roomCode);
                this.onScanSuccess?.(roomCode);
            } else {
                console.warn('❌ Invalid QR code format:', data);
                this.onScanError?.('Invalid QR code. Please scan a valid room QR code.');
            }
        } catch (error) {
            console.error('❌ Error parsing QR code:', error);
            this.onScanError?.('Error reading QR code. Please try again.');
        }
    }

    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
}

// QR Scanner Dialog Manager
class QRScannerDialog {
    constructor() {
        this.scanner = new QRScanner();
        this.dialogElement = null;
        this.videoElement = null;
        this.messageElement = null;
        this.isOpen = false;
    }

    createDialog() {
        // Create dialog HTML
        const dialogHTML = `
            <mdui-dialog id="qr-scanner-dialog" headline="Scan QR Code to Join Room">
                <div style="padding: 0 24px;">
                    <div class="qr-scanner-container">
                        <div id="qr-scanner-loading" class="qr-scanner-loading">
                            <mdui-circular-progress></mdui-circular-progress>
                            <div>Starting camera...</div>
                        </div>
                        <video id="qr-scanner-video" class="qr-scanner-video" style="display: none;" playsinline></video>
                        <div class="qr-scanner-overlay" style="display: none;">
                            <div class="qr-scanner-viewfinder">
                                <div class="qr-scanner-corner top-left"></div>
                                <div class="qr-scanner-corner top-right"></div>
                                <div class="qr-scanner-corner bottom-left"></div>
                                <div class="qr-scanner-corner bottom-right"></div>
                            </div>
                            <div id="qr-scanner-message" class="qr-scanner-message">
                                Point camera at QR code
                            </div>
                        </div>
                    </div>
                    
                    <div id="qr-scanner-error" style="display: none;"></div>
                    <div id="qr-scanner-success" style="display: none;"></div>
                    
                    <div class="qr-scanner-controls">
                        <mdui-button variant="outlined" id="qr-scanner-manual-btn">
                            <mdui-icon slot="icon" name="keyboard"></mdui-icon>
                            Enter Code Manually
                        </mdui-button>
                    </div>
                </div>
                
                <mdui-button slot="action" variant="text" onclick="qrScannerDialog.close()">Cancel</mdui-button>
            </mdui-dialog>
        `;

        // Add to document
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // Get elements
        this.dialogElement = document.getElementById('qr-scanner-dialog');
        this.videoElement = document.getElementById('qr-scanner-video');
        this.messageElement = document.getElementById('qr-scanner-message');
        this.loadingElement = document.getElementById('qr-scanner-loading');
        this.errorElement = document.getElementById('qr-scanner-error');
        this.successElement = document.getElementById('qr-scanner-success');
        this.overlayElement = document.querySelector('.qr-scanner-overlay');

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ QR Scanner dialog created');
    }

    setupEventListeners() {
        // Manual entry button
        document.getElementById('qr-scanner-manual-btn').addEventListener('click', () => {
            this.close();
            // Open the regular join room dialog
            document.getElementById('your-room-dialog').open = true;
        });

        // Dialog close event
        this.dialogElement.addEventListener('close', () => {
            this.handleDialogClose();
        });

        // Video loaded event
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.showScanning();
        });
    }

    async open() {
        if (!this.dialogElement) {
            this.createDialog();
        }

        if (this.isOpen) return;

        // Check camera support
        if (!QRScanner.isSupported()) {
            this.showError('Camera not supported on this device');
            return;
        }

        this.isOpen = true;
        this.dialogElement.open = true;
        
        this.showLoading();

        // Initialize camera and scanner
        const success = await this.scanner.initialize(
            this.videoElement,
            (roomCode) => this.handleScanSuccess(roomCode),
            (error) => this.showError(error)
        );

        if (success) {
            this.scanner.startScanning();
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.scanner.stopScanning();
        
        if (this.dialogElement) {
            this.dialogElement.open = false;
        }
    }

    handleDialogClose() {
        this.scanner.stopScanning();
        this.isOpen = false;
    }

    showLoading() {
        this.loadingElement.style.display = 'flex';
        this.videoElement.style.display = 'none';
        this.overlayElement.style.display = 'none';
        this.errorElement.style.display = 'none';
        this.successElement.style.display = 'none';
    }

    showScanning() {
        this.loadingElement.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.overlayElement.style.display = 'block';
        this.errorElement.style.display = 'none';
        this.successElement.style.display = 'none';
    }

    showError(message) {
        this.errorElement.innerHTML = `
            <div class="qr-scanner-error">
                <mdui-icon name="error" style="margin-bottom: 8px; font-size: 2rem;"></mdui-icon>
                <div>${message}</div>
            </div>
        `;
        this.errorElement.style.display = 'block';
        this.successElement.style.display = 'none';
    }

    showSuccess(roomCode) {
        this.successElement.innerHTML = `
            <div class="qr-scanner-success">
                <mdui-icon name="check_circle" style="margin-bottom: 8px; font-size: 2rem;"></mdui-icon>
                <div>Successfully scanned room code: <strong>${roomCode}</strong></div>
                <div style="font-size: 0.9rem; margin-top: 8px;">Joining room...</div>
            </div>
        `;
        this.successElement.style.display = 'block';
        this.errorElement.style.display = 'none';
    }

    handleScanSuccess(roomCode) {
        console.log('🎉 QR scan successful:', roomCode);
        this.showSuccess(roomCode);

        // Join the room
        setTimeout(() => {
            if (typeof joinRoomByCode === 'function') {
                joinRoomByCode(roomCode);
            }
            this.close();
        }, 1500);
    }
}

// Global QR Scanner instance
let qrScannerDialog = null;

// Initialize QR Scanner
function initializeQRScanner() {
    qrScannerDialog = new QRScannerDialog();
    console.log('✅ QR Scanner initialized');
}

// Open QR Scanner
function openQRScanner() {
    if (!qrScannerDialog) {
        initializeQRScanner();
    }
    qrScannerDialog.open();
}

// Export to global scope
window.QRScanner = QRScanner;
window.QRScannerDialog = QRScannerDialog;
window.qrScannerDialog = qrScannerDialog;
window.initializeQRScanner = initializeQRScanner;
window.openQRScanner = openQRScanner;
