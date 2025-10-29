class PairDrop {

    constructor() {
        this.$headerNotificationBtn = $('notification');
        this.$headerInstallBtn = $('install');

        this.deferredStyles = [
            "styles/styles-deferred.css"
        ];
        this.deferredScripts = [
            "scripts/browser-tabs-connector.js",
            "scripts/util.js",
            "scripts/network.js",
            "scripts/ui.js",
            "scripts/libs/heic2any.min.js",
            "scripts/libs/no-sleep.min.js",
            "scripts/libs/qr-code.min.js",
            "scripts/libs/zip.min.js"
        ];

        this.registerServiceWorker();

        Events.on('beforeinstallprompt', e => this.onPwaInstallable(e));

        this.persistentStorage = new PersistentStorage();
        this.localization = new Localization();
        this.themeUI = new ThemeUI();
        this.backgroundCanvas = new BackgroundCanvas();
        this.headerUI = new HeaderUI();
        this.centerUI = new CenterUI();
        this.footerUI = new FooterUI();
        this._urlParamsEvaluated = false;

        this.initialize()
            .then(_ => {
                console.log("Initialization completed.");
            });
    }

    async initialize() {
        // Translate page before fading in
        await this.localization.setInitialTranslation()
        console.log("Initial translation successful.");

        // Show "Loading..." until connected to WsServer
        await this.footerUI.showLoading();

        // Evaluate css shifting UI elements and fade in UI elements
        await this.evaluatePermissions();
        await this.headerUI.evaluateOverflowing();
        await this.headerUI.fadeIn();
        await this.footerUI._evaluateFooterBadges();
        await this.footerUI.fadeIn();
        await this.centerUI.fadeIn();
        await this.backgroundCanvas.fadeIn();

        // Load deferred assets
        console.log("Load deferred assets...");
        await this.loadDeferredAssets();
        console.log("Loading of deferred assets completed.");

        console.log("Hydrate UI...");
        await this.hydrate();
        console.log("UI hydrated.");

        // Evaluate url params as soon as ws is connected
        console.log("Evaluate URL params as soon as websocket connection is established.");
        Events.on('ws-connected', _ => this.evaluateUrlParams(), {once: true});

        // Evaluate URL params at least once even if websocket connection is delayed
        await this.evaluateUrlParams();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('service-worker.js')
                .then(serviceWorker => {
                    console.log('Service Worker registered');
                    window.serviceWorker = serviceWorker
                });
        }
    }

    onPwaInstallable(e) {
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            // only display install btn when not installed
            this.$headerInstallBtn.removeAttribute('hidden');
            this.$headerInstallBtn.addEventListener('click', () => {
                this.$headerInstallBtn.setAttribute('hidden', true);
                e.prompt();
            });
        }
        return e.preventDefault();
    }

    async evaluatePermissions() {
        // Check whether notification permissions have already been granted
        if ('Notification' in window && Notification.permission !== 'granted') {
            this.$headerNotificationBtn.removeAttribute('hidden');
        }
    }

    loadDeferredAssets() {
        const stylePromises = this.deferredStyles.map(url => this.loadAndApplyStylesheet(url));
        const scriptPromises = this.deferredScripts.map(url => this.loadAndApplyScript(url));

        return Promise.all([...stylePromises, ...scriptPromises]);
    }

    loadStyleSheet(url) {
        return new Promise((resolve, reject) => {
            let stylesheet = document.createElement('link');
            stylesheet.rel = 'preload';
            stylesheet.as = 'style';
            stylesheet.href = url;
            stylesheet.onload = _ => {
                stylesheet.onload = null;
                stylesheet.rel = 'stylesheet';
                resolve();
            };
            stylesheet.onerror = reject;

            document.head.appendChild(stylesheet);
        });
    }

    loadAndApplyStylesheet(url) {
        return new Promise( async (resolve) => {
            try {
                await this.loadStyleSheet(url);
                console.log(`Stylesheet loaded successfully: ${url}`);
                resolve();
            } catch (error) {
                console.error('Error loading stylesheet:', error);
            }
        });
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            let script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;

            document.body.appendChild(script);
        });
    }

    loadAndApplyScript(url) {
        return new Promise( async (resolve) => {
            try {
                await this.loadScript(url);
                console.log(`Script loaded successfully: ${url}`);
                resolve();
            } catch (error) {
                console.error('Error loading script:', error);
            }
        });
    }

    _escapeHtml(value) {
        if (typeof value !== 'string') {
            return '';
        }

        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _dialogExists(id) {
        if (typeof document === 'undefined') {
            return false;
        }

        return !!document.getElementById(id);
    }

    async prepareDriveFileShare(fileId) {
        if (!fileId) {
            return;
        }

        try {
            Events.fire('notify-user', Localization.getTranslation('notifications.drive-share-prepare'));

            const encodedId = encodeURIComponent(fileId);
            const urlParams = new URLSearchParams(window.location.search);
            const shareToken = urlParams.get('token');
            const usingShareToken = Boolean(shareToken);

            const metadataUrl = usingShareToken
                ? `/api/share/${encodedId}/metadata?token=${encodeURIComponent(shareToken)}`
                : `/api/beamshare/files/${encodedId}/metadata`;
            const downloadUrl = usingShareToken
                ? `/api/share/${encodedId}/download?token=${encodeURIComponent(shareToken)}`
                : `/api/beamshare/files/${encodedId}/download`;

            const headers = usingShareToken ? { 'X-Share-Token': shareToken } : {};

            const detailsResponse = await fetch(metadataUrl, {
                method: 'GET',
                credentials: 'same-origin',
                headers
            });

            const detailsPayload = await detailsResponse.json().catch(() => null);
            if (!detailsResponse.ok) {
                const message = detailsPayload?.error || detailsPayload?.message || `Failed to fetch drive file details: ${detailsResponse.status}`;
                throw new Error(message);
            }

            const details = detailsPayload || {};

            const downloadResponse = await fetch(downloadUrl, {
                method: 'GET',
                credentials: 'same-origin',
                headers
            });

            if (!downloadResponse.ok) {
                let message = `Failed to download drive file: ${downloadResponse.status}`;
                try {
                    const errorPayload = await downloadResponse.json();
                    message = errorPayload?.error || errorPayload?.message || message;
                } catch (error) {
                    // Ignore JSON parse errors for binary response bodies
                }
                throw new Error(message);
            }

            const blob = await downloadResponse.blob();
            const fileName = details.originalName || details.displayName || details.name || fileId;
            const fileType = details.mimeType || details.type || blob.type || 'application/octet-stream';
            const lastModified = details.lastModified ? new Date(details.lastModified).getTime() : (details.modifiedDate ? new Date(details.modifiedDate).getTime() : Date.now());

            let fileObject;
            if (typeof File === 'function') {
                fileObject = new File([blob], fileName, { type: fileType, lastModified });
            } else {
                fileObject = blob;
                fileObject.name = fileName;
                fileObject.lastModified = lastModified;
            }

            Events.fire('activate-share-mode', { files: [fileObject] });

            const safeName = this._escapeHtml(fileName);
            Events.fire('notify-user', {
                message: Localization.getTranslation('notifications.drive-share-ready', null, { name: safeName }),
            });
        } catch (error) {
            console.error('Failed to prepare drive file for sharing', error);
            Events.fire('notify-user', {
                message: error.message || Localization.getTranslation('notifications.drive-share-error'),
                persistent: true
            });
        }
    }

    async hydrate() {
        this.aboutUI = new AboutUI();
        this.peersUI = new PeersUI();
        this.languageSelectDialog = this._dialogExists('language-select-dialog') ? new LanguageSelectDialog() : null;
        this.receiveFileDialog = this._dialogExists('receive-file-dialog') ? new ReceiveFileDialog() : null;
        this.receiveRequestDialog = this._dialogExists('receive-request-dialog') ? new ReceiveRequestDialog() : null;
        this.sendTextDialog = this._dialogExists('send-text-dialog') ? new SendTextDialog() : null;
        this.receiveTextDialog = this._dialogExists('receive-text-dialog') ? new ReceiveTextDialog() : null;
        this.base64Dialog = this._dialogExists('base64-dialog') ? new Base64Dialog() : null;
        this.shareTextDialog = this._dialogExists('share-text-dialog') ? new ShareTextDialog() : null;
        this.toast = this._dialogExists('toast') ? new Toast() : null;
        this.notifications = new Notifications();
        this.networkStatusUI = new NetworkStatusUI();
        this.webShareTargetUI = new WebShareTargetUI();
        this.webFileHandlersUI = new WebFileHandlersUI();
        this.noSleepUI = new NoSleepUI();
        this.broadCast = new BrowserTabsConnector();
        this.server = new ServerConnection();
        this.peers = new PeersManager(this.server);
    }

    async evaluateUrlParams() {
        if (this._urlParamsEvaluated) {
            return;
        }

        this._urlParamsEvaluated = true;

        // get url params
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.substring(1);

        // evaluate url params
        if (urlParams.has('base64text')) {
            const base64Text = urlParams.get('base64text');
            await this.base64Dialog.evaluateBase64Text(base64Text, hash);
        }
        else if (urlParams.has('base64zip')) {
            const base64Zip = urlParams.get('base64zip');
            await this.base64Dialog.evaluateBase64Zip(base64Zip, hash);
        }
        else if (urlParams.has("share_target")) {
            const shareTargetType = urlParams.get("share_target");
            const title = urlParams.get('title') || '';
            const text = urlParams.get('text') || '';
            const url = urlParams.get('url') || '';
            await this.webShareTargetUI.evaluateShareTarget(shareTargetType, title, text, url);
        }
        else if (urlParams.has("file_handler")) {
            await this.webFileHandlersUI.evaluateLaunchQueue();
        }
        else if (urlParams.has("driveFile")) {
            await this.prepareDriveFileShare(urlParams.get("driveFile"));
        }
        else if (urlParams.has("init")) {
            // legacy parameters related to remote pairing are ignored
            console.log('Ignoring deprecated init parameter:', urlParams.get("init"));
        }

        // remove url params from url
        const urlWithoutParams = getUrlWithoutArguments();
        window.history.replaceState({}, "Rewrite URL", urlWithoutParams);

        console.log("URL params evaluated.");
    }
}

const pairDrop = new PairDrop();