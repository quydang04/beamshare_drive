// Modal System - Reusable modal component with proper focus management
class ModalSystem {
    constructor() {
        this.activeModal = null;
        this.previousFocus = null;
        this.isProcessing = false;
        this.init();
    }

    init() {
        // Add ESC key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });

        // Prevent multiple modals
        this.preventDuplicateModals();
    }

    preventDuplicateModals() {
        // Remove any existing modals before creating new ones
        const existingModals = document.querySelectorAll('.modal-overlay');
        existingModals.forEach(modal => modal.remove());
    }

    createModal(config) {
        // Prevent duplicate modals
        if (this.activeModal) {
            this.closeModal();
        }

        this.preventDuplicateModals();
        this.previousFocus = document.activeElement;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'modal-title');

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const title = document.createElement('h3');
        title.id = 'modal-title';
        title.textContent = config.title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.setAttribute('aria-label', 'Đóng modal');
        closeBtn.onclick = () => this.closeModal();

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof config.content === 'string') {
            body.innerHTML = config.content;
        } else {
            body.appendChild(config.content);
        }

        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        if (config.buttons) {
            config.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = btn.className || 'btn-secondary';
                button.textContent = btn.text;
                button.disabled = btn.disabled || false;
                
                if (btn.onclick) {
                    button.onclick = (e) => {
                        e.preventDefault();
                        btn.onclick(e, this);
                    };
                }

                footer.appendChild(button);
            });
        }

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        if (config.buttons) {
            modalContent.appendChild(footer);
        }

        modal.appendChild(modalContent);

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.body.appendChild(modal);
        this.activeModal = modal;

        // Focus management
        this.setupFocusTrap(modal);
        
        // Auto-focus
        setTimeout(() => {
            if (config.autoFocus) {
                const focusElement = modal.querySelector(config.autoFocus);
                if (focusElement) {
                    focusElement.focus();
                }
            } else {
                // Default focus to first button or close button
                const firstButton = modal.querySelector('.modal-footer button, .modal-close');
                if (firstButton) {
                    firstButton.focus();
                }
            }
        }, 100);

        return modal;
    }

    setupFocusTrap(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });
    }

    closeModal() {
        if (this.activeModal) {
            this.activeModal.remove();
            this.activeModal = null;
            
            // Restore focus
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        }
        this.isProcessing = false;
    }

    setProcessing(processing) {
        this.isProcessing = processing;
        if (this.activeModal) {
            const buttons = this.activeModal.querySelectorAll('button');
            buttons.forEach(btn => {
                if (!btn.classList.contains('modal-close')) {
                    btn.disabled = processing;
                }
            });
        }
    }

    // Confirmation dialog
    confirm(config) {
        return new Promise((resolve) => {
            this.createModal({
                title: config.title || 'Xác nhận',
                content: config.message || 'Bạn có chắc chắn muốn thực hiện hành động này?',
                autoFocus: '.btn-danger',
                buttons: [
                    {
                        text: config.cancelText || 'Hủy',
                        className: 'btn-secondary',
                        onclick: () => {
                            this.closeModal();
                            resolve(false);
                        }
                    },
                    {
                        text: config.confirmText || 'Xác nhận',
                        className: config.confirmClass || 'btn-danger',
                        onclick: () => {
                            this.closeModal();
                            resolve(true);
                        }
                    }
                ]
            });
        });
    }

    // Input dialog
    prompt(config) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'modal-input';
            input.value = config.defaultValue || '';
            input.placeholder = config.placeholder || '';

            const errorDiv = document.createElement('div');
            errorDiv.className = 'modal-error';
            errorDiv.style.display = 'none';

            const container = document.createElement('div');
            if (config.message) {
                const message = document.createElement('p');
                message.textContent = config.message;
                container.appendChild(message);
            }
            container.appendChild(input);
            container.appendChild(errorDiv);

            // Real-time validation
            const validateInput = () => {
                const value = input.value.trim();
                let isValid = true;
                let errorMessage = '';

                if (config.required && !value) {
                    isValid = false;
                    errorMessage = 'Trường này là bắt buộc';
                } else if (config.validator) {
                    const result = config.validator(value);
                    if (result !== true) {
                        isValid = false;
                        errorMessage = result;
                    }
                }

                if (isValid) {
                    errorDiv.style.display = 'none';
                    input.classList.remove('error');
                } else {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                    input.classList.add('error');
                }

                // Enable/disable confirm button
                const confirmBtn = this.activeModal.querySelector('.btn-primary');
                if (confirmBtn) {
                    confirmBtn.disabled = !isValid || this.isProcessing;
                }

                return isValid;
            };

            input.addEventListener('input', validateInput);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && validateInput()) {
                    const confirmBtn = this.activeModal.querySelector('.btn-primary');
                    if (confirmBtn && !confirmBtn.disabled) {
                        confirmBtn.click();
                    }
                }
            });

            this.createModal({
                title: config.title || 'Nhập thông tin',
                content: container,
                autoFocus: '.modal-input',
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onclick: () => {
                            this.closeModal();
                            resolve(null);
                        }
                    },
                    {
                        text: config.confirmText || 'Xác nhận',
                        className: 'btn-primary',
                        onclick: () => {
                            if (validateInput()) {
                                this.closeModal();
                                resolve(input.value.trim());
                            }
                        }
                    }
                ]
            });

            // Initial validation
            setTimeout(validateInput, 100);
        });
    }
}

// Global modal instance
window.modalSystem = new ModalSystem();
