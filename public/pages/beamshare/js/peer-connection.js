// Peer Connection Management
// Handles PeerJS connections and peer-to-peer communication

// Initialize PeerJS with fallback support
function initializePeer() {
    updateConnectionStatus('connecting', 'Initializing...');

    // Let PeerJS generate UUID for better compatibility
    peer = new Peer(PEER_CONFIG);
    setupPeerEventHandlers();
}

// Initialize PeerJS with fallback configuration
function initializePeerWithFallback() {
    if (peer && !peer.destroyed) {
        peer.destroy();
    }

    updateConnectionStatus('connecting', 'Trying fallback server...');

    // Use public PeerJS server as fallback
    const fallbackConfig = {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        },
        debug: 1
    };

    peer = new Peer(fallbackConfig);
    setupPeerEventHandlers();
}

// Setup peer event handlers (extracted to avoid duplication)
function setupPeerEventHandlers() {
    peer.on('open', (id) => {
        myId = id;
        if (myIdElement) {
            myIdElement.textContent = id;
        }
        isConnected = true;
        updateConnectionStatus('connected', 'Connected');

        console.log('PeerJS initialized with ID:', id);

        // Update server with PeerJS ID
        if (typeof updateServerWithPeerID === 'function') {
            updateServerWithPeerID(id);
        }

        // Generate and display room code
        currentRoomCode = generateRoomCode();
        updateRoomCodeDisplay();

        // Generate QR codes if functions exist
        if (typeof generateQRCode === 'function') {
            generateQRCode();
        }
        if (typeof generateQRCodeDialog === 'function') {
            generateQRCodeDialog();
        }

        showNotification('Connected successfully!', 'success');
    });

    peer.on('connection', (conn) => {
        handleIncomingConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);

        // Don't update status to error for peer-unavailable errors
        if (err.type !== 'peer-unavailable') {
            updateConnectionStatus('error', 'Connection error');
        }

        // More detailed error handling
        let errorMessage = 'Connection error';
        if (err.type === 'peer-unavailable') {
            errorMessage = 'Device not available or offline';
        } else if (err.type === 'network') {
            errorMessage = 'Network connection failed';
        } else if (err.type === 'server-error') {
            errorMessage = 'PeerJS server connection failed - using fallback';
            // Try to reinitialize with fallback config
            setTimeout(() => {
                console.log('Attempting fallback PeerJS initialization...');
                initializePeerWithFallback();
            }, 2000);
        } else if (err.type === 'socket-error') {
            errorMessage = 'Socket connection failed - retrying...';
            setTimeout(() => {
                console.log('Attempting fallback due to socket error...');
                initializePeerWithFallback();
            }, 3000);
        } else if (err.type === 'unavailable-id') {
            errorMessage = 'ID already taken, reconnecting...';
            // Try to reconnect with new ID
            setTimeout(() => {
                if (peer.destroyed) {
                    initializePeer();
                }
            }, 1000);
            return;
        } else if (err.message) {
            errorMessage = err.message;
        }

        showNotification(errorMessage, 'error');
    });

    peer.on('disconnected', () => {
        console.log('PeerJS disconnected');
        updateConnectionStatus('connecting', 'Reconnecting...');

        // Try to reconnect
        setTimeout(() => {
            if (!peer.destroyed && !peer.open) {
                console.log('Attempting to reconnect...');
                peer.reconnect();
            }
        }, 1000);
    });
}

function handleIncomingConnection(conn) {
    connections.set(conn.peer, conn);
    
    conn.on('open', () => {
        console.log('Incoming connection opened:', conn.peer);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();

        // Send device info
        const currentDeviceInfo = window.deviceInfo || getDeviceInfo();
        conn.send({
            type: DataType.DEVICE_INFO,
            deviceInfo: currentDeviceInfo
        });
    });

    conn.on('data', (data) => {
        handleIncomingData(conn, data);
    });

    conn.on('close', () => {
        connections.delete(conn.peer);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
    });

    conn.on('error', (err) => {
        console.error('Connection error:', err);
        connections.delete(conn.peer);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
    });
}

function handleIncomingData(conn, data) {
    switch (data.type) {
        case DataType.DEVICE_INFO:
            conn.metadata = { deviceInfo: data.deviceInfo };
            updateDeviceGrid();
            updateConnectedDevicesDisplay();
            break;

        case DataType.DEVICE_INFO_UPDATE:
            // Update device info for connected peer
            conn.metadata = { deviceInfo: data.deviceInfo };
            console.log('Received device info update from peer:', conn.peer, data.deviceInfo);

            // Update nearby devices if this peer is in the list
            if (nearbyDevices && nearbyDevices.has(conn.peer)) {
                const deviceInfo = nearbyDevices.get(conn.peer);
                deviceInfo.name = data.deviceInfo.name || 'Unknown Device';
                deviceInfo.type = data.deviceInfo.type || 'desktop';
                deviceInfo.browser = data.deviceInfo.browser || 'Browser';
                deviceInfo.lastSeen = Date.now();
            }

            updateDeviceGrid();
            updateConnectedDevicesDisplay();
            break;

        case DataType.DISCOVERY_BROADCAST:
            handleDiscoveryBroadcast(conn, data);
            break;

        case DataType.DISCOVERY_RESPONSE:
            handleDiscoveryResponse(conn, data);
            break;

        case DataType.PING:
            handlePing(conn, data);
            break;

        case DataType.PONG:
            handlePong(conn, data);
            break;

        case DataType.FILE_METADATA:
            handleFileMetadata(conn, data);
            break;

        case DataType.FILE_CHUNK:
            handleFileChunk(conn, data);
            break;

        case DataType.FILE_END:
            handleFileEnd(conn, data);
            break;

        case DataType.FILE_ACCEPT:
            handleFileAccept(conn, data);
            break;

        case DataType.FILE_REJECT:
            handleFileReject(conn, data);
            break;
    }
}

// Discovery protocol handlers
function handleDiscoveryBroadcast(conn, data) {
    // Respond with our device info
    conn.send({
        type: DataType.DISCOVERY_RESPONSE,
        deviceInfo: deviceInfo
    });
}

function handleDiscoveryResponse(conn, data) {
    // Add device to nearby devices if not already connected
    if (!connections.has(conn.peer)) {
        nearbyDevices.set(conn.peer, data.deviceInfo);
        lastSeen.set(conn.peer, Date.now());
        updateDeviceGrid();
    }
}

function handlePing(conn, data) {
    // Respond to ping
    conn.send({
        type: DataType.PONG,
        timestamp: data.timestamp
    });
}

function handlePong(conn, data) {
    // Handle pong response (for latency measurement)
    const latency = Date.now() - data.timestamp;
    console.log(`Latency to ${conn.peer}: ${latency}ms`);
}

// Connection management
function connectToNearbyDevice(peerId) {
    console.log('Attempting to connect to nearby device:', peerId);

    if (!peer || peer.destroyed) {
        showNotification('PeerJS not initialized', 'error');
        return;
    }

    if (!peer.open) {
        showNotification('PeerJS not ready yet, please wait...', 'warning');
        return;
    }

    // Get device info from nearby devices
    const deviceInfo = nearbyDevices.get(peerId);
    if (!deviceInfo) {
        showNotification('Device not found in nearby devices', 'error');
        return;
    }

    // Use PeerJS ID if available, otherwise fall back to WebSocket ID
    const targetPeerJSId = deviceInfo.peerJSId || peerId;
    const deviceName = deviceInfo?.name || 'Unknown Device';

    console.log('Connecting to device:', {
        webSocketId: peerId,
        peerJSId: targetPeerJSId,
        deviceName: deviceName
    });

    if (targetPeerJSId === myId || targetPeerJSId === window.myPeerJSId) {
        showNotification('Cannot connect to yourself');
        return;
    }

    if (connections.has(targetPeerJSId)) {
        showNotification('Already connected to this device');
        return;
    }

    if (!deviceInfo.peerJSId) {
        showNotification('Device PeerJS ID not available yet, please wait...', 'warning');
        return;
    }

    showNotification(t('connectingTo', { deviceName }));

    // Auto-fill manual connection field with the PeerJS ID
    const manualPeerIdInput = document.getElementById('manual-peer-id');
    if (manualPeerIdInput) {
        manualPeerIdInput.value = targetPeerJSId;
    }

    const currentDeviceInfo = window.deviceInfo || getDeviceInfo();
    const conn = peer.connect(targetPeerJSId, {
        metadata: { deviceInfo: currentDeviceInfo }
    });

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
        if (conn && !connections.has(targetPeerJSId)) {
            conn.close();
            showNotification(`Connection to ${deviceName} timed out`, 'error');
        }
    }, 10000); // 10 second timeout

    conn.on('open', () => {
        console.log('Connection opened to:', targetPeerJSId);
        console.log('Current connections before adding:', Array.from(connections.keys()));
        clearTimeout(connectionTimeout); // Clear timeout on successful connection
        connections.set(targetPeerJSId, conn);
        console.log('Current connections after adding:', Array.from(connections.keys()));
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
        showNotification(`Connected to ${deviceName}!`, 'success');

        // Add to persistent connections (always enabled)
        if (typeof addPersistentConnection === 'function') {
            addPersistentConnection(targetPeerJSId, deviceInfo);
        }

        // Notify persistent connection system
        if (typeof onConnectionEstablished === 'function') {
            onConnectionEstablished(targetPeerJSId, deviceInfo);
        }

        // Send device info
        conn.send({
            type: DataType.DEVICE_INFO,
            deviceInfo: currentDeviceInfo
        });

        // Keep device in nearby devices but update UI to show connected state
        // nearbyDevices.delete(peerId); // Don't remove - keep for connect/disconnect

        // Update UI to show connected devices
        updateConnectedDevicesDisplay();
    });

    conn.on('data', (data) => {
        handleIncomingData(conn, data);
    });

    conn.on('close', () => {
        console.log('Connection closed to:', targetPeerJSId);
        connections.delete(targetPeerJSId);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
        showNotification(t('disconnectedFrom', { deviceName }));

        // Notify persistent connection system about connection loss
        if (typeof onConnectionLost === 'function') {
            onConnectionLost(targetPeerJSId);
        }
    });

    conn.on('error', (err) => {
        console.error('Connection error to', targetPeerJSId, ':', err);
        clearTimeout(connectionTimeout); // Clear timeout on error

        // More detailed error handling
        let errorMessage = `Failed to connect to ${deviceName}`;
        if (err.type === 'peer-unavailable') {
            errorMessage = `${deviceName} is not available or offline`;
        } else if (err.type === 'network') {
            errorMessage = `Network error connecting to ${deviceName}`;
        } else if (err.type === 'server-error') {
            errorMessage = 'Server connection failed';
        } else if (err.type === 'disconnected') {
            errorMessage = `Connection to ${deviceName} was disconnected`;
        }

        showNotification(errorMessage, 'error');
    });
}

function connectToManualPeer() {
    console.log('Attempting manual connection...');

    if (!peer || peer.destroyed) {
        showNotification('PeerJS not initialized', 'error');
        return;
    }

    if (!peer.open) {
        showNotification('PeerJS not ready yet, please wait...', 'warning');
        return;
    }

    const manualPeerIdInput = document.getElementById('manual-peer-id');
    const peerId = manualPeerIdInput.value.trim();
    if (!peerId) {
        showNotification('Please enter a device ID to connect');
        return;
    }

    if (peerId === myId) {
        showNotification('Cannot connect to yourself');
        return;
    }

    if (connections.has(peerId)) {
        showNotification('Already connected to this device');
        return;
    }

    showNotification(`Connecting to device ${peerId}...`);

    const currentDeviceInfo = window.deviceInfo || getDeviceInfo();
    const conn = peer.connect(peerId, {
        metadata: { deviceInfo: currentDeviceInfo }
    });

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
        if (conn && !connections.has(peerId)) {
            conn.close();
            showNotification(`Connection to ${peerId} timed out`, 'error');
        }
    }, 10000); // 10 second timeout

    conn.on('open', () => {
        clearTimeout(connectionTimeout); // Clear timeout on successful connection
        connections.set(peerId, conn);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
        manualPeerIdInput.value = '';
        showNotification('Connected successfully!', 'success');

        // Add to persistent connections (always enabled)
        if (typeof addPersistentConnection === 'function') {
            const deviceInfo = { name: `Device ${peerId.substring(0, 8)}`, type: 'unknown' };
            addPersistentConnection(peerId, deviceInfo);
        }

        // Notify persistent connection system
        if (typeof onConnectionEstablished === 'function') {
            const deviceInfo = { name: `Device ${peerId.substring(0, 8)}`, type: 'unknown' };
            onConnectionEstablished(peerId, deviceInfo);
        }

        // Send device info
        conn.send({
            type: DataType.DEVICE_INFO,
            deviceInfo: currentDeviceInfo
        });
    });

    conn.on('data', (data) => {
        handleIncomingData(conn, data);
    });

    conn.on('close', () => {
        connections.delete(peerId);
        updateDeviceGrid();
        updateConnectedDevicesList();
        updateConnectedDevicesDisplay();
        showNotification('Device disconnected');

        // Notify persistent connection system about connection loss
        if (typeof onConnectionLost === 'function') {
            onConnectionLost(peerId);
        }
    });

    conn.on('error', (err) => {
        console.error('Manual connection error:', err);

        // More detailed error handling
        let errorMessage = `Failed to connect to device ${peerId}`;
        if (err.type === 'peer-unavailable') {
            errorMessage = `Device ${peerId} is not available or offline`;
        } else if (err.type === 'network') {
            errorMessage = `Network error connecting to ${peerId}`;
        } else if (err.type === 'server-error') {
            errorMessage = 'Server connection failed';
        }

        showNotification(errorMessage, 'error');
    });
}

function disconnectPeer(peerId) {
    console.log('Disconnecting from peer:', peerId);

    // Check if this is a WebSocket ID (from nearby devices) or PeerJS ID (from manual connection)
    let targetPeerJSId = peerId;
    let deviceName = 'Device';

    // If this is a WebSocket ID, get the corresponding PeerJS ID
    const deviceInfo = nearbyDevices.get(peerId);
    if (deviceInfo && deviceInfo.peerJSId) {
        targetPeerJSId = deviceInfo.peerJSId;
        deviceName = deviceInfo.name || 'Device';
        console.log('Converting WebSocket ID to PeerJS ID:', {
            webSocketId: peerId,
            peerJSId: targetPeerJSId,
            deviceName: deviceName
        });
    }

    // Try to find connection by PeerJS ID
    const conn = connections.get(targetPeerJSId);
    if (conn) {
        console.log('Closing connection to:', targetPeerJSId);
        conn.close();
        connections.delete(targetPeerJSId);
        showNotification(`Disconnected from ${deviceName}`, 'success');
    } else {
        // If not found by PeerJS ID, try the original ID (for manual connections)
        const fallbackConn = connections.get(peerId);
        if (fallbackConn) {
            console.log('Closing fallback connection to:', peerId);
            fallbackConn.close();
            connections.delete(peerId);
            showNotification(`Disconnected from ${deviceName}`, 'success');
        } else {
            console.warn('No connection found for peer:', peerId, 'or PeerJS ID:', targetPeerJSId);
            showNotification('Device was not connected', 'warning');
        }
    }

    // Keep device in nearby devices for reconnection
    // Device will show as available again in the UI
    updateDeviceGrid();
    updateConnectedDevicesList();
    updateConnectedDevicesDisplay();
}

function updateConnectedDevicesList() {
    peerList.innerHTML = '';

    if (connections.size === 0) {
        connectedDevicesCard.style.display = 'none';
        return;
    }

    connectedDevicesCard.style.display = 'block';

    connections.forEach((conn, peerId) => {
        const deviceInfo = conn.metadata?.deviceInfo;
        if (!deviceInfo) return;

        const listItem = document.createElement('div');
        listItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            margin: 8px 0;
            background: #f5f5f5;
            border-radius: 8px;
            gap: 12px;
        `;

        const iconName = deviceInfo.type === 'mobile' ? 'smartphone' : 'computer';

        listItem.innerHTML = `
            <mdui-icon name="${iconName}" style="color: var(--primary-color);"></mdui-icon>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${deviceInfo.name}</div>
                <div style="font-size: 0.9rem; color: #666;">${peerId}</div>
            </div>
            <mdui-button variant="outlined" onclick="sendFilesToDevice('${peerId}')" style="--mdui-color-primary: #2196f3;">
                <mdui-icon slot="icon" name="send"></mdui-icon>
                ${t('send')}
            </mdui-button>
            <mdui-button-icon icon="close" onclick="disconnectPeer('${peerId}')" style="--mdui-color-primary: #2196f3;"></mdui-button-icon>
        `;

        peerList.appendChild(listItem);
    });
}

// New function to update connected devices display
function updateConnectedDevicesDisplay() {
    const connectedDevicesCard = document.getElementById('connected-devices-card');
    const peerList = document.getElementById('peer-list');
    const connectedCount = document.getElementById('connected-count');

    if (!connectedDevicesCard || !peerList) return;

    // Clear existing content
    peerList.innerHTML = '';

    // Update connected count
    if (connectedCount) {
        connectedCount.innerHTML = `
            <mdui-icon slot="icon" name="check_circle"></mdui-icon>
            ${connections.size} connected
        `;
    }

    if (connections.size === 0) {
        connectedDevicesCard.style.display = 'none';
        return;
    }

    // Show the connected devices card
    connectedDevicesCard.style.display = 'block';

    // Add each connected device
    connections.forEach((conn, peerId) => {
        const deviceInfo = conn.metadata?.deviceInfo || { name: 'Unknown Device', type: 'desktop' };

        const deviceItem = document.createElement('div');
        deviceItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background: white;
            border-radius: 12px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 2px solid #4caf50;
        `;

        const iconName = deviceInfo.type === 'mobile' ? 'smartphone' : 'computer';

        deviceItem.innerHTML = `
            <div style="
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 1.5rem;
            ">
                <mdui-icon name="${iconName}"></mdui-icon>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 500; font-size: 1.1rem; color: #333;">${deviceInfo.name}</div>
                <div style="font-size: 0.9rem; color: #666; font-family: monospace;">${peerId}</div>
                <div style="font-size: 0.8rem; color: #4caf50; font-weight: 500; margin-top: 2px;">
                    <mdui-icon name="check_circle" style="font-size: 0.9rem; margin-right: 4px;"></mdui-icon>
                    Connected
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <mdui-button variant="filled" onclick="sendFilesToDevice('${peerId}')" style="--mdui-color-primary: #2196f3; background-color: #2196f3; color: white;">
                    <mdui-icon slot="icon" name="send"></mdui-icon>
                    Send Files
                </mdui-button>
                <mdui-button-icon icon="close" onclick="disconnectPeer('${peerId}')" style="--mdui-color-primary: #f44336; color: #f44336;" title="Disconnect"></mdui-button-icon>
            </div>
        `;

        peerList.appendChild(deviceItem);
    });
}

// Export to global scope
window.initializePeer = initializePeer;
window.initializePeerWithFallback = initializePeerWithFallback;
window.handleIncomingConnection = handleIncomingConnection;
window.handleIncomingData = handleIncomingData;
window.connectToNearbyDevice = connectToNearbyDevice;
window.connectToManualPeer = connectToManualPeer;
window.disconnectPeer = disconnectPeer;
window.updateConnectedDevicesList = updateConnectedDevicesList;
window.updateConnectedDevicesDisplay = updateConnectedDevicesDisplay;
