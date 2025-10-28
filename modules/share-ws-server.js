const WebSocket = require('ws');
const { Server: WebSocketServer } = WebSocket;
const crypto = require('crypto');

const DEFAULT_OPTIONS = {
    path: '/beamshare/server',
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    },
    wsFallback: false,
    pingInterval: 30000,
    pingTimeout: 90000
};

const COLORS = [
    'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan',
    'Magenta', 'Lime', 'Indigo', 'Violet', 'Turquoise', 'Gold', 'Silver', 'Coral'
];

const ANIMALS = [
    'Cat', 'Dog', 'Lion', 'Tiger', 'Bear', 'Wolf', 'Fox', 'Rabbit',
    'Eagle', 'Dolphin', 'Elephant', 'Giraffe', 'Panda', 'Koala', 'Penguin', 'Owl'
];

function hashPeerId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

function pickFromList(seedBuffer, list) {
    const numeric = seedBuffer.readUInt32BE(0);
    return list[numeric % list.length];
}

function generateDisplayName(id) {
    const seed = crypto.createHash('sha256').update(id).digest();
    const color = pickFromList(seed.subarray(0, 4), COLORS);
    const animal = pickFromList(seed.subarray(4, 8), ANIMALS);
    return `${color} ${animal}`;
}

function parseUserAgent(userAgent) {
    const ua = (userAgent || '').toLowerCase();

    let os = 'Unknown';
    if (/windows nt/.test(ua)) {
        os = 'Windows';
    } else if (/mac os x/.test(ua)) {
        os = 'macOS';
    } else if (/android/.test(ua)) {
        os = 'Android';
    } else if (/(iphone|ipad|ipod|ios)/.test(ua)) {
        os = 'iOS';
    } else if (/linux/.test(ua)) {
        os = 'Linux';
    }

    let browser = 'Browser';
    if (/edg\//.test(ua)) {
        browser = 'Edge';
    } else if (/chrome\//.test(ua) && !/chromium/.test(ua)) {
        browser = 'Chrome';
    } else if (/safari\//.test(ua) && /version\//.test(ua)) {
        browser = 'Safari';
    } else if (/firefox\//.test(ua)) {
        browser = 'Firefox';
    }

    const deviceType = /(mobile|iphone|ipad|ipod|android)/.test(ua) ? 'mobile' : 'desktop';

    const deviceName = os !== 'Unknown' ? `${os} ${browser}` : `${browser} Device`;

    return { os, browser, type: deviceType, deviceName };
}

function resolveClientIp(request) {
    const forwarded = (request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'] || '')
        .split(',')
        .map(token => token.trim())
        .find(Boolean);
    let ip = forwarded || request.socket.remoteAddress || '127.0.0.1';
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    if (ip === '::1') {
        ip = '127.0.0.1';
    }
    if (isPrivateIp(ip)) {
        return '127.0.0.1';
    }
    return ip;
}

function isPrivateIp(ip) {
    if (ip.includes(':')) {
        const first = ip.split(':').find(Boolean) || '';
        return /^fe[c-f][0-9a-f]{2}$/i.test(first) || /^fc/i.test(first) || /^fd/i.test(first) || first === 'fe80' || first === '100';
    }
    return /^10\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || /^192\.168\./.test(ip);
}

class SharePeer {
    constructor(socket, request, options) {
        this.socket = socket;
        this.request = request;
        this.options = options;
        this.id = this._resolvePeerId();
        this.peerIdHash = hashPeerId(this.id);
        this.rtcSupported = this._resolveRtcSupport();
        this.ipRoom = resolveClientIp(request);
        const agent = parseUserAgent(request.headers['user-agent']);
        this.displayName = generateDisplayName(this.id);
        this.deviceName = agent.deviceName;
        this.browser = agent.browser;
        this.os = agent.os;
        this.deviceType = agent.type;
        this.rooms = new Map();
        this.lastSeen = Date.now();
        this.heartbeat = null;
    }

    _resolvePeerId() {
        try {
            const url = new URL(this.request.url, 'http://localhost');
            const existingId = url.searchParams.get('peer_id');
            const hash = url.searchParams.get('peer_id_hash');
            if (existingId && SharePeer.isValidUuid(existingId) && hash === hashPeerId(existingId)) {
                return existingId;
            }
        } catch (err) {
            // ignore and fall back to generated id
        }
        return crypto.randomUUID();
    }

    _resolveRtcSupport() {
        try {
            const url = new URL(this.request.url, 'http://localhost');
            return url.searchParams.get('webrtc_supported') === 'true';
        } catch (err) {
            return true;
        }
    }

    getInfo() {
        return {
            id: this.id,
            rtcSupported: this.rtcSupported,
            name: {
                displayName: this.displayName,
                deviceName: this.deviceName,
                browser: this.browser,
                os: this.os,
                type: this.deviceType
            }
        };
    }

    static isValidUuid(uuid) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    }
}

class ShareWsServer {
    constructor(server, options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this._wss = new WebSocketServer({ server, path: this.options.path });
        this._clientsBySocket = new Map();
        this._clientsById = new Map();
        this._rooms = new Map();

        this._wss.on('connection', (socket, request) => this._onConnection(socket, request));
    }

    _onConnection(socket, request) {
        const peer = new SharePeer(socket, request, this.options);
        this._clientsBySocket.set(socket, peer);
        this._clientsById.set(peer.id, peer);

        socket.on('message', data => this._onMessage(peer, data));
        socket.on('close', () => this._disconnect(peer));
        socket.on('error', () => this._disconnect(peer));

        this._send(peer, {
            type: 'ws-config',
            wsConfig: {
                rtcConfig: this.options.rtcConfig,
                wsFallback: this.options.wsFallback
            }
        });

        this._send(peer, {
            type: 'display-name',
            displayName: peer.displayName,
            deviceName: peer.deviceName,
            peerId: peer.id,
            peerIdHash: peer.peerIdHash
        });

        this._scheduleHeartbeat(peer);
    }

    _scheduleHeartbeat(peer) {
        if (peer.heartbeat) {
            clearInterval(peer.heartbeat);
        }
        const timer = setInterval(() => {
            if (peer.socket.readyState !== WebSocket.OPEN) {
                return;
            }
            const elapsed = Date.now() - peer.lastSeen;
            if (elapsed > this.options.pingTimeout) {
                this._disconnect(peer);
                return;
            }
            this._send(peer, { type: 'ping' });
        }, this.options.pingInterval);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
        peer.heartbeat = timer;
    }

    _onMessage(peer, raw) {
        let message;
        try {
            message = JSON.parse(raw);
        } catch (err) {
            return;
        }

        switch (message.type) {
            case 'pong':
                peer.lastSeen = Date.now();
                break;
            case 'disconnect':
                this._disconnect(peer);
                break;
            case 'join-ip-room':
                this._joinRoom(peer, 'ip', peer.ipRoom);
                break;
            case 'signal':
                this._forwardSignal(peer, message);
                break;
            default:
                break;
        }
    }

    _forwardSignal(sender, message) {
        if (!message.to) {
            return;
        }
        const recipient = this._clientsById.get(message.to);
        if (!recipient || recipient.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const outbound = { ...message };
        delete outbound.to;
        outbound.sender = {
            id: sender.id,
            rtcSupported: sender.rtcSupported
        };
        this._send(recipient, outbound);
    }

    _joinRoom(peer, roomType, roomId) {
        if (!roomId) {
            return;
        }
        const key = `${roomType}:${roomId}`;
        const room = this._rooms.get(key) || new Map();
        if (room.has(peer.id)) {
            return;
        }

        const peers = Array.from(room.values()).map(existing => existing.getInfo());
        this._send(peer, {
            type: 'peers',
            peers,
            roomType,
            roomId
        });

        room.forEach(existing => {
            this._send(existing, {
                type: 'peer-joined',
                peer: peer.getInfo(),
                roomType,
                roomId
            });
        });

        room.set(peer.id, peer);
        this._rooms.set(key, room);
        peer.rooms.set(key, { roomType, roomId });
    }

    _leaveRoom(peer, roomKey) {
        const room = this._rooms.get(roomKey);
        if (!room || !room.has(peer.id)) {
            return;
        }
        const { roomType, roomId } = peer.rooms.get(roomKey) || {};
        room.delete(peer.id);

        room.forEach(existing => {
            this._send(existing, {
                type: 'peer-left',
                peerId: peer.id,
                roomType,
                roomId
            });
        });

        if (room.size === 0) {
            this._rooms.delete(roomKey);
        }
        peer.rooms.delete(roomKey);
    }

    _disconnect(peer) {
        if (!this._clientsById.has(peer.id)) {
            return;
        }

        peer.rooms.forEach((_, key) => this._leaveRoom(peer, key));
        this._clientsBySocket.delete(peer.socket);
        this._clientsById.delete(peer.id);
        if (peer.heartbeat) {
            clearInterval(peer.heartbeat);
            peer.heartbeat = null;
        }
        try {
            peer.socket.terminate();
        } catch (err) {
            // ignore
        }
    }

    _send(peer, message) {
        if (!peer || peer.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        try {
            peer.socket.send(JSON.stringify(message));
        } catch (err) {
            // ignore send errors
        }
    }
}

module.exports = ShareWsServer;
