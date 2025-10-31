// Event Handlers
// Centralized event listener setup and management

function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');

    // File input and drag & drop events
    setupFileEvents();
    
    // Navigation and UI events
    setupNavigationEvents();
    
    // Room and connection events
    setupRoomEvents();
    
    // Settings events
    setupSettingsEvents();
    
    // File dialog events
    setupFileDialogEvents();

    console.log('✅ Event listeners setup complete');
}

function setupFileEvents() {
    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }

    // Drop zone events
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });

        dropZone.addEventListener('click', (e) => {
            // Only trigger file input if clicking on the drop zone itself, not on child elements
            if (e.target === dropZone || e.target.closest('#select-files-btn') === null) {
                fileInput.click();
            }
        });
    }

    // Select files button
    const selectFilesBtn = document.getElementById('select-files-btn');
    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to drop zone
            fileInput.click();
        });
    }
}

function setupNavigationEvents() {
    // Menu button
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            navigationDrawer.open = true;
        });
    }

    // Room button
    const roomBtn = document.getElementById('room-btn');
    if (roomBtn) {
        roomBtn.addEventListener('click', () => {
            document.getElementById('your-room-dialog').open = true;
        });
    }

    // Settings and language buttons
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            document.getElementById('settings-dialog').open = true;
        });
    }

    const languageBtn = document.getElementById('language-btn');
    if (languageBtn) {
        languageBtn.addEventListener('click', () => {
            document.getElementById('language-dialog').open = true;
        });
    }
}

function setupRoomEvents() {
    // Join Room (dialog)
    const joinRoomBtnDialog = document.getElementById('join-room-btn-dialog');
    const joinRoomInputDialog = document.getElementById('join-room-code-dialog');
    if (joinRoomBtnDialog && joinRoomInputDialog) {
        joinRoomBtnDialog.addEventListener('click', () => {
            const roomCode = joinRoomInputDialog.value.trim();
            if (roomCode) {
                joinRoomByCode(roomCode);
                // Close the dialog
                document.getElementById('join-room-dialog').open = false;
            }
        });
        joinRoomInputDialog.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const roomCode = joinRoomInputDialog.value.trim();
                if (roomCode) {
                    joinRoomByCode(roomCode);
                    // Close the dialog
                    document.getElementById('join-room-dialog').open = false;
                }
            }
        });
    }
    // Room code buttons (dialog)
    const copyRoomCodeDialog = document.getElementById('copy-room-code-dialog');
    if (copyRoomCodeDialog) {
        copyRoomCodeDialog.addEventListener('click', () => {
            // Use the room manager copy function
            if (typeof copyRoomCode === 'function') {
                copyRoomCode();
            } else {
                // Fallback to direct clipboard copy
                navigator.clipboard.writeText(currentRoomCode);
                showNotification(t('roomCodeCopied'));
            }
        });
    }

    const refreshRoomDialog = document.getElementById('refresh-room-dialog');
    if (refreshRoomDialog) {
        refreshRoomDialog.addEventListener('click', () => {
            // Use the new public room creation functionality
            if (typeof createPublicRoom === 'function') {
                createPublicRoom();
            } else {
                // Fallback to local room generation
                currentRoomCode = generateRoomCode();
                updateRoomCodeDisplay();
                generateQRCode();
                generateQRCodeDialog();
                showNotification(t('newRoomGenerated'));
            }
        });
    }

    // Manual peer connection
    const manualInput = document.getElementById('manual-peer-id');
    if (manualInput) {
        manualInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                connectToManualPeer();
            }
        });
    }
}

function setupSettingsEvents() {
    // Settings save functionality is handled by global functions
    // but we can add additional validation here if needed
    
    const deviceNameInput = document.getElementById('device-name-input');
    if (deviceNameInput) {
        deviceNameInput.addEventListener('input', (e) => {
            // Real-time validation or preview could go here
            const value = e.target.value.trim();
            if (value.length > 50) {
                e.target.value = value.substring(0, 50);
            }
        });
    }
}

function setupFileDialogEvents() {
    // File dialog buttons
    if (acceptFileBtn) {
        acceptFileBtn.addEventListener('click', () => {
            if (pendingFileTransfer) {
                acceptFile();
            }
        });
    }

    if (rejectFileBtn) {
        rejectFileBtn.addEventListener('click', () => {
            if (pendingFileTransfer) {
                rejectFile();
            }
        });
    }
}

function buildFileSizeLimitMessage(limitLabel, rejectedCount) {
    const labelText = limitLabel || (window.BeamshareRuntimeLimits?.fileSizeLimitBytes
        ? formatFileSize(window.BeamshareRuntimeLimits.fileSizeLimitBytes)
        : null);
    if (rejectedCount === 1) {
        return labelText
            ? `File bạn chọn vượt quá giới hạn ${labelText} của gói hiện tại.`
            : 'File bạn chọn vượt quá giới hạn cho gói hiện tại.';
    }
    return labelText
        ? `${rejectedCount} file vượt quá giới hạn ${labelText} của gói hiện tại.`
        : `${rejectedCount} file vượt quá giới hạn cho gói hiện tại.`;
}

function filterFilesByLimit(files) {
    const limits = window.BeamshareRuntimeLimits || {};
    const limitBytes = Number(limits.fileSizeLimitBytes);
    if (!Number.isFinite(limitBytes) || limitBytes <= 0) {
        return files;
    }

    const allowed = [];
    let rejectedCount = 0;

    files.forEach((file) => {
        if (file.size <= limitBytes) {
            allowed.push(file);
        } else {
            rejectedCount += 1;
        }
    });

    if (rejectedCount > 0 && typeof showNotification === 'function') {
        showNotification(buildFileSizeLimitMessage(limits.fileSizeLimitLabel, rejectedCount), 'error');
    }

    return allowed;
}

// File handling functions
function handleFileSelection(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

function handleFiles(files) {
    const sanitizedFiles = filterFilesByLimit(files || []);
    selectedFiles = sanitizedFiles;

    if (fileInput) {
        if (typeof DataTransfer !== 'undefined') {
            const dt = new DataTransfer();
            sanitizedFiles.forEach((file) => dt.items.add(file));
            fileInput.files = dt.files;
        } else if (sanitizedFiles.length === 0) {
            fileInput.value = '';
        }
    }

    displaySelectedFiles();

    if (sanitizedFiles.length > 0 && connections.size > 0) {
        showNotification(`${sanitizedFiles.length} ${t('filesSelected')}. ${t('clickDeviceToSend')}.`);
    } else if (sanitizedFiles.length > 0) {
        showNotification(`${sanitizedFiles.length} ${t('filesSelected')}. ${t('waitingForDevices')}`);
    } else if ((files || []).length > 0) {
        showNotification(t('pleaseSelectFiles'), 'warning');
    }
}

function displaySelectedFiles() {
    if (!fileList) return;
    
    fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            margin: 8px 0;
            background: #f5f5f5;
            border-radius: 8px;
            gap: 12px;
        `;

        const icon = getFileIcon(file.type);
        const size = formatFileSize(file.size);

        fileItem.innerHTML = `
            <mdui-icon name="${icon}" style="color: var(--primary-color);"></mdui-icon>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${file.name}</div>
                <div style="font-size: 0.9rem; color: #666;">${size}</div>
            </div>
            <mdui-button-icon icon="close" onclick="removeFile(${index})" style="--mdui-color-primary: #2196f3;"></mdui-button-icon>
        `;

        fileList.appendChild(fileItem);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();

    // Update file input
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
}

function selectDevice(peerId) {
    // Remove previous selection
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked device
    event.currentTarget.classList.add('selected');
    
    if (selectedFiles.length > 0) {
        sendFilesToDevice(peerId);
    } else {
        showNotification(t('pleaseSelectFiles'));
    }
}

// Settings functions
function saveSettings() {
    try {
        const deviceNameInput = document.getElementById('device-name-input');
        const deviceName = deviceNameInput ? deviceNameInput.value.trim() : '';

        // Check if device name has changed
        const oldDeviceName = window.deviceInfo ? window.deviceInfo.name : '';
        const deviceNameChanged = deviceName && deviceName !== oldDeviceName;

        if (deviceName) {
            localStorage.setItem('device_name', deviceName);

            if (window.deviceInfo) {
                window.deviceInfo.name = deviceName;
            }

            // If device name changed, notify server and other devices
            if (deviceNameChanged) {
                updateDeviceNameRealtime(deviceName);
            }
        }

        // Save auto-accept setting
        const autoAcceptSwitch = document.getElementById('auto-accept-switch');
        if (autoAcceptSwitch) {
            // For MDUI switches, we need to check the 'checked' property
            const autoAccept = autoAcceptSwitch.checked || autoAcceptSwitch.hasAttribute('checked');
            localStorage.setItem('auto_accept_files', autoAccept.toString());
        }

        // Save sound notifications setting
        const soundSwitch = document.getElementById('sound-notifications-switch');
        if (soundSwitch) {
            // For MDUI switches, we need to check the 'checked' property
            const soundNotifications = soundSwitch.checked || soundSwitch.hasAttribute('checked');
            localStorage.setItem('sound_notifications', soundNotifications.toString());
        }





        // Show success notification
        if (typeof showNotification === 'function') {
            if (typeof t === 'function') {
                showNotification(t('settingsSaved'), 'success');
            } else {
                showNotification('Settings saved!', 'success');
            }
        }

        // Close settings dialog
        const settingsDialog = document.getElementById('settings-dialog');
        if (settingsDialog) {
            settingsDialog.open = false;
        }

    } catch (error) {
        console.error('Error in saveSettings():', error);
        if (typeof showNotification === 'function') {
            showNotification('Error saving settings: ' + error.message, 'error');
        } else {
            alert('Error saving settings: ' + error.message);
        }
    }
}

// Function to update device name in real-time
function updateDeviceNameRealtime(newDeviceName) {
    // Update local device info
    if (window.deviceInfo) {
        window.deviceInfo.name = newDeviceName;
    }

    // Send updated device info to signaling server
    if (window.signalingSocket && window.signalingSocket.readyState === WebSocket.OPEN) {
        window.signalingSocket.send(JSON.stringify({
            type: 'device-info-update',
            deviceInfo: window.deviceInfo || getDeviceInfo()
        }));
        console.log('Sent device name update to server:', newDeviceName);
    }

    // Update device info with connected peers via PeerJS
    if (window.connections) {
        window.connections.forEach((conn, peerId) => {
            if (conn && conn.open) {
                conn.send({
                    type: 'DEVICE_INFO_UPDATE',
                    deviceInfo: window.deviceInfo || getDeviceInfo()
                });
                console.log('Sent device name update to peer:', peerId);
            }
        });
    }

    // Update local UI to show new device name
    updateLocalDeviceDisplay();
}

// Function to update local device display
function updateLocalDeviceDisplay() {
    // Update "Your Device" card
    const deviceNameElement = document.querySelector('.device-card .device-name');
    if (deviceNameElement && window.deviceInfo) {
        deviceNameElement.textContent = window.deviceInfo.name;
    }

    // Update device name input in settings dialog to reflect current value
    const deviceNameInput = document.getElementById('device-name-input');
    if (deviceNameInput && window.deviceInfo) {
        deviceNameInput.value = window.deviceInfo.name;
    }

    // Update any other places where device name is displayed
    const deviceNameDisplays = document.querySelectorAll('[data-device-name]');
    deviceNameDisplays.forEach(element => {
        if (window.deviceInfo) {
            element.textContent = window.deviceInfo.name;
        }
    });
}



// Export to global scope
window.setupEventListeners = setupEventListeners;
window.handleFileSelection = handleFileSelection;
window.handleFiles = handleFiles;
window.displaySelectedFiles = displaySelectedFiles;
window.removeFile = removeFile;
window.selectDevice = selectDevice;
window.saveSettings = saveSettings;
window.updateDeviceNameRealtime = updateDeviceNameRealtime;
window.updateLocalDeviceDisplay = updateLocalDeviceDisplay;
window.filterFilesByLimit = filterFilesByLimit;

// Join Room Dialog function
function openJoinRoomDialog() {
    document.getElementById('join-room-dialog').open = true;
}

window.openJoinRoomDialog = openJoinRoomDialog;

