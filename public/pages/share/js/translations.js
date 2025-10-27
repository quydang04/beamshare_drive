// Translation System
// Language and translation management

// Current language setting
let currentLanguage = 'vi';

// Translation data
const translations = {
    en: {
        // App title and navigation
    appTitle: 'VieCloud Share',
        home: 'Home',
        devices: 'Devices',
        fileTransfer: 'File Transfer',
        settings: 'Settings',
        language: 'Language',
        help: 'Help',

        // Connection status
        connected: 'Connected',
        connecting: 'Connecting...',
        disconnected: 'Disconnected',

        // Device discovery
        lookingForDevices: 'Looking for nearby devices...',
        connectingToDiscovery: 'Connecting to discovery service...',
        discoveryUnavailable: 'Discovery service unavailable',
        noDevicesFound: 'No devices found',
        available: 'Available',
        makeSureSameNetwork: 'Make sure you\'re on the same network',

        // File operations
        selectFiles: 'Select Files',
        dropFilesHere: 'Drop files here or click to select',
        filesSelected: 'file(s) selected',
        waitingForDevices: 'Waiting for devices...',
        clickDeviceToSend: 'Click on a device to send',
        pleaseSelectFiles: 'Please select files first',

        // Connection actions
        connect: 'Connect',
        send: 'Send',
        disconnect: 'Disconnect',

        // File transfer
        sending: 'Sending',
        receiving: 'Receiving',
        sentSuccessfully: 'sent successfully!',
        receivedSuccessfully: 'received successfully!',
        transferAccepted: 'File transfer accepted!',
        transferDeclined: 'File transfer was declined',
        waitingForAcceptance: 'Waiting for {fileName} to be accepted...',
        dropFilesHere: 'Drop files here or click to select',
        supportAnyFileType: 'Support any file type',
        selectFiles: 'Select Files',

        // Room functionality
        yourRoom: 'Your Room',
        roomCode: 'Room Code',
        joinRoom: 'Join Room',
        copyRoomCode: 'Copy Room Code',
        refreshRoom: 'Refresh Room',
        enterRoomCode: 'Enter room code',
        roomCodeCopied: 'Room code copied!',
        newRoomGenerated: 'New room code generated!',

        // Settings
        deviceName: 'Device Name',
        autoAcceptFiles: 'Auto-accept files',
        soundNotifications: 'Sound notifications',
        wakeLock: 'Keep screen awake during transfers',
        persistentConnections: 'Maintain connections when network is lost',
        save: 'Save',
        cancel: 'Cancel',
        close: 'Close',
        settingsSaved: 'Settings saved!',

        // Language selection
        selectLanguage: 'Select Language',
        languageChanged: 'Language changed!',

        // Notifications and messages
        connectedSuccessfully: 'Connected successfully!',
        connectionError: 'Connection error',
        connectionLost: 'Connection lost, reconnecting...',
        deviceNotConnected: 'Device not connected',
        deviceDisconnected: 'Device disconnected',
        alreadyConnected: 'Already connected to this device',
        cannotConnectToSelf: 'Cannot connect to yourself',
        deviceNoLongerAvailable: 'Device no longer available',
        connectingTo: 'Connecting to {deviceName}...',
        connectedTo: 'Connected to {deviceName}!',
        disconnectedFrom: 'Disconnected from {deviceName}',
        failedToConnect: 'Failed to connect to {deviceName}',

        // File dialog
        acceptFile: 'Accept',
        rejectFile: 'Reject',
        from: 'from',

        // Help and about
    aboutTitle: 'About VieCloud Share',
        aboutDescription: 'Secure peer-to-peer file sharing in your browser',
        howToUse: 'How to use',
    step1: '1. Open VieCloud Share on another device',
        step2: '2. Devices will automatically discover each other',
        step3: '3. Select files and click on a device to send',
        step4: '4. Accept the transfer on the receiving device',

        // Help dialog sections
        helpNearbyDevices: 'Nearby Devices',
        helpNearbyDevicesDesc: 'Devices on the same network will automatically appear. Click "Connect" to establish a connection.',
        helpRoomSharing: 'Room Sharing',
        helpRoomSharingDesc: 'Share your room code or QR code with others to let them join your room from anywhere.',
        helpFileTransfer: 'File Transfer',
        helpFileTransferDesc: 'Drag & drop files or click "Select Files" to choose files. Then click on a connected device to send.',
        helpManualConnection: 'Manual Connection',
        helpManualConnectionDesc: 'If automatic discovery doesn\'t work, you can manually enter a device ID to connect.',
        helpPrivacySecurity: 'Privacy & Security',
        helpPrivacySecurityDesc: 'All transfers are peer-to-peer and encrypted. No files are stored on our servers.',

        // Additional UI elements
        yourDevice: 'Your Device',
        sendFiles: 'Send Files',
        manualConnection: 'Manual Connection',
        connectedDevices: 'Connected Devices',
        nearbyDevices: 'Nearby Devices',
        incomingFile: 'Incoming File',
        deviceId: 'Device ID',
        enterDeviceId: 'Enter device ID to connect',
        enterDeviceIdHelper: 'Enter the Device ID from another device to connect directly',
        roomCodeLabel: 'Room Code',
        enterRoomCode: 'Enter 5-character room code',
        enterRoomCodeHelper: 'Enter the room code shared by another device to join their room.',
        yourRoomCode: 'Your Room Code',
        copy: 'Copy',
        newCode: 'New Code',
        scanToJoin: 'Scan to join room',
        howToShareRoom: '💡 How to share your room:',
        shareRoomCode: 'Share the room code with others',
        scanQRCode: 'Let them scan the QR code',
        sendRoomURL: 'Send them the room URL',
        gotIt: 'Got it',
        decline: 'Decline',
        accept: 'Accept',
        loading: 'Loading...',
        supportAnyFileType: 'Support any file type',
        makeSureSameNetwork: 'Make sure you\'re on the same network',
        transferFilesCrossPlatform: 'Transfer Files Cross-Platform',
        noSetupNoSignup: 'No Setup, No Signup.',
    howToUsePairDrop: 'How to Use VieCloud Share',
        nearbyDevicesHelp: '🔍 Nearby Devices',
        nearbyDevicesDesc: 'Devices on the same network will automatically appear. Click "Connect" to establish a connection.',
        roomSharingHelp: '🏠 Room Sharing',
        roomSharingDesc: 'Share your room code or QR code with others to let them join your room from anywhere.',
        fileTransferHelp: '📁 File Transfer',
        fileTransferDesc: 'Drag & drop files or click "Select Files" to choose files. Then click on a connected device to send.',
        manualConnectionHelp: '🔗 Manual Connection',
        manualConnectionDesc: 'If automatic discovery doesn\'t work, you can manually enter a device ID to connect.',
        privacySecurityHelp: '🔒 Privacy & Security',
        privacySecurityDesc: 'All transfers are peer-to-peer and encrypted. No files are stored on our servers.',
        autoAcceptHelper: 'Automatically download files without asking for confirmation. Only enable if you trust the sender.',
        soundNotificationsHelper: 'Play different sounds for success, warning, and error notifications.',

        // Connected devices
        connectedDevicesCount: '{count} connected',
        sendFilesToDevice: 'Send Files'
    },
    vi: {
        // App title and navigation
    appTitle: 'VieCloud Share',
        home: 'Trang chủ',
        devices: 'Thiết bị',
        fileTransfer: 'Truyền tệp',
        settings: 'Cài đặt',
        language: 'Ngôn ngữ',
        help: 'Trợ giúp',

        // Connection status
        connected: 'Đã kết nối',
        connecting: 'Đang kết nối...',
        disconnected: 'Đã ngắt kết nối',

        // Device discovery
        lookingForDevices: 'Đang tìm kiếm thiết bị gần đây...',
        connectingToDiscovery: 'Đang kết nối đến dịch vụ khám phá...',
        discoveryUnavailable: 'Dịch vụ khám phá không khả dụng',
        noDevicesFound: 'Không tìm thấy thiết bị nào',
        available: 'Có sẵn',
        makeSureSameNetwork: 'Đảm bảo bạn đang ở cùng mạng',

        // File operations
        selectFiles: 'Chọn tệp',
        dropFilesHere: 'Thả tệp vào đây hoặc nhấp để chọn',
        filesSelected: 'tệp đã chọn',
        waitingForDevices: 'Đang chờ thiết bị...',
        clickDeviceToSend: 'Nhấp vào thiết bị để gửi',
        pleaseSelectFiles: 'Vui lòng chọn tệp trước',

        // Connection actions
        connect: 'Kết nối',
        send: 'Gửi',
        disconnect: 'Ngắt kết nối',

        // File transfer
        sending: 'Đang gửi',
        receiving: 'Đang nhận',
        sentSuccessfully: 'đã gửi thành công!',
        receivedSuccessfully: 'đã nhận thành công!',
        transferAccepted: 'Chuyển tệp đã được chấp nhận!',
        transferDeclined: 'Chuyển tệp đã bị từ chối',
        waitingForAcceptance: 'Đang chờ {fileName} được chấp nhận...',
        dropFilesHere: 'Thả tệp vào đây hoặc nhấp để chọn',
        supportAnyFileType: 'Hỗ trợ mọi loại tệp',
        selectFiles: 'Chọn tệp',

        // Room functionality
        yourRoom: 'Phòng của bạn',
        roomCode: 'Mã phòng',
        joinRoom: 'Tham gia phòng',
        copyRoomCode: 'Sao chép mã phòng',
        refreshRoom: 'Làm mới phòng',
        enterRoomCode: 'Nhập mã phòng',
        roomCodeCopied: 'Đã sao chép mã phòng!',
        newRoomGenerated: 'Đã tạo mã phòng mới!',

        // Settings
        deviceName: 'Tên thiết bị',
        autoAcceptFiles: 'Tự động chấp nhận tệp',
        soundNotifications: 'Thông báo âm thanh',
        wakeLock: 'Giữ màn hình sáng khi truyền tệp',
        persistentConnections: 'Duy trì kết nối khi mất mạng',
        save: 'Lưu',
        cancel: 'Hủy',
        close: 'Đóng',
        settingsSaved: 'Đã lưu cài đặt!',

        // Language selection
        selectLanguage: 'Chọn ngôn ngữ',
        languageChanged: 'Đã thay đổi ngôn ngữ!',

        // Notifications and messages
        connectedSuccessfully: 'Kết nối thành công!',
        connectionError: 'Lỗi kết nối',
        connectionLost: 'Mất kết nối, đang kết nối lại...',
        deviceNotConnected: 'Thiết bị chưa kết nối',
        deviceDisconnected: 'Thiết bị đã ngắt kết nối',
        alreadyConnected: 'Đã kết nối với thiết bị này',
        cannotConnectToSelf: 'Không thể kết nối với chính mình',
        deviceNoLongerAvailable: 'Thiết bị không còn khả dụng',
        connectingTo: 'Đang kết nối đến {deviceName}...',
        connectedTo: 'Đã kết nối với {deviceName}!',
        disconnectedFrom: 'Đã ngắt kết nối khỏi {deviceName}',
        failedToConnect: 'Không thể kết nối với {deviceName}',

        // File dialog
        acceptFile: 'Chấp nhận',
        rejectFile: 'Từ chối',
        from: 'từ',

        // Help and about
    aboutTitle: 'Về VieCloud Share',
        aboutDescription: 'Chia sẻ tệp ngang hàng an toàn trong trình duyệt của bạn',
        howToUse: 'Cách sử dụng',
    step1: '1. Mở VieCloud Share trên thiết bị khác',
        step2: '2. Các thiết bị sẽ tự động khám phá lẫn nhau',
        step3: '3. Chọn tệp và nhấp vào thiết bị để gửi',
        step4: '4. Chấp nhận chuyển tệp trên thiết bị nhận',

        // Help dialog sections
        helpNearbyDevices: 'Thiết bị gần đây',
        helpNearbyDevicesDesc: 'Các thiết bị trên cùng mạng sẽ tự động xuất hiện. Nhấp "Kết nối" để thiết lập kết nối.',
        helpRoomSharing: 'Chia sẻ phòng',
        helpRoomSharingDesc: 'Chia sẻ mã phòng hoặc mã QR với người khác để họ có thể tham gia phòng của bạn từ bất kỳ đâu.',
        helpFileTransfer: 'Truyền tệp',
        helpFileTransferDesc: 'Kéo thả tệp hoặc nhấp "Chọn tệp" để chọn tệp. Sau đó nhấp vào thiết bị đã kết nối để gửi.',
        helpManualConnection: 'Kết nối thủ công',
        helpManualConnectionDesc: 'Nếu tự động phát hiện không hoạt động, bạn có thể nhập thủ công ID thiết bị để kết nối.',
        helpPrivacySecurity: 'Quyền riêng tư & Bảo mật',
        helpPrivacySecurityDesc: 'Tất cả việc truyền tải đều là ngang hàng và được mã hóa. Không có tệp nào được lưu trữ trên máy chủ của chúng tôi.',

        // Additional UI elements
        yourDevice: 'Thiết bị của bạn',
        sendFiles: 'Gửi tệp',
        manualConnection: 'Kết nối thủ công',
        connectedDevices: 'Thiết bị đã kết nối',
        nearbyDevices: 'Thiết bị gần đây',
        incomingFile: 'Tệp đến',
        deviceId: 'ID thiết bị',
        enterDeviceId: 'Nhập ID thiết bị để kết nối',
        enterDeviceIdHelper: 'Nhập ID thiết bị từ thiết bị khác để kết nối trực tiếp',
        roomCodeLabel: 'Mã phòng',
        enterRoomCode: 'Nhập mã phòng 5 ký tự',
        enterRoomCodeHelper: 'Nhập mã phòng được chia sẻ bởi thiết bị khác để tham gia phòng của họ.',
        yourRoomCode: 'Mã phòng của bạn:',
        copy: 'Sao chép',
        newCode: 'Mã mới',
        scanToJoin: 'Quét để tham gia phòng',
        howToShareRoom: '💡 Cách chia sẻ phòng của bạn:',
        shareRoomCode: 'Chia sẻ mã phòng với người khác',
        scanQRCode: 'Để họ quét mã QR',
        sendRoomURL: 'Gửi cho họ URL phòng',
        gotIt: 'Đã hiểu',
        decline: 'Từ chối',
        accept: 'Chấp nhận',
        loading: 'Đang tải...',
        supportAnyFileType: 'Hỗ trợ mọi loại tệp',
        makeSureSameNetwork: 'Đảm bảo bạn đang ở cùng mạng',
        transferFilesCrossPlatform: 'Truyền Tệp Đa Nền Tảng',
        noSetupNoSignup: 'Không cần cài đặt, không cần đăng ký.',
    howToUsePairDrop: 'Cách sử dụng VieCloud Share',
        nearbyDevicesHelp: '🔍 Thiết bị gần đây',
        nearbyDevicesDesc: 'Các thiết bị trên cùng mạng sẽ tự động xuất hiện. Nhấp "Kết nối" để thiết lập kết nối.',
        roomSharingHelp: '🏠 Chia sẻ phòng',
        roomSharingDesc: 'Chia sẻ mã phòng hoặc mã QR của bạn với người khác để họ tham gia phòng từ bất kỳ đâu.',
        fileTransferHelp: '📁 Truyền tệp',
        fileTransferDesc: 'Kéo thả tệp hoặc nhấp "Chọn tệp" để chọn tệp. Sau đó nhấp vào thiết bị đã kết nối để gửi.',
        manualConnectionHelp: '🔗 Kết nối thủ công',
        manualConnectionDesc: 'Nếu khám phá tự động không hoạt động, bạn có thể nhập ID thiết bị để kết nối thủ công.',
        privacySecurityHelp: '🔒 Quyền riêng tư & Bảo mật',
        privacySecurityDesc: 'Tất cả việc truyền tệp đều ngang hàng và được mã hóa. Không có tệp nào được lưu trên máy chủ của chúng tôi.',
        autoAcceptHelper: 'Tự động tải xuống tệp mà không cần xác nhận. Chỉ bật nếu bạn tin tưởng người gửi.',
        soundNotificationsHelper: 'Phát âm thanh khác nhau cho thông báo thành công, cảnh báo và lỗi.',

        // Connected devices
        connectedDevicesCount: '{count} đã kết nối',
        sendFilesToDevice: 'Gửi tệp'
    }
};

// Translation function
function t(key, params = {}) {
    const translation = translations[currentLanguage]?.[key] || translations['en'][key] || key;

    // Replace parameters in translation
    return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] || match;
    });
}

// Language management functions
function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        updateUILanguage();
        updateLanguageSelection();
        showNotification(t('languageChanged'), 'success');
        document.getElementById('language-dialog').open = false;
    }
}

function loadSavedLanguage() {
    const savedLang = localStorage.getItem('language');
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
        updateUILanguage();
        // Delay updating language selection until DOM is ready
        setTimeout(() => {
            updateLanguageSelection();
        }, 100);
    }
}

function updateLanguageSelection() {
    // Update language dialog to show current selection
    const languageItems = document.querySelectorAll('#language-dialog mdui-list-item');
    languageItems.forEach(item => {
        const onclick = item.getAttribute('onclick');
        if (onclick) {
            const lang = onclick.match(/setLanguage\('(\w+)'\)/)?.[1];
            if (lang === currentLanguage) {
                item.style.backgroundColor = '#e3f2fd';
                item.style.fontWeight = 'bold';
                if (!item.querySelector('.current-indicator')) {
                    const indicator = document.createElement('mdui-icon');
                    indicator.className = 'current-indicator';
                    indicator.setAttribute('name', 'check');
                    indicator.style.color = '#2196f3';
                    indicator.style.marginLeft = 'auto';
                    item.appendChild(indicator);
                }
            } else {
                item.style.backgroundColor = '';
                item.style.fontWeight = '';
                const indicator = item.querySelector('.current-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        }
    });
}

// Export to global scope
window.currentLanguage = currentLanguage;
window.translations = translations;
window.t = t;
window.setLanguage = setLanguage;
window.loadSavedLanguage = loadSavedLanguage;
window.updateLanguageSelection = updateLanguageSelection;
