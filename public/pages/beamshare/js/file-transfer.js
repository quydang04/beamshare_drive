// File Transfer System
// Handles file sending, receiving, and progress tracking

function sendFilesToDevice(peerId) {
    if (selectedFiles.length === 0) {
        showNotification(t('pleaseSelectFiles'));
        return;
    }

    const conn = connections.get(peerId);
    if (!conn) {
        showNotification(t('deviceNotConnected'));
        return;
    }

    selectedFiles.forEach(file => {
        sendFile(conn, file);
    });
}

function sendFile(conn, file) {
    const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 11);

    // Store pending file send
    pendingFileSends.set(fileId, { conn, file, fileId });

    // Send file metadata and wait for acceptance
    conn.send({
        type: DataType.FILE_METADATA,
        fileId: fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
    });

    showNotification(t('waitingForAcceptance', { fileName: file.name }));
}

function startFileSend(fileId) {
    const pendingSend = pendingFileSends.get(fileId);
    if (!pendingSend) return;

    const { conn, file } = pendingSend;

    // Show progress
    showProgress(true);
    progressText.textContent = `${t('sending')} ${file.name}...`;

    // Read and send file in chunks
    const chunkSize = FILE_CHUNK_SIZE;
    let offset = 0;

    const sendChunk = () => {
        const chunk = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();

        reader.onload = (e) => {
            conn.send({
                type: DataType.FILE_CHUNK,
                fileId: fileId,
                chunk: e.target.result,
                offset: offset
            });

            offset += chunkSize;
            const progress = Math.min((offset / file.size) * 100, 100);
            progressBar.value = progress;

            if (offset < file.size) {
                setTimeout(sendChunk, 10); // Small delay to prevent overwhelming
            } else {
                // Send end signal
                conn.send({
                    type: DataType.FILE_END,
                    fileId: fileId
                });

                showProgress(false);
                showNotification(`${file.name} ${t('sentSuccessfully')}`, 'success');

                // Clean up pending send
                pendingFileSends.delete(fileId);
            }
        };

        reader.readAsArrayBuffer(chunk);
    };

    sendChunk();
}

function showProgress(show) {
    if (!progressContainer) return;
    
    progressContainer.style.display = show ? 'block' : 'none';
    if (!show) {
        if (progressBar) progressBar.value = 0;
        if (progressText) progressText.textContent = '';
    }
}

// File receiving functions
function handleFileMetadata(conn, data) {
    pendingFileTransfer = {
        conn: conn,
        fileId: data.fileId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        chunks: [],
        receivedBytes: 0
    };

    // Check if auto-accept is enabled
    const autoAccept = localStorage.getItem('auto_accept_files') === 'true';

    if (autoAccept) {
        // Auto-accept the file
        acceptFile();
        return;
    }

    const deviceName = conn.metadata?.deviceInfo?.name || 'Unknown Device';
    const fileSize = formatFileSize(data.fileSize);

    if (fileDialogMessage) {
        fileDialogMessage.innerHTML = `
            <div style="text-align: center;">
                <mdui-icon name="${getFileIcon(data.fileType)}" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 16px;"></mdui-icon>
                <div style="font-weight: 500; margin-bottom: 8px;">${data.fileName}</div>
                <div style="color: #666; margin-bottom: 8px;">${fileSize}</div>
                <div style="color: #666;">${t('from')} ${deviceName}</div>
            </div>
        `;
    }

    if (fileDialog) {
        fileDialog.open = true;
    }
}

function handleFileChunk(conn, data) {
    if (!currentFileTransfer || currentFileTransfer.fileId !== data.fileId) {
        return;
    }

    currentFileTransfer.chunks.push({
        offset: data.offset,
        chunk: data.chunk
    });

    currentFileTransfer.receivedBytes += data.chunk.byteLength;

    const progress = (currentFileTransfer.receivedBytes / currentFileTransfer.fileSize) * 100;
    if (progressBar) progressBar.value = progress;
    if (progressText) {
        progressText.textContent = `${t('receiving')} ${currentFileTransfer.fileName}... ${Math.round(progress)}%`;
    }
}

function handleFileEnd(conn, data) {
    if (!currentFileTransfer || currentFileTransfer.fileId !== data.fileId) {
        return;
    }

    // Sort chunks by offset and combine
    currentFileTransfer.chunks.sort((a, b) => a.offset - b.offset);
    const combinedChunks = currentFileTransfer.chunks.map(chunk => chunk.chunk);
    const blob = new Blob(combinedChunks, { type: currentFileTransfer.fileType });

    // Download file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileTransfer.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showProgress(false);
    showNotification(`${currentFileTransfer.fileName} ${t('receivedSuccessfully')}`, 'success');

    currentFileTransfer = null;
}

function acceptFile() {
    if (!pendingFileTransfer) return;

    currentFileTransfer = pendingFileTransfer;
    pendingFileTransfer = null;

    // Send acceptance
    currentFileTransfer.conn.send({
        type: DataType.FILE_ACCEPT,
        fileId: currentFileTransfer.fileId
    });

    if (fileDialog) {
        fileDialog.open = false;
    }
    showProgress(true);
    if (progressText) {
        progressText.textContent = `${t('receiving')} ${currentFileTransfer.fileName}...`;
    }
}

function rejectFile() {
    if (!pendingFileTransfer) return;

    // Send rejection
    pendingFileTransfer.conn.send({
        type: DataType.FILE_REJECT,
        fileId: pendingFileTransfer.fileId
    });

    pendingFileTransfer = null;
    if (fileDialog) {
        fileDialog.open = false;
    }
    showNotification(t('transferDeclined'));
}

function handleFileAccept(conn, data) {
    showNotification(t('transferAccepted'), 'success');

    // Start sending the file
    if (data.fileId) {
        startFileSend(data.fileId);
    }
}

function handleFileReject(conn, data) {
    showNotification(t('transferDeclined'), 'warning');
    showProgress(false);

    // Clean up pending file send
    if (data.fileId) {
        pendingFileSends.delete(data.fileId);
    }
}

// Export to global scope
window.sendFilesToDevice = sendFilesToDevice;
window.sendFile = sendFile;
window.startFileSend = startFileSend;
window.showProgress = showProgress;
window.handleFileMetadata = handleFileMetadata;
window.handleFileChunk = handleFileChunk;
window.handleFileEnd = handleFileEnd;
window.acceptFile = acceptFile;
window.rejectFile = rejectFile;
window.handleFileAccept = handleFileAccept;
window.handleFileReject = handleFileReject;
