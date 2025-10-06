// Toast Notification System with variants and proper ARIA support
class ToastSystem {
    constructor() {
        this.toasts = [];
        this.maxToasts = 4;
        this.container = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createContainer());
        } else {
            this.createContainer();
        }
    }

    createContainer() {
        // Only create if not already created and body exists
        if (!this.container && document.body) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(this.container);
        }
    }

    show(message, variant = 'success', options = {}) {
        // Ensure container exists
        if (!this.container) {
            this.createContainer();
        }

        // If still no container (body not ready), queue the message
        if (!this.container) {
            console.log(`[TOAST ${variant.toUpperCase()}] ${message}`);
            return;
        }

        // Remove oldest toast if at max capacity
        if (this.toasts.length >= this.maxToasts) {
            this.removeToast(this.toasts[0]);
        }

        const toast = this.createToast(message, variant, options);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Auto dismiss
        const duration = options.duration || this.getDefaultDuration(variant);
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }

        return toast;
    }

    createToast(message, variant, options) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${variant}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');

        const icon = this.getVariantIcon(variant);
        const canDismiss = options.dismissible !== false;

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="toast-message">${message}</div>
                ${canDismiss ? `
                    <button class="toast-close" aria-label="Đóng thông báo">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
            ${options.action ? `
                <div class="toast-actions">
                    <button class="toast-action" onclick="${options.action.onclick}">
                        ${options.action.text}
                    </button>
                </div>
            ` : ''}
        `;

        // Close button handler
        if (canDismiss) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => {
                this.removeToast(toast);
            });
        }

        // Click to dismiss (optional)
        if (options.clickToDismiss !== false) {
            toast.addEventListener('click', (e) => {
                if (!e.target.closest('.toast-action, .toast-close')) {
                    this.removeToast(toast);
                }
            });
        }

        return toast;
    }

    removeToast(toast) {
        if (!toast || !toast.parentNode) return;

        const index = this.toasts.indexOf(toast);
        if (index > -1) {
            this.toasts.splice(index, 1);
        }

        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    getVariantIcon(variant) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[variant] || icons.info;
    }

    getDefaultDuration(variant) {
        const durations = {
            success: 3000,
            error: 5000,
            warning: 4000,
            info: 3000
        };
        return durations[variant] || 3000;
    }

    // Convenience methods
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    // Clear all toasts
    clear() {
        this.toasts.forEach(toast => this.removeToast(toast));
    }

    // Force clear all existing toasts and reset
    reset() {
        // Remove all existing toast containers from DOM
        const existingContainers = document.querySelectorAll('.toast-container');
        existingContainers.forEach(container => container.remove());

        // Reset internal state
        this.toasts = [];
        this.container = null;

        // Recreate container
        this.createContainer();
    }
}

// Clear any existing toast containers immediately and on DOM ready
const clearOldToasts = () => {
    const existingContainers = document.querySelectorAll('.toast-container, .toast, .notification');
    existingContainers.forEach(container => container.remove());
};

// Clear immediately if DOM is ready
if (document.readyState !== 'loading') {
    clearOldToasts();
}

// Also clear when DOM is ready
document.addEventListener('DOMContentLoaded', clearOldToasts);

// Global toast instance
window.toastSystem = new ToastSystem();

// Clear old toast functions and replace with new system
window.showNotification = function(message, type = 'success', options = {}) {
    // Map old type names to new variants
    const variantMap = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const variant = variantMap[type] || 'info';
    return window.toastSystem.show(message, variant, options);
};

// Override any old toast methods
window.showToast = window.showNotification;
window.toast = window.toastSystem;
