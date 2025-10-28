// Persistent Connection Management
// Maintains connections even when network is lost or page is refreshed
// Based on PairDrop's approach with NoSleep.js for wake lock

// Import NoSleep.js dynamically to avoid module loading issues
let NoSleep = null;

// Load NoSleep.js dynamically
async function loadNoSleep() {
    try {
        if (typeof window !== 'undefined' && window.NoSleep) {
            NoSleep = window.NoSleep;
        } else {
            // Try to load from CDN as fallback
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/nosleep.js@0.12.0/dist/NoSleep.min.js';
            script.onload = () => {
                NoSleep = window.NoSleep;
                console.log('✅ NoSleep.js loaded from CDN');
            };
            script.onerror = () => {
                console.warn('⚠️ Failed to load NoSleep.js from CDN');
            };
            document.head.appendChild(script);
        }
    } catch (error) {
        console.warn('⚠️ NoSleep.js not available:', error);
    }
}

// Connection persistence state
let noSleep = null;
let wakeLockEnabled = false;
let connectionPersistence = {
    enabled: true,
    connectedPeers: new Map(), // peerId -> { deviceInfo, connectionTime, lastSeen }
    reconnectAttempts: new Map(), // peerId -> attemptCount
    maxReconnectAttempts: 10,
    reconnectInterval: 2000, // Start with 2 seconds
    maxReconnectInterval: 30000, // Max 30 seconds
    heartbeatInterval: 5000, // 5 seconds
    heartbeatTimers: new Map(),
    connectionStates: new Map(), // peerId -> 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
    persistenceKey: 'viecloud_share_persistent_connections'
};

// Initialize persistent connection system
async function initializePersistentConnections() {
    console.log('🔄 Initializing persistent connection system...');

    // Load NoSleep.js first
    await loadNoSleep();

    // Initialize NoSleep for wake lock
    initializeWakeLock();

    // Load persisted connections from localStorage
    loadPersistedConnections();

    // Setup page visibility and network change handlers
    setupConnectionPersistenceHandlers();

    // Setup periodic connection health checks
    setupConnectionHealthChecks();

    console.log('✅ Persistent connection system initialized');
}

// Initialize NoSleep.js for wake lock functionality
function initializeWakeLock() {
    try {
        if (NoSleep) {
            noSleep = new NoSleep();
            console.log('✅ NoSleep.js initialized for wake lock');

            // Always enable wake lock when user interacts with the page (default behavior)
            document.addEventListener('click', enableWakeLock, { once: true });
            document.addEventListener('touchstart', enableWakeLock, { once: true });
        } else {
            console.warn('⚠️ NoSleep.js not available, wake lock disabled');
        }

    } catch (error) {
        console.warn('⚠️ NoSleep.js initialization failed:', error);
    }
}

// Enable wake lock to prevent device sleep (always enabled by default)
function enableWakeLock() {
    if (!noSleep || wakeLockEnabled) return;

    try {
        noSleep.enable();
        wakeLockEnabled = true;
        console.log('🔒 Wake lock enabled - device will stay awake during transfers');

        // Show notification only once
        if (typeof showNotification === 'function') {
            showNotification('Device will stay awake during transfers', 'info');
        }

    } catch (error) {
        console.warn('⚠️ Failed to enable wake lock:', error);
    }
}

// Disable wake lock (only used when page is unloaded)
function disableWakeLock() {
    if (!noSleep || !wakeLockEnabled) return;

    try {
        noSleep.disable();
        wakeLockEnabled = false;
        console.log('🔓 Wake lock disabled');

    } catch (error) {
        console.warn('⚠️ Failed to disable wake lock:', error);
    }
}



// Setup handlers for connection persistence
function setupConnectionPersistenceHandlers() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('📱 Page hidden - maintaining connections in background');
            // Increase heartbeat interval to conserve battery
            adjustHeartbeatInterval(10000);
        } else {
            console.log('👀 Page visible - resuming normal connection monitoring');
            // Resume normal heartbeat interval
            adjustHeartbeatInterval(connectionPersistence.heartbeatInterval);
            // Check connection health immediately
            checkAllConnectionsHealth();
        }
    });
    
    // Handle network status changes
    window.addEventListener('online', () => {
        console.log('🌐 Network back online - attempting to reconnect');
        if (typeof showNotification === 'function') {
            showNotification('Network restored - reconnecting to devices...', 'info');
        }
        reconnectAllPeers();
    });
    
    window.addEventListener('offline', () => {
        console.log('📡 Network offline - marking connections for reconnection');
        if (typeof showNotification === 'function') {
            showNotification('Network lost - will reconnect when available', 'warning');
        }
        markAllConnectionsForReconnection();
    });
    
    // Handle page unload/refresh
    window.addEventListener('beforeunload', () => {
        console.log('🔄 Page unloading - persisting connection state');
        persistConnectionState();
    });
    
    // Handle page load
    window.addEventListener('load', () => {
        console.log('🚀 Page loaded - restoring persistent connections');
        setTimeout(() => {
            restorePersistentConnections();
        }, 2000); // Wait for other systems to initialize
    });
}

// Adjust heartbeat interval for all connections
function adjustHeartbeatInterval(newInterval) {
    connectionPersistence.heartbeatTimers.forEach((timer, peerId) => {
        clearInterval(timer);
        const heartbeatTimer = setInterval(() => {
            sendHeartbeat(peerId);
        }, newInterval);
        connectionPersistence.heartbeatTimers.set(peerId, heartbeatTimer);
    });
}

// Add a peer to persistent connections
function addPersistentConnection(peerId, deviceInfo) {
    console.log('➕ Adding persistent connection:', peerId, deviceInfo.name);
    
    connectionPersistence.connectedPeers.set(peerId, {
        deviceInfo: deviceInfo,
        connectionTime: Date.now(),
        lastSeen: Date.now(),
        reconnectAttempts: 0
    });
    
    connectionPersistence.connectionStates.set(peerId, 'connected');
    
    // Start heartbeat for this connection
    startHeartbeat(peerId);
    
    // Persist to localStorage
    persistConnectionState();
    
    // Wake lock is always enabled by default on user interaction
}

// Remove a peer from persistent connections
function removePersistentConnection(peerId) {
    console.log('➖ Removing persistent connection:', peerId);
    
    connectionPersistence.connectedPeers.delete(peerId);
    connectionPersistence.connectionStates.delete(peerId);
    connectionPersistence.reconnectAttempts.delete(peerId);
    
    // Stop heartbeat
    stopHeartbeat(peerId);
    
    // Persist to localStorage
    persistConnectionState();

    // Keep wake lock enabled even when no connections remain
}

// Start heartbeat for a peer
function startHeartbeat(peerId) {
    // Clear existing heartbeat if any
    stopHeartbeat(peerId);
    
    const heartbeatTimer = setInterval(() => {
        sendHeartbeat(peerId);
    }, connectionPersistence.heartbeatInterval);
    
    connectionPersistence.heartbeatTimers.set(peerId, heartbeatTimer);
    console.log('💓 Started heartbeat for peer:', peerId);
}

// Stop heartbeat for a peer
function stopHeartbeat(peerId) {
    const timer = connectionPersistence.heartbeatTimers.get(peerId);
    if (timer) {
        clearInterval(timer);
        connectionPersistence.heartbeatTimers.delete(peerId);
        console.log('💔 Stopped heartbeat for peer:', peerId);
    }
}

// Send heartbeat to a peer
function sendHeartbeat(peerId) {
    if (!window.connections || !window.connections.has(peerId)) {
        console.log('💔 Connection lost for peer:', peerId, '- attempting reconnection');
        attemptReconnection(peerId);
        return;
    }
    
    try {
        const connection = window.connections.get(peerId);
        if (connection && connection.open) {
            connection.send({
                type: 'heartbeat',
                timestamp: Date.now()
            });
            
            // Update last seen
            const peerData = connectionPersistence.connectedPeers.get(peerId);
            if (peerData) {
                peerData.lastSeen = Date.now();
            }
        } else {
            console.log('💔 Connection not open for peer:', peerId, '- attempting reconnection');
            attemptReconnection(peerId);
        }
    } catch (error) {
        console.warn('⚠️ Heartbeat failed for peer:', peerId, error);
        attemptReconnection(peerId);
    }
}

// Attempt to reconnect to a peer
function attemptReconnection(peerId) {
    const currentAttempts = connectionPersistence.reconnectAttempts.get(peerId) || 0;
    
    if (currentAttempts >= connectionPersistence.maxReconnectAttempts) {
        console.log('❌ Max reconnection attempts reached for peer:', peerId);
        removePersistentConnection(peerId);
        return;
    }
    
    connectionPersistence.connectionStates.set(peerId, 'reconnecting');
    connectionPersistence.reconnectAttempts.set(peerId, currentAttempts + 1);
    
    // Calculate exponential backoff delay
    const delay = Math.min(
        connectionPersistence.reconnectInterval * Math.pow(2, currentAttempts),
        connectionPersistence.maxReconnectInterval
    );
    
    console.log(`🔄 Attempting reconnection to ${peerId} (attempt ${currentAttempts + 1}/${connectionPersistence.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
        const peerData = connectionPersistence.connectedPeers.get(peerId);
        if (peerData && typeof window.connectToNearbyDevice === 'function') {
            console.log('🔄 Reconnecting to peer:', peerId);
            window.connectToNearbyDevice(peerId);
        }
    }, delay);
}

// Reconnect all peers after network restoration
function reconnectAllPeers() {
    console.log('🔄 Reconnecting all persistent peers...');

    connectionPersistence.connectedPeers.forEach((peerData, peerId) => {
        // Reset reconnection attempts
        connectionPersistence.reconnectAttempts.set(peerId, 0);

        // Attempt reconnection with a small delay to avoid overwhelming the network
        setTimeout(() => {
            attemptReconnection(peerId);
        }, Math.random() * 2000); // Random delay 0-2 seconds
    });
}

// Mark all connections for reconnection (when network goes offline)
function markAllConnectionsForReconnection() {
    connectionPersistence.connectedPeers.forEach((peerData, peerId) => {
        connectionPersistence.connectionStates.set(peerId, 'disconnected');
        // Stop heartbeat temporarily
        stopHeartbeat(peerId);
    });
}

// Check health of all connections
function checkAllConnectionsHealth() {
    console.log('🏥 Checking health of all connections...');

    connectionPersistence.connectedPeers.forEach((peerData, peerId) => {
        const timeSinceLastSeen = Date.now() - peerData.lastSeen;

        // If we haven't heard from peer in 30 seconds, consider it unhealthy
        if (timeSinceLastSeen > 30000) {
            console.log(`⚠️ Peer ${peerId} appears unhealthy (last seen ${timeSinceLastSeen}ms ago)`);
            attemptReconnection(peerId);
        }
    });
}

// Setup periodic connection health checks
function setupConnectionHealthChecks() {
    setInterval(() => {
        if (!document.hidden) { // Only check when page is visible
            checkAllConnectionsHealth();
        }
    }, 60000); // Check every minute
}

// Persist connection state to localStorage
function persistConnectionState() {
    try {
        const persistData = {
            connectedPeers: Array.from(connectionPersistence.connectedPeers.entries()),
            timestamp: Date.now(),
            wakeLockEnabled: wakeLockEnabled
        };

        localStorage.setItem(connectionPersistence.persistenceKey, JSON.stringify(persistData));
        console.log('💾 Persisted connection state for', persistData.connectedPeers.length, 'peers');

    } catch (error) {
        console.warn('⚠️ Failed to persist connection state:', error);
    }
}

// Load persisted connections from localStorage
function loadPersistedConnections() {
    try {
        const persistedData = localStorage.getItem(connectionPersistence.persistenceKey);
        if (!persistedData) return;

        const data = JSON.parse(persistedData);

        // Only restore connections from the last 5 minutes to avoid stale data
        if (Date.now() - data.timestamp > 300000) {
            console.log('🗑️ Clearing stale persisted connections');
            localStorage.removeItem(connectionPersistence.persistenceKey);
            return;
        }

        // Wake lock is always enabled by default on user interaction

        // Restore connected peers
        if (data.connectedPeers && Array.isArray(data.connectedPeers)) {
            data.connectedPeers.forEach(([peerId, peerData]) => {
                connectionPersistence.connectedPeers.set(peerId, peerData);
                connectionPersistence.connectionStates.set(peerId, 'disconnected');
                console.log('📥 Loaded persisted connection:', peerId, peerData.deviceInfo.name);
            });

            console.log('✅ Loaded', data.connectedPeers.length, 'persisted connections');
        }

    } catch (error) {
        console.warn('⚠️ Failed to load persisted connections:', error);
        localStorage.removeItem(connectionPersistence.persistenceKey);
    }
}

// Restore persistent connections after page load
function restorePersistentConnections() {
    if (connectionPersistence.connectedPeers.size === 0) {
        console.log('📭 No persistent connections to restore');
        return;
    }

    console.log('🔄 Restoring', connectionPersistence.connectedPeers.size, 'persistent connections...');

    // Show notification about restoration
    if (typeof showNotification === 'function') {
        showNotification(`Restoring ${connectionPersistence.connectedPeers.size} persistent connections...`, 'info');
    }

    // Attempt to reconnect to all persisted peers
    reconnectAllPeers();
}

// Handle successful connection establishment
function onConnectionEstablished(peerId, deviceInfo) {
    console.log('✅ Connection established with peer:', peerId);

    // Update connection state
    connectionPersistence.connectionStates.set(peerId, 'connected');

    // Reset reconnection attempts
    connectionPersistence.reconnectAttempts.set(peerId, 0);

    // Update last seen time
    const peerData = connectionPersistence.connectedPeers.get(peerId);
    if (peerData) {
        peerData.lastSeen = Date.now();
    }

    // Start/restart heartbeat
    startHeartbeat(peerId);

    // Persist updated state
    persistConnectionState();
}

// Handle connection loss
function onConnectionLost(peerId) {
    console.log('❌ Connection lost with peer:', peerId);

    const peerData = connectionPersistence.connectedPeers.get(peerId);
    if (peerData) {
        // Mark as disconnected but keep in persistent connections for reconnection
        connectionPersistence.connectionStates.set(peerId, 'disconnected');

        // Stop heartbeat
        stopHeartbeat(peerId);

        // Attempt reconnection
        attemptReconnection(peerId);

        // Show notification
        if (typeof showNotification === 'function') {
            showNotification(`Connection lost with ${peerData.deviceInfo.name} - attempting reconnection...`, 'warning');
        }
    }
}

// Get connection status for UI
function getConnectionStatus(peerId) {
    return connectionPersistence.connectionStates.get(peerId) || 'disconnected';
}

// Get all persistent connections for UI
function getAllPersistentConnections() {
    return Array.from(connectionPersistence.connectedPeers.entries()).map(([peerId, peerData]) => ({
        peerId,
        deviceInfo: peerData.deviceInfo,
        status: getConnectionStatus(peerId),
        lastSeen: peerData.lastSeen,
        reconnectAttempts: connectionPersistence.reconnectAttempts.get(peerId) || 0
    }));
}

// Clear all persistent connections
function clearAllPersistentConnections() {
    console.log('🗑️ Clearing all persistent connections');

    // Stop all heartbeats
    connectionPersistence.heartbeatTimers.forEach((timer, peerId) => {
        clearInterval(timer);
    });

    // Clear all data
    connectionPersistence.connectedPeers.clear();
    connectionPersistence.connectionStates.clear();
    connectionPersistence.reconnectAttempts.clear();
    connectionPersistence.heartbeatTimers.clear();

    // Clear persisted data
    localStorage.removeItem(connectionPersistence.persistenceKey);

    // Disable wake lock
    disableWakeLock();

    if (typeof showNotification === 'function') {
        showNotification('All persistent connections cleared', 'info');
    }
}

// Export functions to global scope
window.initializePersistentConnections = initializePersistentConnections;
window.enableWakeLock = enableWakeLock;
window.disableWakeLock = disableWakeLock;
window.addPersistentConnection = addPersistentConnection;
window.removePersistentConnection = removePersistentConnection;
window.onConnectionEstablished = onConnectionEstablished;
window.onConnectionLost = onConnectionLost;
window.getConnectionStatus = getConnectionStatus;
window.getAllPersistentConnections = getAllPersistentConnections;
window.clearAllPersistentConnections = clearAllPersistentConnections;
window.connectionPersistence = connectionPersistence;
