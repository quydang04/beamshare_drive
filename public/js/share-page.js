(() => {
    const statusEl = document.getElementById('share-status');
    const statusTextEl = document.getElementById('share-status-text');
    const detailsEl = document.getElementById('file-details');
    const nameEl = document.getElementById('file-name');
    const descriptionEl = document.getElementById('file-description');
    const typeEl = document.getElementById('file-type');
    const formatEl = document.getElementById('file-format');
    const sizeEl = document.getElementById('file-size');
    const ownerEl = document.getElementById('file-owner');
    const updatedEl = document.getElementById('file-updated');
    const previewEl = document.getElementById('preview');
    const downloadBtn = document.getElementById('download-button');

    const pathMatch = window.location.pathname.match(/\/files\/d\/([^/]+)/);
    if (!pathMatch || !pathMatch[1]) {
        setError('Liên kết chia sẻ không hợp lệ.');
        return;
    }

    const fileId = decodeURIComponent(pathMatch[1]);
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const encodedId = encodeURIComponent(fileId);
    const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : '';

    fetch(`/api/share/${encodedId}/metadata${tokenSuffix}`, {
        headers: token ? { 'X-Share-Token': token } : undefined,
        credentials: 'include'
    })
        .then(async (response) => {
            if (response.status === 401) {
                redirectToLogin(0);
                return;
            }

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                const message = payload?.error || 'Không thể tải thông tin file.';
                setError(message);

                if (response.status === 403) {
                    redirectToLogin(600);
                }
                return;
            }

            renderDetails(payload || {});
        })
        .catch(() => {
            setError('Không thể kết nối tới máy chủ. Vui lòng thử lại sau.');
        });

    function setError(message) {
        if (statusTextEl) {
            statusTextEl.textContent = message;
        }
        statusEl.classList.remove('share-banner--neutral', 'share-banner--success');
        statusEl.classList.add('share-banner--error');
        statusEl.style.display = 'inline-flex';
        detailsEl.style.display = 'none';
    }

    function renderDetails(metadata) {
        document.title = `${metadata.displayName || metadata.originalName || 'Tệp được chia sẻ'} | BeamShare Drive`;
        statusEl.classList.remove('share-banner--neutral', 'share-banner--error');
        statusEl.classList.add('share-banner--success');
        if (statusTextEl) {
            statusTextEl.textContent = 'Liên kết chia sẻ đang hoạt động.';
        }

        if (nameEl) {
            nameEl.textContent = metadata.displayName || metadata.originalName || fileId;
        }

        if (typeEl) {
            const friendlyType = buildTypeLabel(metadata);
            typeEl.textContent = friendlyType;
        }

        if (sizeEl) {
            sizeEl.textContent = metadata.formattedSize || 'Không xác định';
        }

        if (ownerEl) {
            ownerEl.textContent = metadata.owner || 'Không xác định';
        }

        if ((updatedEl || descriptionEl) && (metadata.lastModified || metadata.uploadDate)) {
            const dateValue = metadata.lastModified || metadata.uploadDate || null;
            if (dateValue) {
                try {
                    const formatter = new Intl.DateTimeFormat('vi-VN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    });
                    const formatted = formatter.format(new Date(dateValue));
                    if (updatedEl) {
                        updatedEl.textContent = formatted;
                    }
                    if (descriptionEl) {
                        descriptionEl.textContent = buildDescription(metadata, formatted);
                    }
                } catch (_error) {
                    const fallback = new Date(dateValue).toLocaleString('vi-VN');
                    if (updatedEl) {
                        updatedEl.textContent = fallback;
                    }
                    if (descriptionEl) {
                        descriptionEl.textContent = buildDescription(metadata, fallback);
                    }
                }
            } else {
                if (updatedEl) {
                    updatedEl.textContent = 'Không xác định';
                }
                if (descriptionEl) {
                    descriptionEl.textContent = buildDescription(metadata, null);
                }
            }
        } else if (descriptionEl) {
            descriptionEl.textContent = buildDescription(metadata, null);
        }

        if (formatEl) {
            const extension = metadata.extension ? metadata.extension.toUpperCase() : '';
            if (metadata.mimeType && extension) {
                formatEl.textContent = `${extension} (${metadata.mimeType})`;
            } else if (metadata.mimeType) {
                formatEl.textContent = metadata.mimeType;
            } else if (extension) {
                formatEl.textContent = extension;
            } else {
                formatEl.textContent = 'Không xác định';
            }
        }

        configurePreview(metadata);
        configureDownload(metadata);
        detailsEl.style.display = 'grid';
    }

    function configurePreview(metadata) {
        if (!previewEl) {
            return;
        }

        if (!window.BeamPreview || typeof window.BeamPreview.render !== 'function') {
            previewEl.textContent = '';
            addPreviewMessage('Không thể khởi tạo trình xem trước. Vui lòng tải xuống để xem chi tiết.');
            return;
        }

        const previewUrl = `/api/share/${encodedId}/preview${tokenSuffix}`;
        window.BeamPreview.render(previewEl, metadata, {
            previewUrl,
            ownerName: metadata.owner || 'Không xác định',
            pdfWithCredentials: !token,
            showDisclaimer: true
        });
    }

    function configureDownload(metadata) {
        if (!downloadBtn) {
            return;
        }

        const downloadUrl = `/api/share/${encodedId}/download${tokenSuffix}`;
        downloadBtn.href = downloadUrl;
        const filename = metadata.originalName || metadata.displayName || fileId;
        downloadBtn.setAttribute('download', filename);
    }

    function buildTypeLabel(metadata) {
        if (!metadata) {
            return 'Tệp BeamShare';
        }

        if (metadata.extension) {
            return metadata.extension.toUpperCase();
        }

        if (metadata.mimeType) {
            return metadata.mimeType.split('/')[0].toUpperCase();
        }

        return 'Tệp BeamShare';
    }

    function buildDescription(metadata, formattedDate) {
        const parts = [];
        if (metadata.formattedSize) {
            parts.push(metadata.formattedSize);
        }
        if (formattedDate) {
            parts.push(`Cập nhật ${formattedDate}`);
        }
        if (metadata.owner) {
            parts.push(`Chủ sở hữu ${metadata.owner}`);
        }
        return parts.join(' | ') || 'Liên kết từ BeamShare Drive';
    }

    function redirectToLogin(delayMs) {
        const ms = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : 0;
        setTimeout(() => {
            window.location.replace('/auth/login');
        }, ms);
    }

    function addPreviewMessage(message) {
        if (!previewEl) {
            return;
        }
        const helper = document.createElement('p');
        helper.className = 'share-preview-message';
        helper.textContent = message;
        previewEl.appendChild(helper);
    }
})();
