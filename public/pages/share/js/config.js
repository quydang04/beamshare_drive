// Configuration and Constants
// P2P File Transfer Configuration

// Data types for communication
const DataType = {
    FILE_METADATA: 'FILE_METADATA',
    FILE_CHUNK: 'FILE_CHUNK',
    FILE_END: 'FILE_END',
    FILE_ACCEPT: 'FILE_ACCEPT',
    FILE_REJECT: 'FILE_REJECT',
    ROOM_JOIN: 'ROOM_JOIN',
    ROOM_LEAVE: 'ROOM_LEAVE',
    ROOM_MEMBER_LIST: 'ROOM_MEMBER_LIST',
    DEVICE_INFO: 'DEVICE_INFO',
    DEVICE_INFO_UPDATE: 'DEVICE_INFO_UPDATE',
    DISCOVERY_BROADCAST: 'DISCOVERY_BROADCAST',
    DISCOVERY_RESPONSE: 'DISCOVERY_RESPONSE',
    PING: 'PING',
    PONG: 'PONG'
};

// Discovery configuration
const DISCOVERY_INTERVAL = 5000; // 5 seconds
const DEVICE_TIMEOUT = 30000; // 30 seconds

// Connection state management
let reconnectAttempts = 0;
let reconnectTimeout = null;
const MAX_RECONNECT_ATTEMPTS = 10;

// File transfer configuration
const FILE_CHUNK_SIZE = 16384; // 16KB chunks

// PeerJS configuration
const PEER_CONFIG = {
    // Use public PeerJS server 0.peerjs.com
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    },
    debug: 1 // Reduce debug logging
};

// Device info configuration
const getDeviceInfo = () => {
    if (typeof getSystemInfo === 'function') {
        return getSystemInfo();
    }
    return {
        name: getDeviceName(),
        type: getDeviceType(),
        browser: getBrowserInfo()
    };
};

// Export to global scope
window.DataType = DataType;
window.DISCOVERY_INTERVAL = DISCOVERY_INTERVAL;
window.DEVICE_TIMEOUT = DEVICE_TIMEOUT;
window.FILE_CHUNK_SIZE = FILE_CHUNK_SIZE;
window.PEER_CONFIG = PEER_CONFIG;
window.getDeviceInfo = getDeviceInfo;
window.reconnectAttempts = reconnectAttempts;
window.reconnectTimeout = reconnectTimeout;
window.MAX_RECONNECT_ATTEMPTS = MAX_RECONNECT_ATTEMPTS;
