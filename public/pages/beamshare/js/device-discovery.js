// Device Discovery System
// Handles nearby device discovery and signaling server communication
// Based on PairDrop's approach using WebSocket for peer management

// Device Discovery Functions
function startDeviceDiscovery() {
    console.log('Starting device discovery...');

    // Connect to signaling server
    connectToSignalingServer();

    // Start periodic cleanup of old devices
    discoveryInterval = setInterval(() => {
        cleanupOldDevices();
        // No need to manually request devices - server will send updates
    }, DISCOVERY_INTERVAL);

    // Join IP room for local network discovery
    setTimeout(() => {
        joinIPRoom();
    }, 1000);
}

function stopDeviceDiscovery() {
    if (discoveryInterval) {
        clearInterval(discoveryInterval);
        discoveryInterval = null;
    }

    if (signalingSocket) {
        signalingSocket.close();
        signalingSocket = null;
    }
}

function connectToSignalingServer() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to signaling server:', wsUrl);

    signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = () => {
        console.log('Connected to signaling server');

        // Reset reconnection attempts on successful connection
        reconnectAttempts = 0;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        updateDiscoveryStatus();

        // Join IP room for local network discovery automatically
        // The server will handle device info during connection
        setTimeout(() => {
            joinIPRoom();
        }, 100);
    };

    signalingSocket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleSignalingMessage(message);
        } catch (error) {
            console.error('Error parsing signaling message:', error);
        }
    };

    signalingSocket.onclose = (event) => {
        console.log('Disconnected from signaling server', event.code, event.reason);
        signalingSocket = null;

        // Clear all nearby devices when disconnected
        nearbyDevices.clear();
        updateDeviceGrid();
        updateDiscoveryStatus();

        // Implement exponential backoff for reconnection
        const reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Attempting to reconnect in ${reconnectDelay}ms (attempt ${reconnectAttempts + 1})`);

        reconnectTimeout = setTimeout(() => {
            if (!signalingSocket || signalingSocket.readyState === WebSocket.CLOSED) {
                reconnectAttempts++;
                connectToSignalingServer();
            }
        }, reconnectDelay);
    };

    signalingSocket.onerror = (error) => {
        console.error('Signaling server error:', error);
    };
}

function joinIPRoom() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'join-ip-room'
        }));
        console.log('Joined IP room for local network discovery');
    }
}

function updateServerWithPeerID(peerId) {
    // Store the PeerJS ID and send it to server for proper ID mapping
    console.log('PeerJS ID available:', peerId);

    // Store our PeerJS ID globally
    window.myPeerJSId = peerId;

    // Send PeerJS ID to server so other clients can use it for connections
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'peerjs-id-update',
            peerJSId: peerId
        }));

        // Request updated peers list to ensure we have the latest information
        signalingSocket.send(JSON.stringify({
            type: 'request-devices'
        }));
    }
}

function handleSignalingMessage(message) {
    switch (message.type) {
        case 'peers':
            // Handle peers list from server (PairDrop style)
            updatePeersList(message);
            break;

        case 'peer-joined':
            console.log('New peer joined:', message.peer);
            addPeerToNearbyDevices(message.peer, message.roomType);


            break;

        case 'peer-left':
            console.log('Peer left:', message.peerId);
            // Remove from nearby devices immediately for better UX
            nearbyDevices.delete(message.peerId);
            // Remove from connections if connected
            if (connections && connections.has(message.peerId)) {
                connections.delete(message.peerId);
            }
            updateDeviceGrid();
            updateConnectedDevicesDisplay();
            break;

        case 'peer-info-updated':
            console.log('Peer info updated:', message.peer.id, message.peer.name);
            // Update the device info in nearby devices
            const existingDevice = nearbyDevices.get(message.peer.id);
            if (existingDevice) {
                existingDevice.name = message.peer.name || message.peer.displayName || 'Unknown Device';
                existingDevice.type = message.peer.deviceType || message.peer.type || 'desktop';
                existingDevice.browser = message.peer.browser || 'Browser';
                existingDevice.lastSeen = Date.now();
                updateDeviceGrid();
                console.log('Updated device info for:', message.peer.id);
            }
            break;

        case 'peerjs-id-updated':
            console.log('PeerJS ID updated for peer:', message.peerId, 'PeerJS ID:', message.peerJSId);
            // Update the PeerJS ID for the device
            const device = nearbyDevices.get(message.peerId);
            if (device) {
                device.peerJSId = message.peerJSId;
                console.log('Updated PeerJS ID for device:', message.peerId, 'to:', message.peerJSId);
            }
            break;

        case 'display-name':
            // Store server peer ID and device information
            myId = message.peerId;
            console.log('Received peer info:', {
                id: message.peerId,
                displayName: message.displayName,
                deviceName: message.deviceName
            });

            // Initialize PeerJS without specific ID (let it generate UUID)
            if (typeof initializePeer === 'function') {
                initializePeer(); // No ID parameter - let PeerJS generate UUID
            }
            break;

        case 'ping':
            // Respond to keep-alive ping
            if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
                signalingSocket.send(JSON.stringify({ type: 'pong' }));
            }
            break;

        // Public room message handlers
        case 'public-room-created':
            console.log('Public room created:', message.roomId);
            if (typeof handlePublicRoomCreated === 'function') {
                handlePublicRoomCreated(message.roomId);
            }
            break;

        case 'public-room-joined':
            console.log('Public room joined:', message.roomId, 'members:', message.members);
            if (typeof handlePublicRoomJoined === 'function') {
                handlePublicRoomJoined(message.roomId, message.members);
            }
            break;

        case 'public-room-left':
            console.log('Public room left');
            if (typeof handlePublicRoomLeft === 'function') {
                handlePublicRoomLeft();
            }
            break;

        // Legacy support for old message types
        case 'nearby-devices':
        case 'device-list-updated':
            updateNearbyDevices(message.devices);
            break;
    }
}

function updatePeersList(message) {
    console.log('Received peers list:', message);

    // Add peers from the message (don't clear existing ones to avoid flicker)
    if (message.peers && Array.isArray(message.peers)) {
        message.peers.forEach(peer => {
            addPeerToNearbyDevices(peer, message.roomType || 'ip');
        });
    }

    updateDeviceGrid();
    console.log(`Updated peers list: ${nearbyDevices.size} devices found`);
}

function addPeerToNearbyDevices(peer, roomType) {
    if (!peer || !peer.id || peer.id === myId) {
        return;
    }

    const deviceInfo = {
        name: peer.name?.displayName || peer.name?.deviceName || peer.displayName || peer.name || 'Unknown Device',
        type: peer.name?.type || peer.deviceType || peer.type || 'desktop',
        browser: peer.name?.browser || peer.browser || 'Browser',
        os: peer.name?.os || peer.os || 'Unknown',
        roomType: roomType,
        lastSeen: Date.now(),
        offline: false, // Mark as online
        peerJSId: peer.peerJSId || null // Store PeerJS ID if available
    };

    nearbyDevices.set(peer.id, deviceInfo);
    lastSeen.set(peer.id, Date.now());

    console.log('Added nearby device:', peer.id, deviceInfo);
}

function updateNearbyDevices(devices) {
    const now = Date.now();

    // Clear old devices
    nearbyDevices.clear();

    // Add new devices (legacy support)
    if (Array.isArray(devices)) {
        devices.forEach(({ peerId, deviceInfo }) => {
            if (peerId !== myId && !connections.has(peerId)) {
                nearbyDevices.set(peerId, deviceInfo);
                lastSeen.set(peerId, now);
            }
        });
    }

    updateDeviceGrid();
    console.log(`Found ${nearbyDevices.size} nearby devices`);
}

function requestNearbyDevices() {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'request-devices'
        }));
    }
}

function cleanupOldDevices() {
    const now = Date.now();
    let removedCount = 0;

    // Remove devices that haven't been seen for too long
    for (const [peerId, lastSeenTime] of lastSeen.entries()) {
        const deviceInfo = nearbyDevices.get(peerId);

        // For offline devices, wait longer before removing
        const timeout = deviceInfo?.offline ? DEVICE_TIMEOUT * 3 : DEVICE_TIMEOUT;

        if (now - lastSeenTime > timeout) {
            nearbyDevices.delete(peerId);
            lastSeen.delete(peerId);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} old devices`);
        updateDeviceGrid();
    }
}

function updateDiscoveryStatus() {
    if (!discoveryStatus || !discoveryProgress) return;

    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        discoveryStatus.textContent = t('lookingForDevices');
        discoveryProgress.style.display = 'block';
    } else if (signalingSocket && signalingSocket.readyState === WebSocket.CONNECTING) {
        discoveryStatus.textContent = t('connectingToDiscovery');
        discoveryProgress.style.display = 'block';
    } else {
        discoveryStatus.textContent = t('discoveryUnavailable');
        discoveryProgress.style.display = 'none';
    }
}

function createDeviceCard(peerId, deviceInfo, isConnected = false) {
    const deviceCard = document.createElement('div');
    deviceCard.className = 'device-item';
    deviceCard.dataset.peerId = peerId;

    // Different styling for connected vs nearby devices vs room members
    if (isConnected) {
        deviceCard.style.border = '2px solid #4caf50';
        deviceCard.style.background = 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)';
        deviceCard.classList.add('connected-device-item');
    } else if (deviceInfo.isRoomMember) {
        deviceCard.style.border = '2px solid #2196f3';
        deviceCard.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)';
        deviceCard.classList.add('room-member-item');
    }

    const avatar = document.createElement('div');
    avatar.className = 'device-avatar';

    // Set icon based on device type
    const iconName = deviceInfo.type === 'mobile' ? 'smartphone' : 'computer';
    avatar.innerHTML = `<mdui-icon name="${iconName}"></mdui-icon>`;

    // Add connection status indicator
    if (isConnected) {
        avatar.style.border = '3px solid #4caf50';
        avatar.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.3)';
        avatar.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
    } else if (deviceInfo.isRoomMember) {
        avatar.style.border = '3px solid #2196f3';
        avatar.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.3)';
        avatar.style.background = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
    }

    const name = document.createElement('div');
    name.className = 'device-name';
    name.textContent = deviceInfo.name || 'Unknown Device';

    const status = document.createElement('div');
    status.className = 'device-status';

    let connectionText, statusColor;
    if (isConnected) {
        connectionText = 'Connected';
        statusColor = '#4caf50';
    } else if (deviceInfo.isRoomMember) {
        connectionText = 'Room Member';
        statusColor = '#2196f3';
    } else if (deviceInfo.offline) {
        connectionText = 'Offline';
        statusColor = '#999';
    } else if (!deviceInfo.peerJSId) {
        connectionText = 'Initializing...';
        statusColor = '#ff9800';
    } else {
        connectionText = 'Available';
        statusColor = '#666';
    }

    // Create more detailed status information
    const browserInfo = deviceInfo.browser || 'Browser';
    const deviceTypeInfo = deviceInfo.type || 'desktop';
    const osInfo = deviceInfo.os ? ` • ${deviceInfo.os}` : '';
    const modelInfo = deviceInfo.model && deviceInfo.model !== deviceInfo.name ? ` • ${deviceInfo.model}` : '';

    // Add debug info for PeerJS ID
    const debugInfo = deviceInfo.peerJSId ? ` • P2P Ready` : ` • P2P Pending`;
    
    // Add room indicator
    const roomInfo = deviceInfo.isRoomMember ? ` • In Room` : '';

    status.innerHTML = `
        <div style="color: ${statusColor}; font-weight: 500; margin-bottom: 2px;">
            ${connectionText}
        </div>
        <div style="font-size: 0.8rem; color: #888; line-height: 1.2;">
            ${browserInfo} • ${deviceTypeInfo}${osInfo}${modelInfo}${debugInfo}${roomInfo}
        </div>
    `;

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; align-items: center; justify-content: center;';

    if (isConnected) {
        // When connected, spread buttons across the width
        actions.style.justifyContent = 'space-between';
        actions.innerHTML = `
            <mdui-button variant="outlined" onclick="event.stopPropagation(); sendFilesToDevice('${peerId}')" style="--mdui-color-primary: #2196f3;">
                <mdui-icon slot="icon" name="send"></mdui-icon>
                Send Files
            </mdui-button>
            <mdui-button variant="filled" onclick="event.stopPropagation(); console.log('Disconnect clicked for:', '${peerId}', nearbyDevices.get('${peerId}')); disconnectPeer('${peerId}')" style="--mdui-color-primary: #f44336; background-color: #f44336; color: white;">
                <mdui-icon slot="icon" name="link_off"></mdui-icon>
                Disconnect
            </mdui-button>
        `;
    } else if (deviceInfo.offline) {
        // Center the offline button
        actions.style.justifyContent = 'center';
        actions.innerHTML = `
            <mdui-button variant="outlined" disabled style="--mdui-color-primary: #999; color: #999;">
                <mdui-icon slot="icon" name="cloud_off"></mdui-icon>
                Offline
            </mdui-button>
        `;
    } else if (!deviceInfo.peerJSId) {
        // Device is online but PeerJS ID not available yet
        actions.style.justifyContent = 'center';
        actions.innerHTML = `
            <mdui-button variant="outlined" disabled style="--mdui-color-primary: #ff9800; color: #ff9800;">
                <mdui-icon slot="icon" name="hourglass_empty"></mdui-icon>
                Initializing...
            </mdui-button>
        `;
    } else {
        // Center the connect button with special styling for room members
        actions.style.justifyContent = 'center';
        const buttonColor = deviceInfo.isRoomMember ? '#2196f3' : '#2196f3';
        const buttonText = deviceInfo.isRoomMember ? 'Connect to Room Member' : 'Connect';
        actions.innerHTML = `
            <mdui-button variant="filled" onclick="event.stopPropagation(); connectToNearbyDevice('${peerId}')" style="--mdui-color-primary: ${buttonColor}; background-color: ${buttonColor}; color: white;">
                <mdui-icon slot="icon" name="link"></mdui-icon>
                ${buttonText}
            </mdui-button>
        `;
    }

    deviceCard.appendChild(avatar);
    deviceCard.appendChild(name);
    deviceCard.appendChild(status);
    deviceCard.appendChild(actions);

    return deviceCard;
}

function updateDeviceGrid() {
    deviceGrid.innerHTML = '';

    // Show all nearby devices (both connected and not connected)
    const totalNearbyDevices = Array.from(nearbyDevices.keys()).filter(peerId =>
        peerId !== myId
    ).length;

    if (totalNearbyDevices === 0) {
        noDevicesElement.style.display = 'block';
        deviceGrid.style.display = 'none';
        updateDiscoveryStatus();
    } else {
        noDevicesElement.style.display = 'none';
        deviceGrid.style.display = 'grid';

        // Show all nearby devices with appropriate connection status
        nearbyDevices.forEach((deviceInfo, peerId) => {
            if (peerId !== myId) {
                // Check if connected using PeerJS ID or fallback to WebSocket ID
                const peerJSId = deviceInfo.peerJSId;
                const isConnected = peerJSId ? connections.has(peerJSId) : connections.has(peerId);
                const deviceCard = createDeviceCard(peerId, deviceInfo, isConnected);
                deviceGrid.appendChild(deviceCard);
            }
        });
    }
}

// WebSocket message sending function
function sendWebSocketMessage(message) {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify(message));
        console.log('Sent WebSocket message:', message.type);
        return true;
    } else {
        console.error('WebSocket not connected, cannot send message:', message.type);
        return false;
    }
}

// Export to global scope
window.startDeviceDiscovery = startDeviceDiscovery;
window.stopDeviceDiscovery = stopDeviceDiscovery;
window.connectToSignalingServer = connectToSignalingServer;
window.handleSignalingMessage = handleSignalingMessage;
window.updateNearbyDevices = updateNearbyDevices;
window.requestNearbyDevices = requestNearbyDevices;
window.cleanupOldDevices = cleanupOldDevices;
window.updateDiscoveryStatus = updateDiscoveryStatus;
window.createDeviceCard = createDeviceCard;
window.updateDeviceGrid = updateDeviceGrid;
window.sendWebSocketMessage = sendWebSocketMessage;
