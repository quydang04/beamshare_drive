// File Conflict Resolution System
class ConflictResolutionSystem {
    constructor() {
        this.activeConflicts = new Map();
    }

    // Show conflict resolution modal
    showConflictModal(file, existingFile) {
        return new Promise((resolve) => {
            const conflictId = `conflict-${Date.now()}`;
            
            // Create conflict resolution content
            const content = document.createElement('div');
            content.className = 'conflict-resolution-container';
            content.innerHTML = `
                <div class="conflict-info">
                    <div class="conflict-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="conflict-message">
                        <h4>File Name Conflict</h4>
                        <p>A file named "<strong>${file.name}</strong>" already exists.</p>
                    </div>
                </div>
                
                <div class="conflict-options">
                    <div class="conflict-option" data-action="replace">
                        <div class="option-icon">
                            <i class="fas fa-sync-alt"></i>
                        </div>
                        <div class="option-content">
                            <h5>Replace Existing File</h5>
                            <p>The existing file will be permanently deleted and replaced with the new one.</p>
                        </div>
                        <div class="option-radio">
                            <input type="radio" name="conflict-action" value="replace" id="action-replace-${conflictId}">
                            <label for="action-replace-${conflictId}"></label>
                        </div>
                    </div>
                    
                    <div class="conflict-option" data-action="rename">
                        <div class="option-icon">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div class="option-content">
                            <h5>Rename New File</h5>
                            <p>Keep both files by giving the new file a different name.</p>
                            <div class="rename-input-container" style="display: none;">
                                <input type="text" class="rename-input" placeholder="Enter new filename" value="${this.generateAlternativeName(file.name)}">
                                <div class="rename-error" style="display: none;"></div>
                            </div>
                        </div>
                        <div class="option-radio">
                            <input type="radio" name="conflict-action" value="rename" id="action-rename-${conflictId}">
                            <label for="action-rename-${conflictId}"></label>
                        </div>
                    </div>
                    
                    <div class="conflict-option" data-action="cancel">
                        <div class="option-icon">
                            <i class="fas fa-times"></i>
                        </div>
                        <div class="option-content">
                            <h5>Cancel Upload</h5>
                            <p>Don't upload this file and keep the existing one.</p>
                        </div>
                        <div class="option-radio">
                            <input type="radio" name="conflict-action" value="cancel" id="action-cancel-${conflictId}">
                            <label for="action-cancel-${conflictId}"></label>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners for radio buttons
            const radioButtons = content.querySelectorAll('input[name="conflict-action"]');
            const renameInput = content.querySelector('.rename-input');
            const renameContainer = content.querySelector('.rename-input-container');
            const renameError = content.querySelector('.rename-error');

            radioButtons.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.value === 'rename') {
                        renameContainer.style.display = 'block';
                        setTimeout(() => renameInput.focus(), 100);
                    } else {
                        renameContainer.style.display = 'none';
                        renameError.style.display = 'none';
                    }
                });
            });

            // Validate rename input
            const validateRename = async () => {
                const newName = renameInput.value.trim();
                if (!newName) {
                    renameError.textContent = 'Filename cannot be empty';
                    renameError.style.display = 'block';
                    return false;
                }

                // Check for invalid characters
                const invalidChars = /[<>:"/\\|?*]/;
                if (invalidChars.test(newName)) {
                    renameError.textContent = 'Filename contains invalid characters';
                    renameError.style.display = 'block';
                    return false;
                }

                // Check if new name conflicts
                try {
                    const response = await fetch('/api/files/check-conflict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: newName })
                    });
                    const result = await response.json();
                    
                    if (result.hasConflict) {
                        renameError.textContent = 'A file with this name already exists';
                        renameError.style.display = 'block';
                        return false;
                    }
                } catch (error) {
                    console.error('Error checking conflict:', error);
                }

                renameError.style.display = 'none';
                return true;
            };

            renameInput.addEventListener('input', validateRename);

            // Create modal
            const modal = window.modalSystem.createModal({
                title: 'File Name Conflict',
                content: content,
                buttons: [
                    {
                        text: 'Cancel',
                        className: 'btn-secondary',
                        onclick: () => {
                            window.modalSystem.closeModal();
                            resolve({ action: 'cancel' });
                        }
                    },
                    {
                        text: 'Continue',
                        className: 'btn-primary',
                        onclick: async () => {
                            const selectedAction = content.querySelector('input[name="conflict-action"]:checked');
                            if (!selectedAction) {
                                window.toastSystem.warning('Please select an action');
                                return;
                            }

                            const action = selectedAction.value;
                            let result = { action };

                            if (action === 'rename') {
                                const isValid = await validateRename();
                                if (!isValid) {
                                    return;
                                }
                                result.newName = renameInput.value.trim();
                            }

                            window.modalSystem.closeModal();
                            resolve(result);
                        }
                    }
                ]
            });

            // Store conflict reference
            this.activeConflicts.set(conflictId, { modal, file, existingFile });
        });
    }

    // Generate alternative filename
    generateAlternativeName(originalName) {
        const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
        const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
        
        // Try different naming patterns
        const patterns = [
            `${baseName} (Copy)${ext}`,
            `${baseName} (1)${ext}`,
            `${baseName} - Copy${ext}`,
            `Copy of ${baseName}${ext}`
        ];

        return patterns[0]; // Return first pattern as default
    }

    // Handle file upload with conflict resolution
    async handleUploadWithConflictResolution(file, uploadFunction) {
        try {
            // Check for conflicts first
            const conflictResponse = await fetch('/api/files/check-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name })
            });

            const conflictResult = await conflictResponse.json();

            if (conflictResult.hasConflict) {
                // Show conflict resolution modal
                const resolution = await this.showConflictModal(file, conflictResult.existingFile);

                if (resolution.action === 'cancel') {
                    return { success: false, cancelled: true };
                }

                // Proceed with upload based on resolution
                return await uploadFunction(file, resolution);
            } else {
                // No conflict, proceed with normal upload
                return await uploadFunction(file, { action: 'upload' });
            }
        } catch (error) {
            console.error('Error in conflict resolution:', error);
            window.toastSystem.error('Error checking for file conflicts');
            return { success: false, error: error.message };
        }
    }
}

// Global conflict resolution instance
window.conflictResolution = new ConflictResolutionSystem();
