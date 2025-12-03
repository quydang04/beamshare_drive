(function() {
    let formElement = null;
    let currentPasswordInput = null;
    let newPasswordInput = null;
    let confirmPasswordInput = null;
    let submitButton = null;
    let errorBox = null;
    let backButtons = [];
    let backButtonHandler = null;

    const t = (key, fallback = '') => {
        const lang = window.LanguageManager;
        if (lang && typeof lang.translate === 'function') {
            return lang.translate(key) || fallback;
        }
        return fallback;
    };

    const navigateToDashboard = () => {
        if (typeof window.switchToPage === 'function') {
            window.switchToPage('dashboard');
        } else {
            window.location.href = '/';
        }
    };

    const setLoading = (isLoading) => {
        if (!submitButton) {
            return;
        }
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading 
            ? t('info.changePassword.loading', 'Đang cập nhật...') 
            : t('info.changePassword.form.submit', 'Đổi mật khẩu');
    };

    const showError = (message) => {
        if (!errorBox) {
            return;
        }
        if (message) {
            errorBox.textContent = message;
            errorBox.classList.add('is-visible');
        } else {
            errorBox.textContent = '';
            errorBox.classList.remove('is-visible');
        }
    };

    const validatePasswords = (currentPassword, newPassword, confirmPassword) => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return t('info.changePassword.validation.allRequired', 'Vui lòng nhập đầy đủ thông tin.');
        }
        if (newPassword.length < 6) {
            return t('info.changePassword.validation.minLength', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
        }
        if (newPassword !== confirmPassword) {
            return t('info.changePassword.validation.mismatch', 'Mật khẩu mới và nhập lại chưa trùng khớp.');
        }
        if (currentPassword === newPassword) {
            return t('info.changePassword.validation.sameAsCurrent', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
        }
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
        const newPassword = newPasswordInput ? newPasswordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

        const validationMessage = validatePasswords(currentPassword, newPassword, confirmPassword);
        if (validationMessage) {
            showError(validationMessage);
            return;
        }

        showError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = payload?.error || t('info.changePassword.validation.defaultError', 'Không thể đổi mật khẩu.');
                showError(message);
                return;
            }

            showError('');
            if (formElement) {
                formElement.reset();
            }

            if (window.toastSystem) {
                window.toastSystem.success(t('info.changePassword.success', 'Đổi mật khẩu thành công.'), { duration: 2600 });
            }
        } catch (error) {
            console.error(t('info.changePassword.errorLog', 'Đổi mật khẩu thất bại:'), error);
            showError(t('common.genericError', 'Đã xảy ra lỗi. Vui lòng thử lại sau.'));
        } finally {
            setLoading(false);
        }
    };

    window.initChangeMatkhau = function initChangeMatkhau() {
        formElement = document.getElementById('change-password-form');
        currentPasswordInput = document.getElementById('change-password-current');
        newPasswordInput = document.getElementById('change-password-new');
        confirmPasswordInput = document.getElementById('change-password-confirm');
        submitButton = document.getElementById('change-password-submit');
        errorBox = formElement ? formElement.querySelector('[data-role="form-error"]') : null;
        backButtons = Array.from(document.querySelectorAll('[data-action="go-dashboard"]'));

        if (!formElement || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
            return;
        }

        formElement.addEventListener('submit', handleSubmit);

        backButtonHandler = (event) => {
            event.preventDefault();
            navigateToDashboard();
        };
        backButtons.forEach((button) => button.addEventListener('click', backButtonHandler));

        currentPasswordInput.focus();
    };

    window.cleanupChangeMatkhau = function cleanupChangeMatkhau() {
        if (formElement) {
            formElement.removeEventListener('submit', handleSubmit);
        }

        if (backButtonHandler) {
            backButtons.forEach((button) => button.removeEventListener('click', backButtonHandler));
        }

        formElement = null;
        currentPasswordInput = null;
        newPasswordInput = null;
        confirmPasswordInput = null;
        submitButton = null;
        errorBox = null;
        backButtons = [];
        backButtonHandler = null;
    };
})();
