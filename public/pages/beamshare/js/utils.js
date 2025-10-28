// Utility Functions
// Helper functions for device detection, notifications, and UI utilities

// Device detection functions
function getDeviceName() {
    const saved = localStorage.getItem('device_name');
    if (saved) return saved;

    // Check URL parameters for demo device type
    const urlParams = new URLSearchParams(window.location.search);
    const deviceParam = urlParams.get('device');

    if (deviceParam) {
        const deviceNames = {
            'mobile1': '📱 iPhone 15 Pro',
            'laptop1': '💻 MacBook Pro',
            'desktop1': '🖥️ Windows PC',
            'tablet1': '📱 iPad Air',
            'mobile2': '📱 Samsung Galaxy',
            'laptop2': '💻 Dell XPS',
            'desktop2': '🖥️ Mac Studio',
            'tablet2': '📱 Surface Pro'
        };
        return deviceNames[deviceParam] || `Device ${deviceParam}`;
    }

    // Get detailed device information
    const deviceInfo = getDetailedDeviceInfo();
    return deviceInfo.name;
}

function getDetailedDeviceInfo() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const vendor = navigator.vendor;

    let deviceName = '';
    let deviceType = 'desktop';
    let osName = '';
    let osVersion = '';

    // Detect operating system and version
    if (/Windows NT 10.0/i.test(userAgent)) {
        osName = 'Windows';
        osVersion = '11'; // Windows 11 also reports as NT 10.0
        if (/Windows NT 10.0.*Win64/i.test(userAgent)) {
            osVersion = userAgent.includes('22000') ? '11' : '10';
        }
    } else if (/Windows NT 6.3/i.test(userAgent)) {
        osName = 'Windows';
        osVersion = '8.1';
    } else if (/Windows NT 6.2/i.test(userAgent)) {
        osName = 'Windows';
        osVersion = '8';
    } else if (/Windows NT 6.1/i.test(userAgent)) {
        osName = 'Windows';
        osVersion = '7';
    } else if (/Mac OS X (\d+[._]\d+)/i.test(userAgent)) {
        osName = 'macOS';
        const match = userAgent.match(/Mac OS X (\d+)[._](\d+)/i);
        if (match) {
            const major = parseInt(match[1]);
            const minor = parseInt(match[2]);
            if (major === 10) {
                if (minor >= 15) osVersion = 'Catalina+';
                else if (minor >= 14) osVersion = 'Mojave';
                else if (minor >= 13) osVersion = 'High Sierra';
                else osVersion = `10.${minor}`;
            } else if (major >= 11) {
                osVersion = `${major}.${minor}`;
            }
        }
    } else if (/Android (\d+\.?\d*)/i.test(userAgent)) {
        osName = 'Android';
        const match = userAgent.match(/Android (\d+\.?\d*)/i);
        if (match) osVersion = match[1];
        deviceType = 'mobile';
    } else if (/iPhone OS (\d+_\d+)/i.test(userAgent) || /iPhone/i.test(userAgent)) {
        osName = 'iOS';
        const match = userAgent.match(/iPhone OS (\d+_\d+)/i) || userAgent.match(/Version\/(\d+\.\d+)/i);
        if (match) osVersion = match[1].replace('_', '.');
        deviceType = 'mobile';
    } else if (/iPad/i.test(userAgent)) {
        osName = 'iPadOS';
        const match = userAgent.match(/OS (\d+_\d+)/i) || userAgent.match(/Version\/(\d+\.\d+)/i);
        if (match) osVersion = match[1].replace('_', '.');
        deviceType = 'tablet';
    } else if (/Linux/i.test(userAgent)) {
        osName = 'Linux';
        if (/Ubuntu/i.test(userAgent)) osName = 'Ubuntu';
        else if (/Fedora/i.test(userAgent)) osName = 'Fedora';
        else if (/CentOS/i.test(userAgent)) osName = 'CentOS';
    }

    // Detect device model for mobile devices
    let deviceModel = '';
    if (deviceType === 'mobile' || deviceType === 'tablet') {
        if (/iPhone/i.test(userAgent)) {
            if (/iPhone15/i.test(userAgent)) deviceModel = 'iPhone 15';
            else if (/iPhone14/i.test(userAgent)) deviceModel = 'iPhone 14';
            else if (/iPhone13/i.test(userAgent)) deviceModel = 'iPhone 13';
            else if (/iPhone12/i.test(userAgent)) deviceModel = 'iPhone 12';
            else deviceModel = 'iPhone';
        } else if (/iPad/i.test(userAgent)) {
            if (/iPad.*Pro/i.test(userAgent)) deviceModel = 'iPad Pro';
            else if (/iPad.*Air/i.test(userAgent)) deviceModel = 'iPad Air';
            else if (/iPad.*Mini/i.test(userAgent)) deviceModel = 'iPad Mini';
            else deviceModel = 'iPad';
        } else if (/Android/i.test(userAgent)) {
            // Try to extract Android device model
            const modelMatch = userAgent.match(/;\s*([^;)]+)\s*\)/);
            if (modelMatch && modelMatch[1] && !modelMatch[1].includes('wv')) {
                deviceModel = modelMatch[1].trim();
                // Clean up common patterns
                deviceModel = deviceModel.replace(/Build\/.*$/, '').trim();
                deviceModel = deviceModel.replace(/Android.*/, '').trim();
            } else {
                deviceModel = 'Android Device';
            }
        }
    }

    // Generate device name with emoji
    if (deviceType === 'mobile') {
        if (osName === 'iOS') {
            deviceName = `📱 ${deviceModel || 'iPhone'}`;
        } else {
            deviceName = `📱 ${deviceModel || 'Android Device'}`;
        }
    } else if (deviceType === 'tablet') {
        deviceName = `📱 ${deviceModel || 'Tablet'}`;
    } else {
        // Desktop/laptop
        if (osName === 'Windows') {
            deviceName = `🖥️ Windows ${osVersion} PC`;
        } else if (osName === 'macOS') {
            // Detect if it's likely a MacBook or iMac
            if (/MacBook/i.test(platform) || /Laptop/i.test(userAgent)) {
                deviceName = `💻 MacBook (${osName} ${osVersion})`;
            } else {
                deviceName = `🖥️ Mac (${osName} ${osVersion})`;
            }
        } else if (osName.includes('Linux') || osName === 'Ubuntu' || osName === 'Fedora') {
            deviceName = `🖥️ ${osName} PC`;
        } else {
            deviceName = `🖥️ Desktop Computer`;
        }
    }

    return {
        name: deviceName,
        type: deviceType,
        os: osName,
        osVersion: osVersion,
        model: deviceModel,
        platform: platform
    };
}

function getDeviceType() {
    // Check URL parameters for demo device type
    const urlParams = new URLSearchParams(window.location.search);
    const deviceParam = urlParams.get('device');

    if (deviceParam) {
        if (deviceParam.includes('mobile') || deviceParam.includes('tablet')) {
            return 'mobile';
        }
        return 'desktop';
    }

    const deviceInfo = getDetailedDeviceInfo();
    return deviceInfo.type;
}

function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = '';

    // Detect browser and version
    if (/Chrome\/(\d+\.\d+)/i.test(userAgent) && !/Edg/i.test(userAgent)) {
        browserName = 'Chrome';
        const match = userAgent.match(/Chrome\/(\d+\.\d+)/i);
        if (match) browserVersion = match[1];
    } else if (/Firefox\/(\d+\.\d+)/i.test(userAgent)) {
        browserName = 'Firefox';
        const match = userAgent.match(/Firefox\/(\d+\.\d+)/i);
        if (match) browserVersion = match[1];
    } else if (/Edg\/(\d+\.\d+)/i.test(userAgent)) {
        browserName = 'Edge';
        const match = userAgent.match(/Edg\/(\d+\.\d+)/i);
        if (match) browserVersion = match[1];
    } else if (/Safari\/(\d+\.\d+)/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
        browserName = 'Safari';
        const match = userAgent.match(/Version\/(\d+\.\d+)/i);
        if (match) browserVersion = match[1];
    } else if (/Opera\/(\d+\.\d+)/i.test(userAgent) || /OPR\/(\d+\.\d+)/i.test(userAgent)) {
        browserName = 'Opera';
        const match = userAgent.match(/(?:Opera|OPR)\/(\d+\.\d+)/i);
        if (match) browserVersion = match[1];
    }

    return browserVersion ? `${browserName} ${browserVersion}` : browserName;
}

// Get system information
function getSystemInfo() {
    const deviceInfo = getDetailedDeviceInfo();
    const browserInfo = getBrowserInfo();

    // Generate a friendly display name like PairDrop
    const displayName = generateDisplayName();

    return {
        deviceName: deviceInfo.name,
        displayName: displayName,
        deviceType: deviceInfo.type,
        type: deviceInfo.type,
        os: deviceInfo.os,
        osVersion: deviceInfo.osVersion,
        browser: browserInfo,
        platform: deviceInfo.platform,
        model: deviceInfo.model,
        // Additional system info
        language: navigator.language || navigator.userLanguage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,
        // Hardware info (if available)
        hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
        memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
        // Network info
        connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt
        } : null
    };
}

// Generate a friendly display name like PairDrop (Color + Animal)
function generateDisplayName() {
    const colors = [
        'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan',
        'Magenta', 'Lime', 'Indigo', 'Violet', 'Turquoise', 'Gold', 'Silver', 'Coral'
    ];

    const animals = [
        'Cat', 'Dog', 'Lion', 'Tiger', 'Bear', 'Wolf', 'Fox', 'Rabbit',
        'Eagle', 'Dolphin', 'Elephant', 'Giraffe', 'Panda', 'Koala', 'Penguin', 'Owl'
    ];

    // Use a combination of user agent and current time for randomness
    // but make it somewhat consistent for the same browser session
    const seed = (navigator.userAgent + navigator.language).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);

    const colorIndex = Math.abs(seed) % colors.length;
    const animalIndex = Math.abs(Math.floor(seed / colors.length)) % animals.length;

    return `${colors[colorIndex]} ${animals[animalIndex]}`;
}

// Room code generation
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Notification functions
function showNotification(message, type = 'info') {
    try {
        // Check if notificationSnackbar exists
        if (!window.notificationSnackbar) {
            window.notificationSnackbar = document.getElementById('notification-snackbar');
        }

        if (!window.notificationSnackbar) {
            console.warn('notification-snackbar element not found, using alert fallback');
            alert(message); // Fallback to alert
            return;
        }

        window.notificationSnackbar.innerHTML = message;
        window.notificationSnackbar.open = true;

        // Play sound if enabled
        playNotificationSound(type);

        // Auto close after 3 seconds
        setTimeout(() => {
            if (window.notificationSnackbar) {
                window.notificationSnackbar.open = false;
            }
        }, 3000);

    } catch (error) {
        console.error('Error in showNotification:', error);
        alert(message); // Fallback to alert
    }
}

function playNotificationSound(type = 'info') {
    // Check if sound notifications are enabled
    const soundEnabled = localStorage.getItem('sound_notifications') !== 'false';
    if (!soundEnabled) return;

    try {
        // Create audio context for different notification types
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Different frequencies for different notification types
        let frequency = 800; // Default
        switch (type) {
            case 'success':
                frequency = 1000; // Higher pitch for success
                break;
            case 'warning':
                frequency = 600; // Lower pitch for warning
                break;
            case 'error':
                frequency = 400; // Even lower for error
                break;
        }

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';

        // Volume envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Audio notification not supported:', error);
    }
}

// Connection status update
function updateConnectionStatus(status, message) {
    const statusChip = connectionStatus;

    statusChip.innerHTML = '';

    if (status === 'connected') {
        statusChip.variant = 'filled';
        statusChip.style.backgroundColor = '#4caf50';
        statusChip.innerHTML = `<mdui-icon slot="icon" name="wifi"></mdui-icon>${t('connected')}`;
    } else if (status === 'connecting') {
        statusChip.variant = 'outlined';
        statusChip.innerHTML = `<mdui-icon slot="icon" name="wifi_tethering"></mdui-icon>${t('connecting')}`;
    } else {
        statusChip.variant = 'outlined';
        statusChip.innerHTML = `<mdui-icon slot="icon" name="wifi_off"></mdui-icon>${t('disconnected')}`;
    }
}

// File utility functions
function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType.startsWith('audio/')) return 'music_note';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    if (mimeType.includes('text') || mimeType.includes('document')) return 'description';
    return 'insert_drive_file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export to global scope
window.getDeviceName = getDeviceName;
window.getDeviceType = getDeviceType;
window.getBrowserInfo = getBrowserInfo;
window.getDetailedDeviceInfo = getDetailedDeviceInfo;
window.getSystemInfo = getSystemInfo;
window.generateDisplayName = generateDisplayName;
window.generateRoomCode = generateRoomCode;
window.showNotification = showNotification;
window.playNotificationSound = playNotificationSound;
window.updateConnectionStatus = updateConnectionStatus;
window.getFileIcon = getFileIcon;
window.formatFileSize = formatFileSize;
