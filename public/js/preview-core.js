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
        
        const wrapper = document.createElement('div');
        wrapper.className = 'image-preview-wrapper';
        
        const img = document.createElement('img');
        img.className = 'image-preview-element';
        img.alt = context.metadata.displayName || context.metadata.originalName || 'Xem trước hình ảnh';
        img.src = context.previewUrl;
        img.loading = 'lazy';
        
        // Add click to view full size
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            if (img.classList.contains('image-fullsize')) {
                img.classList.remove('image-fullsize');
                img.style.cursor = 'zoom-in';
            } else {
                img.classList.add('image-fullsize');
                img.style.cursor = 'zoom-out';
            }
        });
        
        wrapper.appendChild(img);
        context.container.appendChild(wrapper);
        return disclaimer;
    }

    function renderVideoPreview(context) {
        const disclaimer = maybeAppendDisclaimer(context.container, context.options);

        if (!window.videojs) {
            if (disclaimer && disclaimer.parentElement === context.container) {
                context.container.removeChild(disclaimer);
            }
            showUnsupportedMessage(context.container, 'Không thể tải Video.js để phát video này. Vui lòng tải xuống để xem.');
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'video-preview';

        const video = document.createElement('video');
        video.className = 'video-js vjs-big-play-centered';
        video.setAttribute('controls', 'controls');
        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('data-setup', '{}');

        const source = document.createElement('source');
        source.src = context.previewUrl;
        source.type = context.metadata.mimeType || 'video/mp4';
        video.appendChild(source);

        wrapper.appendChild(video);
        context.container.appendChild(wrapper);

        try {
            window.videojs(video, {
                controls: true,
                preload: 'metadata',
                fluid: true,
                sources: [
                    {
                        src: context.previewUrl,
                        type: context.metadata.mimeType || 'video/mp4'
                    }
                ]
            });
        } catch (_error) {
            wrapper.remove();
            if (disclaimer && disclaimer.parentElement === context.container) {
                context.container.removeChild(disclaimer);
            }
            showUnsupportedMessage(context.container, 'Không thể khởi tạo trình phát video. Vui lòng tải xuống để xem.');
        }
    }

    function renderAudioPreview(context) {
        maybeAppendDisclaimer(context.container, context.options);

        const audio = document.createElement('audio');
        audio.setAttribute('controls', 'controls');
        audio.setAttribute('preload', 'metadata');
        audio.src = context.previewUrl;

        if (context.metadata.mimeType) {
            const source = document.createElement('source');
            source.src = context.previewUrl;
            source.type = context.metadata.mimeType;
            audio.appendChild(source);
        }

        const helper = document.createElement('p');
        helper.className = 'share-preview-message';
        helper.textContent = context.metadata.displayName || context.metadata.originalName || 'Bản nhạc';

        context.container.appendChild(audio);
        context.container.appendChild(helper);
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
    window.BeamPreview = {
        render
    };
})();
