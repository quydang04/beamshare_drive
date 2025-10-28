// Main Application Entry Point
// P2P File Transfer using PeerJS with MDUI interface
// Modern Material Design interface inspired by PairDrop

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 VieCloud Share initializing...');

    // Initialize device info after utils.js is loaded
    if (typeof getSystemInfo === 'function') {
        window.deviceInfo = getSystemInfo();
        console.log('Device info initialized:', window.deviceInfo);

        // Update local device display with initial device name and system info
        if (typeof updateLocalDeviceDisplay === 'function') {
            updateLocalDeviceDisplay();
        }

        // Display detailed system information
        updateSystemInfoDisplay();
    } else {
        console.warn('getSystemInfo function not found');
    }

    // Load saved language first
    loadSavedLanguage();

    // Initialize QR Scanner
    if (typeof initializeQRScanner === 'function') {
        initializeQRScanner();
    }

    // Start device discovery first to get peer ID from server
    // PeerJS will be initialized after receiving peer ID from signaling server
    if (typeof startDeviceDiscovery === 'function') {
        startDeviceDiscovery();
    }

    // Setup all event listeners
    setupEventListeners();

    // Load saved settings after a short delay to ensure MDUI components are initialized
    setTimeout(() => {
        loadSettings();

        // Initialize persistent connections system
        if (typeof initializePersistentConnections === 'function') {
            initializePersistentConnections();
        }
    }, 200);

    // Update UI language after everything is loaded
    setTimeout(() => {
        updateUILanguage();
        // Initialize connected devices display
        if (typeof updateConnectedDevicesDisplay === 'function') {
            updateConnectedDevicesDisplay();
        }
    }, 100);

    // Check for room code in URL
    checkRoomCodeInURL();

    // Setup cleanup on page unload
    setupCleanup();

    console.log('✅ VieCloud Share initialized successfully');
});

// Load saved settings from localStorage
function loadSettings() {
    // Load device name
    const savedName = localStorage.getItem('device_name');
    if (savedName) {
        const deviceNameInput = document.getElementById('device-name-input');
        if (deviceNameInput) {
            deviceNameInput.value = savedName;
        }

        // Update device info and display
        if (window.deviceInfo) {
            window.deviceInfo.name = savedName;
        }

        // Update local device display
        if (typeof updateLocalDeviceDisplay === 'function') {
            updateLocalDeviceDisplay();
        }
    }

    // Load auto-accept setting
    const autoAccept = localStorage.getItem('auto_accept_files') === 'true';
    const autoAcceptSwitch = document.getElementById('auto-accept-switch');
    if (autoAcceptSwitch) {
        autoAcceptSwitch.checked = autoAccept;
        // For MDUI switches, also set the attribute
        if (autoAccept) {
            autoAcceptSwitch.setAttribute('checked', '');
        } else {
            autoAcceptSwitch.removeAttribute('checked');
        }
        console.log('✅ Auto-accept setting loaded:', autoAccept);
    }

    // Load sound notifications setting (default: true)
    const soundNotifications = localStorage.getItem('sound_notifications');
    const soundSwitch = document.getElementById('sound-notifications-switch');
    if (soundSwitch) {
        const soundEnabled = soundNotifications !== 'false';
        soundSwitch.checked = soundEnabled;
        // For MDUI switches, also set the attribute
        if (soundEnabled) {
            soundSwitch.setAttribute('checked', '');
        } else {
            soundSwitch.removeAttribute('checked');
        }
        console.log('✅ Sound notifications setting loaded:', soundEnabled);
    }




}

// Check for room code in URL parameters
function checkRoomCodeInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode && joinRoomCodeInput) {
        joinRoomCodeInput.value = roomCode;
        showNotification('Room code detected in URL!');
    }
}

// Setup cleanup handlers
function setupCleanup() {
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleaning up before page unload...');
        stopDeviceDiscovery();
    });

    // Handle visibility change (when user switches tabs)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('📱 Page hidden, reducing activity...');
        } else {
            console.log('👀 Page visible, resuming activity...');
            // Refresh device discovery when page becomes visible again
            if (isConnected) {
                requestNearbyDevices();
            }
        }
    });
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('💥 Global error:', event.error);
    showNotification('An unexpected error occurred', 'error');
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred', 'error');
    event.preventDefault();
});

// Export initialization function for manual initialization if needed
window.initializeApp = () => {
    console.log('🔄 Manual app initialization...');
    loadSavedLanguage();
    initializePeer();
    setupEventListeners();
    loadSettings();
    updateUILanguage();
    checkRoomCodeInURL();
    setupCleanup();
}

// Update system information display
function updateSystemInfoDisplay() {
    const deviceDetailsElement = document.getElementById('device-details');
    if (!deviceDetailsElement) return;

    try {
        const systemInfo = getSystemInfo();

        // Create detailed system information
        const details = [];

        // Browser and OS info
        if (systemInfo.browser) {
            details.push(systemInfo.browser);
        }

        if (systemInfo.os && systemInfo.osVersion) {
            details.push(`${systemInfo.os} ${systemInfo.osVersion}`);
        } else if (systemInfo.os) {
            details.push(systemInfo.os);
        }

        // Hardware info
        if (systemInfo.hardwareConcurrency && systemInfo.hardwareConcurrency !== 'Unknown') {
            details.push(`${systemInfo.hardwareConcurrency} cores`);
        }

        if (systemInfo.memory && systemInfo.memory !== 'Unknown') {
            details.push(`${systemInfo.memory} RAM`);
        }

        // Screen info
        if (systemInfo.screenResolution) {
            details.push(`${systemInfo.screenResolution}`);
        }

        // Network info
        if (systemInfo.connection && systemInfo.connection.effectiveType) {
            details.push(`${systemInfo.connection.effectiveType.toUpperCase()}`);
        }

        // Display the information
        deviceDetailsElement.innerHTML = details.join(' • ');

        // Log detailed system info for debugging
        console.log('📱 System Information:', systemInfo);

    } catch (error) {
        console.error('Error getting system info:', error);
        deviceDetailsElement.innerHTML = 'System info unavailable';
    }
}

// Export initialization function for manual initialization if needed
window.initializeApp = () => {
    console.log('🔄 Manual app initialization...');
    loadSavedLanguage();
    initializePeer();
    setupEventListeners();
    loadSettings();
    updateUILanguage();
    checkRoomCodeInURL();
    setupCleanup();
};

// Export system info function
window.updateSystemInfoDisplay = updateSystemInfoDisplay;














