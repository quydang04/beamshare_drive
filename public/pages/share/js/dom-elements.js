// DOM Elements and Global Variables
// Central management of DOM elements and application state

// DOM Elements
const myIdElement = document.getElementById("my-id");
const connectionStatus = document.getElementById("connection-status");
const deviceGrid = document.getElementById("device-grid");
const noDevicesElement = document.getElementById("no-devices");
const discoveryStatus = document.getElementById("discovery-status");
const discoveryProgress = document.getElementById("discovery-progress");
const roomCodeElement = document.getElementById("room-code");
const roomCodeDialogElement = document.getElementById("room-code-dialog");
const joinRoomCodeInput = document.getElementById("join-room-code");
const joinRoomCodeDialogInput = document.getElementById("join-room-code-dialog");
const navigationDrawer = document.getElementById("navigation-drawer");
const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const peerList = document.getElementById("peer-list");
const connectedDevicesCard = document.getElementById("connected-devices-card");
const manualPeerIdInput = document.getElementById("manual-peer-id");
const fileDialog = document.getElementById("file-dialog");
const fileDialogMessage = document.getElementById("file-dialog-message");
const acceptFileBtn = document.getElementById("accept-file-btn");
const rejectFileBtn = document.getElementById("reject-file-btn");
const notificationSnackbar = document.getElementById("notification-snackbar");
const copyRoomCodeDialogBtn = document.getElementById("copy-room-code-dialog");
const refreshRoomDialogBtn = document.getElementById("refresh-room-dialog");

// Global variables
let peer = null;
let myId = null;
let isConnected = false;
const connections = new Map();
let pendingFileTransfer = null;
let currentFileTransfer = null;
let currentRoomCode = null;
let roomMembers = new Set();
let selectedFiles = [];

// Nearby devices discovery
let discoveryInterval = null;
let nearbyDevices = new Map(); // Map: peerId -> deviceInfo
let lastSeen = new Map(); // Map: peerId -> timestamp

// WebSocket connection for signaling
let signalingSocket = null;

// Global variable to track pending file sends
let pendingFileSends = new Map(); // fileId -> { conn, file, fileId }

// Device info (will be initialized after utils.js loads)
let deviceInfo = null;

// Export to global scope
window.myIdElement = myIdElement;
window.connectionStatus = connectionStatus;
window.deviceGrid = deviceGrid;
window.noDevicesElement = noDevicesElement;
window.discoveryStatus = discoveryStatus;
window.discoveryProgress = discoveryProgress;
window.roomCodeElement = roomCodeElement;
window.roomCodeDialogElement = roomCodeDialogElement;
window.joinRoomCodeInput = joinRoomCodeInput;
window.joinRoomCodeDialogInput = joinRoomCodeDialogInput;
window.navigationDrawer = navigationDrawer;
window.fileInput = fileInput;
window.dropZone = dropZone;
window.fileList = fileList;
window.progressContainer = progressContainer;
window.progressBar = progressBar;
window.progressText = progressText;
window.peerList = peerList;
window.connectedDevicesCard = connectedDevicesCard;
window.manualPeerIdInput = manualPeerIdInput;
window.fileDialog = fileDialog;
window.fileDialogMessage = fileDialogMessage;
window.acceptFileBtn = acceptFileBtn;
window.rejectFileBtn = rejectFileBtn;
window.notificationSnackbar = notificationSnackbar;

window.peer = peer;
window.myId = myId;
window.isConnected = isConnected;
window.connections = connections;
window.pendingFileTransfer = pendingFileTransfer;
window.currentFileTransfer = currentFileTransfer;
window.currentRoomCode = currentRoomCode;
window.roomMembers = roomMembers;
window.selectedFiles = selectedFiles;
window.discoveryInterval = discoveryInterval;
window.nearbyDevices = nearbyDevices;
window.lastSeen = lastSeen;
window.signalingSocket = signalingSocket;
window.pendingFileSends = pendingFileSends;
window.deviceInfo = deviceInfo;
