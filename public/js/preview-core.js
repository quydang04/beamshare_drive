(() => {
    if (window.BeamPreview) {
        return;
    }

    const DISCLAIMER_TEXT = 'Xem trước có thể khác với file gốc, vui lòng tải về để xem chính xác.';
    const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    function render(container, metadata = {}, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        const previewUrl = options.previewUrl;
        if (!previewUrl) {
            showUnsupportedMessage(container, 'Không thể tạo bản xem trước. Vui lòng tải xuống để xem chi tiết.');
            return;
        }

        const extensionRaw = String(metadata.extension || '').toLowerCase();
        const extension = extensionRaw
            ? extensionRaw.startsWith('.') ? extensionRaw : `.${extensionRaw}`
            : '';
        const mimeType = String(metadata.mimeType || '').toLowerCase();

        const context = {
            container,
            metadata,
            previewUrl,
            options: {
                showDisclaimer: options.showDisclaimer !== false,
                ownerName: options.ownerName || metadata.owner || 'Không xác định',
                pdfWithCredentials: Boolean(options.pdfWithCredentials),
                disclaimerMessage: options.disclaimerMessage || DISCLAIMER_TEXT
            }
        };

        if (metadata.isImage) {
            renderImagePreview(context);
            return;
        }

        if (metadata.isVideo || extension === '.mkv' || mimeType === 'video/x-matroska') {
            renderVideoPreview(context);
            return;
        }

        if (metadata.isAudio) {
            renderAudioPreview(context);
            return;
        }

        if (extension === '.pdf' || mimeType === 'application/pdf') {
            renderPdfPreview(context);
            return;
        }

        if (extension === '.docx') {
            renderDocxPreview(context);
            return;
        }

        if (extension === '.doc') {
            showUnsupportedMessage(context.container, 'Định dạng Word (.doc) chưa được hỗ trợ xem trước. Vui lòng tải về để xem đầy đủ.');
            return;
        }

        if (extension === '.xlsx' || extension === '.xls') {
            renderExcelPreview(context);
            return;
        }

        if (extension === '.ppt' || extension === '.pptx') {
            showUnsupportedMessage(context.container, 'Không hỗ trợ xem trước với file PowerPoint. Vui lòng tải về để xem đầy đủ.');
            return;
        }

        showUnsupportedMessage(context.container, 'Không có bản xem trước cho loại tệp này. Hãy tải xuống để mở bằng ứng dụng tương ứng.');
    }

    function renderImagePreview(context) {
        const disclaimer = maybeAppendDisclaimer(context.container, context.options);
        const img = document.createElement('img');
        img.alt = context.metadata.displayName || context.metadata.originalName || 'Xem trước hình ảnh';
        img.src = context.previewUrl;
        img.loading = 'lazy';
        context.container.appendChild(img);
        return disclaimer;
    }

    function renderVideoPreview(context) {
        maybeAppendDisclaimer(context.container, context.options);

        const card = document.createElement('div');
        card.className = 'media-card media-card--video';

        const video = document.createElement('video');
        video.className = 'media-element';
        video.preload = 'metadata';
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.controls = false;
        video.src = context.previewUrl;
        if (context.metadata.mimeType) {
            const source = document.createElement('source');
            source.src = context.previewUrl;
            source.type = context.metadata.mimeType;
            video.innerHTML = '';
            video.appendChild(source);
        }

        card.appendChild(video);

        const controlsBundle = buildMediaControls({
            playLabel: 'Phát hoặc tạm dừng video',
            showFullscreen: true
        });
        card.appendChild(controlsBundle.controls);

        const meta = document.createElement('div');
        meta.className = 'media-meta';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = context.metadata.displayName || context.metadata.originalName || 'Video';
        meta.appendChild(nameSpan);

        if (context.metadata.formattedSize) {
            const sizeSpan = document.createElement('span');
            sizeSpan.textContent = context.metadata.formattedSize;
            meta.appendChild(sizeSpan);
        }

        card.appendChild(meta);
        context.container.appendChild(card);

        initMediaControls(video, card, controlsBundle, {
            autoHideControls: true,
            isVideo: true
        });
    }

    function renderAudioPreview(context) {
        maybeAppendDisclaimer(context.container, context.options);

        const card = document.createElement('div');
        card.className = 'media-card media-card--audio';

        const audio = document.createElement('audio');
        audio.className = 'media-element';
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        audio.src = context.previewUrl;
        audio.load();
        card.appendChild(audio);

        const hero = document.createElement('div');
        hero.className = 'audio-hero';

        const cover = document.createElement('div');
        cover.className = 'audio-cover';
        cover.setAttribute('data-has-cover', 'false');
        hero.appendChild(cover);

        const coverImg = document.createElement('img');
        coverImg.alt = 'Bìa album';
        coverImg.style.display = 'none';
        cover.appendChild(coverImg);

        const info = document.createElement('div');
        const titleEl = document.createElement('h3');
        titleEl.className = 'audio-info-title';
        titleEl.textContent = context.metadata.displayName || context.metadata.originalName || 'Bản nhạc';
        const artistEl = document.createElement('p');
        artistEl.className = 'audio-info-artist';
        artistEl.textContent = 'Đang tải thông tin nghệ sĩ…';
        info.appendChild(titleEl);
        info.appendChild(artistEl);
        hero.appendChild(info);
        card.appendChild(hero);

        const controlsBundle = buildMediaControls({
            playLabel: 'Phát hoặc tạm dừng nhạc',
            showFullscreen: false
        });
        card.appendChild(controlsBundle.controls);
        context.container.appendChild(card);

        initMediaControls(audio, card, controlsBundle, {
            autoHideControls: false,
            isVideo: false
        });

        if (window.jsmediatags) {
            loadAudioTags(context.previewUrl)
                .then((tags) => {
                    if (tags.title) {
                        titleEl.textContent = tags.title;
                    }
                    if (tags.artist) {
                        artistEl.textContent = tags.artist;
                    } else {
                        artistEl.textContent = context.options.ownerName;
                    }
                    if (tags.picture) {
                        const dataUrl = buildPictureDataUrl(tags.picture);
                        if (dataUrl) {
                            coverImg.src = dataUrl;
                            coverImg.style.display = 'block';
                            cover.setAttribute('data-has-cover', 'true');
                        }
                    }
                })
                .catch(() => {
                    artistEl.textContent = context.options.ownerName;
                });
        } else {
            artistEl.textContent = context.options.ownerName;
        }
    }

    function renderPdfPreview(context) {
        const disclaimer = maybeAppendDisclaimer(context.container, context.options);

        if (!window.pdfjsLib) {
            showUnsupportedMessage(context.container, 'Không thể tải thư viện xem trước PDF. Vui lòng tải về để xem đầy đủ.');
            return;
        }

        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const card = document.createElement('div');
        card.className = 'preview-pdf-card';
        const loader = createLoader('Đang tải xem trước PDF…');
        const canvas = document.createElement('canvas');
        canvas.className = 'preview-pdf-canvas';
        card.appendChild(loader);
        card.appendChild(canvas);
        context.container.appendChild(card);

        const pdfOptions = { url: context.previewUrl };
        if (context.options.pdfWithCredentials) {
            pdfOptions.withCredentials = true;
        }

        window.pdfjsLib.getDocument(pdfOptions).promise
            .then((pdf) => pdf.getPage(1))
            .then((page) => {
                const viewport = page.getViewport({ scale: 1.2 });
                const renderContext = canvas.getContext('2d', { alpha: false });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                return page.render({ canvasContext: renderContext, viewport }).promise;
            })
            .then(() => {
                loader.remove();
            })
            .catch(() => {
                loader.remove();
                card.remove();
                if (disclaimer && disclaimer.parentElement === context.container) {
                    context.container.removeChild(disclaimer);
                }
                showUnsupportedMessage(context.container, 'Không thể hiển thị xem trước PDF. Vui lòng tải về để xem chính xác.');
            });
    }

    function renderDocxPreview(context) {
        maybeAppendDisclaimer(context.container, context.options);

        if (!window.mammoth) {
            showUnsupportedMessage(context.container, 'Không thể tải thư viện xem trước Word. Vui lòng tải về để xem đầy đủ.');
            return;
        }

        const card = document.createElement('div');
        card.className = 'preview-doc-card';
        const body = document.createElement('div');
        body.className = 'preview-doc-body';
        body.textContent = 'Đang tải nội dung tài liệu…';
        card.appendChild(body);
        context.container.appendChild(card);

        fetch(context.previewUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Không thể tải tệp Word');
                }
                return response.arrayBuffer();
            })
            .then((buffer) => window.mammoth.convertToHtml({ arrayBuffer: buffer }))
            .then((result) => {
                const content = result.value?.trim();
                if (content) {
                    body.innerHTML = content;
                } else {
                    body.innerHTML = '<p>Không có nội dung để hiển thị.</p>';
                }
            })
            .catch(() => {
                body.innerHTML = '<p>Không thể hiển thị nội dung tài liệu. Vui lòng tải xuống để xem chi tiết.</p>';
            });
    }

    function renderExcelPreview(context) {
        maybeAppendDisclaimer(context.container, context.options);

        if (!window.XLSX) {
            showUnsupportedMessage(context.container, 'Không thể tải thư viện xem trước Excel. Vui lòng tải về để xem đầy đủ.');
            return;
        }

        const card = document.createElement('div');
        card.className = 'preview-excel-card';
        const body = document.createElement('div');
        body.className = 'preview-excel-body';
        body.textContent = 'Đang tải dữ liệu bảng tính…';
        card.appendChild(body);
        context.container.appendChild(card);

        fetch(context.previewUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Không thể tải tệp Excel');
                }
                return response.arrayBuffer();
            })
            .then((buffer) => {
                const workbook = window.XLSX.read(buffer, { type: 'array' });
                const firstSheet = workbook.SheetNames?.[0];
                if (!firstSheet) {
                    throw new Error('Không tìm thấy dữ liệu bảng tính');
                }
                const sheet = workbook.Sheets[firstSheet];
                const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
                if (!rows || rows.length === 0) {
                    throw new Error('Bảng tính không có dữ liệu');
                }

                const table = document.createElement('table');
                rows.forEach((row, rowIndex) => {
                    const tr = document.createElement('tr');
                    row.forEach((cell) => {
                        const cellEl = document.createElement(rowIndex === 0 ? 'th' : 'td');
                        cellEl.textContent = typeof cell === 'number' ? cell.toString() : (cell || '');
                        tr.appendChild(cellEl);
                    });
                    table.appendChild(tr);
                });

                body.innerHTML = '';
                body.appendChild(table);
            })
            .catch(() => {
                body.textContent = 'Không thể hiển thị dữ liệu bảng tính. Vui lòng tải về để xem chi tiết.';
            });
    }

    function showUnsupportedMessage(container, message) {
        const helper = document.createElement('p');
        helper.className = 'share-preview-message';
        helper.textContent = message;
        container.appendChild(helper);
    }

    function maybeAppendDisclaimer(container, options) {
        if (!options.showDisclaimer) {
            return null;
        }
        const existing = container.querySelector('.preview-disclaimer');
        if (existing) {
            return existing;
        }
        const disclaimer = document.createElement('p');
        disclaimer.className = 'preview-disclaimer';
        disclaimer.textContent = options.disclaimerMessage;
        container.appendChild(disclaimer);
        return disclaimer;
    }

    function createLoader(message) {
        const loader = document.createElement('div');
        loader.className = 'preview-loader';
        loader.textContent = message;
        return loader;
    }

    function buildMediaControls(options) {
        const controls = document.createElement('div');
        controls.className = 'media-controls';

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'media-button';
        playBtn.setAttribute('aria-label', options.playLabel || 'Phát/tạm dừng');
        playBtn.innerHTML = '&#9658;';

        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'media-progress-wrapper';

        const currentTimeEl = document.createElement('span');
        currentTimeEl.className = 'media-time media-time--current';
        currentTimeEl.textContent = '00:00';

        const progress = document.createElement('input');
        progress.type = 'range';
        progress.className = 'media-progress';
        progress.min = '0';
        progress.max = '1000';
        progress.value = '0';
        progress.style.setProperty('--progress-value', '0%');

        const durationEl = document.createElement('span');
        durationEl.className = 'media-time media-time--duration';
        durationEl.textContent = '--:--';

        progressWrapper.appendChild(currentTimeEl);
        progressWrapper.appendChild(progress);
        progressWrapper.appendChild(durationEl);

        const volume = document.createElement('input');
        volume.type = 'range';
        volume.className = 'media-volume';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.01';
        volume.value = '0.75';

        controls.appendChild(playBtn);
        controls.appendChild(progressWrapper);
        controls.appendChild(volume);

        let fullscreenBtn = null;
        if (options.showFullscreen && document.fullscreenEnabled) {
            fullscreenBtn = document.createElement('button');
            fullscreenBtn.type = 'button';
            fullscreenBtn.className = 'media-button media-button--secondary';
            fullscreenBtn.setAttribute('aria-label', 'Bật/tắt toàn màn hình');
            fullscreenBtn.textContent = '\u2922';
            controls.appendChild(fullscreenBtn);
        }

        return {
            controls,
            elements: {
                playBtn,
                progress,
                currentTimeEl,
                durationEl,
                volume,
                fullscreenBtn
            }
        };
    }

    function initMediaControls(media, container, bundle, options = {}) {
        const { controls, elements } = bundle;
        const { playBtn, progress, currentTimeEl, durationEl, volume, fullscreenBtn } = elements;
        const config = {
            autoHideControls: false,
            isVideo: false,
            ...options
        };
        const syncProgressBackground = () => {
            const value = parseFloat(progress.value) || 0;
            const percent = Math.max(0, Math.min(100, value / 10));
            progress.style.setProperty('--progress-value', `${percent}%`);
        };
        if (!media) {
            return;
        }

        const metaOverlay = config.isVideo ? container.querySelector('.media-meta') : null;

        media.volume = parseFloat(volume.value) || 0.75;

        const updatePlayVisual = () => {
            playBtn.innerHTML = media.paused ? '&#9658;' : '&#10073;&#10073;';
        };

        const updateDurationLabel = () => {
            if (isFinite(media.duration) && media.duration > 0) {
                durationEl.textContent = formatTime(media.duration);
            } else if (media.seekable && media.seekable.length > 0) {
                const end = media.seekable.end(media.seekable.length - 1);
                durationEl.textContent = formatTime(end);
            } else {
                durationEl.textContent = '--:--';
            }
        };

        let showControls = () => {};
        let hideControls = () => {};
        let cancelControlsHide = () => {};
        let scheduleControlsHide = () => {};

        playBtn.addEventListener('click', () => {
            if (media.paused) {
                media.play().catch(() => {
                    // autoplay prevented, ignore
                });
            } else {
                media.pause();
            }
        });

        media.addEventListener('play', () => {
            updatePlayVisual();
            if (config.autoHideControls) {
                showControls();
                scheduleControlsHide();
            }
        });
        media.addEventListener('pause', () => {
            updatePlayVisual();
            if (config.autoHideControls) {
                showControls();
                cancelControlsHide();
            }
        });
        media.addEventListener('ended', () => {
            progress.value = '0';
            currentTimeEl.textContent = '00:00';
            syncProgressBackground();
            updatePlayVisual();
            if (config.autoHideControls) {
                showControls();
            }
        });

        media.addEventListener('loadedmetadata', () => {
            updateDurationLabel();
            volume.value = media.volume.toString();
        });

        media.addEventListener('durationchange', updateDurationLabel);

        let isSeeking = false;

        media.addEventListener('timeupdate', () => {
            if (isSeeking) {
                return;
            }

            let ratio = 0;
            if (isFinite(media.duration) && media.duration > 0) {
                ratio = media.currentTime / media.duration;
            } else if (media.duration === Infinity && media.seekable && media.seekable.length > 0) {
                const end = media.seekable.end(media.seekable.length - 1);
                if (Number.isFinite(end) && end > 0) {
                    ratio = media.currentTime / end;
                }
            }

            const clampedRatio = Math.max(0, Math.min(1, ratio || 0));
            progress.value = Math.round(clampedRatio * 1000).toString();
            currentTimeEl.textContent = formatTime(media.currentTime);
            syncProgressBackground();
        });

        progress.addEventListener('input', () => {
            isSeeking = true;
            const ratio = parseFloat(progress.value) / 1000;
            const targetDuration = getSeekableDuration(media);
            if (!targetDuration) {
                syncProgressBackground();
                return;
            }
            const newTime = targetDuration * ratio;
            currentTimeEl.textContent = formatTime(newTime);
            syncProgressBackground();
        });

        progress.addEventListener('change', () => {
            const ratio = parseFloat(progress.value) / 1000;
            const targetDuration = getSeekableDuration(media);
            if (targetDuration) {
                media.currentTime = targetDuration * ratio;
            }
            isSeeking = false;
            syncProgressBackground();
        });

        volume.addEventListener('input', () => {
            const value = parseFloat(volume.value);
            const normalized = Number.isFinite(value) ? value : media.volume;
            media.volume = Math.min(Math.max(normalized, 0), 1);
            media.muted = media.volume <= 0;
        });

        media.addEventListener('volumechange', () => {
            const effectiveVolume = media.muted ? 0 : media.volume;
            volume.value = effectiveVolume.toFixed(2);
        });

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    if (container.requestFullscreen) {
                        container.requestFullscreen().catch(() => {
                            // ignore failure
                        });
                    }
                } else if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {
                        // ignore failure
                    });
                }
            });
        }

        updatePlayVisual();
        updateDurationLabel();
        syncProgressBackground();

        if (config.autoHideControls && controls) {
            controls.classList.add('media-controls--active');
            const HIDE_DELAY = 5000; // Hide controls after 5s of inactivity
            let hideTimer = null;

            showControls = () => {
                controls.classList.remove('media-controls--hidden');
                if (metaOverlay) {
                    metaOverlay.classList.remove('media-meta--hidden');
                }
            };

            hideControls = () => {
                if (media.paused) {
                    return;
                }
                controls.classList.add('media-controls--hidden');
                if (metaOverlay) {
                    metaOverlay.classList.add('media-meta--hidden');
                }
            };

            cancelControlsHide = () => {
                if (hideTimer) {
                    clearTimeout(hideTimer);
                    hideTimer = null;
                }
            };

            scheduleControlsHide = () => {
                cancelControlsHide();
                if (media.paused) {
                    return;
                }
                hideTimer = window.setTimeout(hideControls, HIDE_DELAY);
            };

            const handleUserActivity = () => {
                // General pointer activity: show and restart hide timer
                showControls();
                scheduleControlsHide();
            };

            const startUserInteraction = () => {
                // While interacting (dragging, touching, focusing inputs), keep controls visible
                showControls();
                cancelControlsHide();
            };

            const endUserInteraction = () => {
                // When done interacting, start the hide timer again
                showControls();
                scheduleControlsHide();
            };

            container.addEventListener('mousemove', handleUserActivity);
            container.addEventListener('touchstart', handleUserActivity, { passive: true });
            controls.addEventListener('mousemove', handleUserActivity);

            // Keep controls visible while user is interacting with them
            controls.addEventListener('mousedown', startUserInteraction);
            controls.addEventListener('mouseup', endUserInteraction);
            controls.addEventListener('touchstart', startUserInteraction, { passive: true });
            controls.addEventListener('touchend', endUserInteraction);
            controls.addEventListener('focusin', startUserInteraction);
            controls.addEventListener('focusout', endUserInteraction);

            // Sliders adjustments should prevent hide until finished
            progress.addEventListener('input', startUserInteraction);
            progress.addEventListener('change', endUserInteraction);
            volume.addEventListener('input', startUserInteraction);
            volume.addEventListener('change', endUserInteraction);

            document.addEventListener('fullscreenchange', () => {
                const isFull = document.fullscreenElement === container;
                container.classList.toggle('is-fullscreen', Boolean(isFull));
                showControls();
                scheduleControlsHide();
            });

            media.addEventListener('play', () => {
                showControls();
                scheduleControlsHide();
            });

            media.addEventListener('pause', () => {
                showControls();
                cancelControlsHide();
            });

            container.addEventListener('mouseleave', () => {
                if (document.fullscreenElement === container) {
                    scheduleControlsHide();
                }
            });

            controls.dataset.hideManaged = 'true';
            if (metaOverlay) {
                metaOverlay.dataset.hideManaged = 'true';
            }
        }
    }

    function getSeekableDuration(media) {
        if (isFinite(media.duration) && media.duration > 0) {
            return media.duration;
        }
        if (media.duration === Infinity && media.seekable && media.seekable.length > 0) {
            const end = media.seekable.end(media.seekable.length - 1);
            if (Number.isFinite(end) && end > 0) {
                return end;
            }
        }
        return null;
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) {
            return '--:--';
        }
        const total = Math.max(seconds, 0);
        const mins = Math.floor(total / 60);
        const secs = Math.floor(total % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function loadAudioTags(url) {
        return new Promise((resolve, reject) => {
            if (!window.jsmediatags) {
                reject(new Error('Thiếu thư viện jsmediatags'));
                return;
            }
            window.jsmediatags.read(url, {
                onSuccess: (result) => {
                    resolve(result?.tags || {});
                },
                onError: (error) => {
                    reject(error);
                }
            });
        });
    }

    function buildPictureDataUrl(picture) {
        if (!picture || !picture.data || !picture.format) {
            return null;
        }
        try {
            const byteArray = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data);
            const chunk = 0x8000;
            let binary = '';
            for (let i = 0; i < byteArray.length; i += chunk) {
                const slice = byteArray.subarray(i, i + chunk);
                binary += String.fromCharCode.apply(null, slice);
            }
            const base64 = window.btoa(binary);
            return `data:${picture.format};base64,${base64}`;
        } catch (_error) {
            return null;
        }
    }

    window.BeamPreview = {
        render
    };
})();
