// UI Management System
// Handles UI updates, language switching, and interface management

function updateUILanguage() {
    // Update app title
    const appTitle = document.querySelector('mdui-top-app-bar-title');
    if (appTitle) appTitle.textContent = t('appTitle');

    // Update language button tooltip
    const languageBtn = document.getElementById('language-btn');
    if (languageBtn) {
        const langNames = { en: 'English', vi: 'Tiếng Việt' };
        languageBtn.setAttribute('title', langNames[currentLanguage] || 'Language');
    }

    // Update all elements with data-lang attributes
    updateDataLangElements();

    // Update navigation drawer items
    updateNavigationDrawer();

    // Update main content
    updateMainContent();

    // Update dialogs
    updateDialogs();

    // Update buttons and labels
    updateButtonsAndLabels();

    // Update device grid if it exists
    updateDeviceGrid();
}

// Update elements with data-lang attributes
function updateDataLangElements() {
    // Update elements with data-lang attribute
    const langElements = document.querySelectorAll('[data-lang]');
    langElements.forEach(element => {
        const key = element.getAttribute('data-lang');
        if (key) {
            element.textContent = t(key);
        }
    });

    // Update text fields with data-lang attributes
    const textFields = document.querySelectorAll('mdui-text-field[data-lang-label]');
    textFields.forEach(field => {
        const labelKey = field.getAttribute('data-lang-label');
        const placeholderKey = field.getAttribute('data-lang-placeholder');
        const helperKey = field.getAttribute('data-lang-helper');

        if (labelKey) field.setAttribute('label', t(labelKey));
        if (placeholderKey) field.setAttribute('placeholder', t(placeholderKey));
        if (helperKey) field.setAttribute('helper', t(helperKey));
    });
}

function updateNavigationDrawer() {
    const navItems = document.querySelectorAll('#navigation-drawer mdui-list-item');
    navItems.forEach(item => {
        const icon = item.getAttribute('icon');
        switch (icon) {
            case 'home':
                item.textContent = t('home');
                break;
            case 'devices':
                item.textContent = t('devices');
                break;
            case 'file_copy':
                item.textContent = t('fileTransfer');
                break;
            case 'settings':
                item.textContent = t('settings');
                break;
            case 'language':
                item.textContent = t('language');
                break;
            case 'help':
                item.textContent = t('help');
                break;
        }
    });
}

function updateMainContent() {
    // Update header
    const headerTitle = document.querySelector('.header h1');
    if (headerTitle) {
        headerTitle.textContent = t('transferFilesCrossPlatform');
    }
    
    const headerSubtitle = document.querySelector('.header p');
    if (headerSubtitle) {
        headerSubtitle.textContent = t('noSetupNoSignup');
    }

    // Update "Your Device" section
    const yourDeviceText = document.querySelector('.device-card div[style*="font-weight: 500"]');
    if (yourDeviceText && yourDeviceText.textContent.includes('Your Device')) {
        yourDeviceText.textContent = t('yourDevice');
    }

    // Update connection status
    const connectionStatusElement = document.getElementById('connection-status');
    if (connectionStatusElement && connectionStatusElement.textContent.includes('Connecting')) {
        connectionStatusElement.innerHTML = `<mdui-icon slot="icon" name="wifi_off"></mdui-icon>${t('connecting')}`;
    }

    // Update section headings
    const headings = document.querySelectorAll('h2');
    headings.forEach(heading => {
        const text = heading.textContent.trim();
        if (text.includes('Send Files')) {
            heading.innerHTML = `<mdui-icon name="file_upload" style="color: var(--primary-color);"></mdui-icon>${t('sendFiles')}`;
        } else if (text.includes('Manual Connection')) {
            heading.innerHTML = `<mdui-icon name="link" style="color: var(--primary-color);"></mdui-icon>${t('manualConnection')}`;
        } else if (text.includes('Connected Devices')) {
            heading.innerHTML = `<mdui-icon name="devices_other" style="color: var(--primary-color);"></mdui-icon>${t('connectedDevices')}`;
        } else if (text.includes('Nearby Devices')) {
            heading.innerHTML = `<mdui-icon name="nearby" style="color: var(--primary-color);"></mdui-icon>${t('nearbyDevices')}`;
        }
    });

    // Update drop zone text
    const dropZoneTexts = document.querySelectorAll('#drop-zone div');
    dropZoneTexts.forEach(text => {
        if (text.textContent.includes('Drop files here')) {
            text.textContent = t('dropFilesHere');
        } else if (text.textContent.includes('Support any file type')) {
            text.textContent = t('supportAnyFileType');
        }
    });

    // Update select files button
    const selectFilesBtn = document.getElementById('select-files-btn');
    if (selectFilesBtn) {
        selectFilesBtn.innerHTML = `<mdui-icon slot="icon" name="attach_file"></mdui-icon>${t('selectFiles')}`;
    }

    // Update manual connection form
    const manualPeerIdInput = document.getElementById('manual-peer-id');
    if (manualPeerIdInput) {
        manualPeerIdInput.setAttribute('label', t('deviceId'));
        manualPeerIdInput.setAttribute('placeholder', t('enterDeviceId'));
        manualPeerIdInput.setAttribute('helper', t('enterDeviceIdHelper'));
    }

    // Update manual connect button
    const manualConnectBtn = document.querySelector('mdui-button[onclick="connectToManualPeer()"]');
    if (manualConnectBtn) {
        manualConnectBtn.innerHTML = `<mdui-icon slot="icon" name="connect_without_contact"></mdui-icon>${t('connect')}`;
    }

    // Update no devices message
    const discoveryStatus = document.getElementById('discovery-status');
    if (discoveryStatus) {
        discoveryStatus.textContent = t('lookingForDevices');
    }

    const networkMessage = document.querySelector('#no-devices div[style*="font-size: 0.9rem"]');
    if (networkMessage && networkMessage.textContent.includes('Make sure')) {
        networkMessage.textContent = t('makeSureSameNetwork');
    }
}

function updateDialogs() {
    // Update file dialog
    const fileDialog = document.getElementById('file-dialog');
    if (fileDialog) {
        fileDialog.setAttribute('headline', t('incomingFile'));
    }

    // Update settings dialog
    const settingsDialog = document.getElementById('settings-dialog');
    if (settingsDialog) {
        settingsDialog.setAttribute('headline', t('settings'));

        // Update device name input
        const deviceNameInput = document.getElementById('device-name-input');
        if (deviceNameInput) {
            deviceNameInput.setAttribute('label', t('deviceName'));
            deviceNameInput.setAttribute('placeholder', 'Nhập tên thiết bị của bạn');
            deviceNameInput.setAttribute('helper', 'Tên này sẽ được hiển thị cho các thiết bị khác');
        }

        // Update auto-accept switch
        const autoAcceptSwitch = document.getElementById('auto-accept-switch');
        if (autoAcceptSwitch) {
            autoAcceptSwitch.textContent = t('autoAcceptFiles');
        }

        // Update sound notifications switch
        const soundSwitch = document.getElementById('sound-notifications-switch');
        if (soundSwitch) {
            soundSwitch.textContent = t('soundNotifications');
        }
    }

    // Update language dialog
    const languageDialog = document.getElementById('language-dialog');
    if (languageDialog) {
        languageDialog.setAttribute('headline', t('selectLanguage'));
    }

    // Update room dialog
    const roomDialog = document.getElementById('your-room-dialog');
    if (roomDialog) {
        roomDialog.setAttribute('headline', t('yourRoom'));
    }

    // Update join room dialog
    const joinRoomDialog = document.getElementById('join-room-dialog');
    if (joinRoomDialog) {
        joinRoomDialog.setAttribute('headline', t('joinRoom'));
    }

    // Update help dialog
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog) {
        helpDialog.setAttribute('headline', t('howToUsePairDrop'));
    }

    // Update file dialog buttons
    const acceptBtn = document.getElementById('accept-file-btn');
    if (acceptBtn) {
        acceptBtn.innerHTML = `<mdui-icon slot="icon" name="check"></mdui-icon>${t('acceptFile')}`;
    }

    const rejectBtn = document.getElementById('reject-file-btn');
    if (rejectBtn) {
        rejectBtn.innerHTML = `<mdui-icon slot="icon" name="close"></mdui-icon>${t('rejectFile')}`;
    }
}

function updateButtonsAndLabels() {
    // Update dialog action buttons
    const saveButtons = document.querySelectorAll('mdui-button[onclick="saveSettings()"]');
    saveButtons.forEach(btn => btn.textContent = t('save'));

    // Update all buttons with specific text content
    const allButtons = document.querySelectorAll('mdui-button');
    allButtons.forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        
        // Cancel buttons
        if (text.includes('cancel') || text.includes('hủy')) {
            btn.textContent = t('cancel');
        }
        // Close buttons
        else if (text.includes('close') || text.includes('đóng')) {
            btn.textContent = t('close');
        }
        // Join Room button
        else if (text.includes('join room') || text.includes('tham gia phòng')) {
            btn.innerHTML = `<mdui-icon slot="icon" name="login"></mdui-icon>${t('joinRoom')}`;
        }
        // Got it button
        else if (text.includes('got it') || text.includes('đã hiểu')) {
            btn.textContent = t('gotIt');
        }
        // Send button in connected devices
        else if (text === 'send' || text === 'gửi') {
            btn.innerHTML = `<mdui-icon slot="icon" name="send"></mdui-icon>${t('send')}`;
        }
    });

    // Update room button tooltip
    const roomBtn = document.getElementById('room-btn');
    if (roomBtn) {
        roomBtn.setAttribute('title', t('yourRoom'));
    }

    // Update loading text in room code
    const roomCodeDialog = document.getElementById('room-code-dialog');
    if (roomCodeDialog && roomCodeDialog.textContent.includes('Loading')) {
        roomCodeDialog.textContent = t('loading');
    }

    // Update "Send" text in connected devices list
    const sendButtons = document.querySelectorAll('mdui-button[onclick*="sendFilesToDevice"]');
    sendButtons.forEach(btn => {
        if (!btn.innerHTML.includes('mdui-icon')) {
            btn.innerHTML = `<mdui-icon slot="icon" name="send"></mdui-icon>${t('send')}`;
        }
    });
}

// Menu functions
function scrollToSection(sectionId) {
    navigationDrawer.open = false;

    const sections = {
        'home': 0,
        'devices': document.getElementById('devices')?.offsetTop || 0,
        'file-transfer': document.getElementById('file-transfer')?.offsetTop || 0
    };

    const targetPosition = sections[sectionId] || 0;
    window.scrollTo({
        top: targetPosition - 80, // Account for app bar height
        behavior: 'smooth'
    });
}



function openHelpDialog() {
    navigationDrawer.open = false;
    document.getElementById('help-dialog').open = true;
}

// Update local device display with current device information
function updateLocalDeviceDisplay() {
    const deviceNameElement = document.querySelector('.device-name');
    if (deviceNameElement && window.deviceInfo) {
        deviceNameElement.textContent = window.deviceInfo.name || 'Unknown Device';
    }

    // Update system info if the function exists
    if (typeof updateSystemInfoDisplay === 'function') {
        updateSystemInfoDisplay();
    }
}

// Export to global scope
window.updateUILanguage = updateUILanguage;
window.updateNavigationDrawer = updateNavigationDrawer;
window.updateMainContent = updateMainContent;
window.updateDialogs = updateDialogs;
window.updateButtonsAndLabels = updateButtonsAndLabels;
window.scrollToSection = scrollToSection;
window.openJoinRoomDialog = openJoinRoomDialog;
window.openHelpDialog = openHelpDialog;
window.updateLocalDeviceDisplay = updateLocalDeviceDisplay;
