(function() {
    let formElement = null;
    let nameInput = null;
    let submitButton = null;
    let errorBox = null;
    let emailLabel = null;
    let currentNameLabel = null;
    let backButtons = [];
    let profileListener = null;

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
        submitButton.textContent = isLoading ? 'Đang lưu...' : 'Lưu thay đổi';
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

    const applyProfileToView = (profile) => {
        if (emailLabel) {
            emailLabel.textContent = profile?.email || '—';
        }
        if (currentNameLabel) {
            currentNameLabel.textContent = (profile?.fullName && profile.fullName.trim()) || '—';
        }
        if (nameInput && typeof profile?.fullName === 'string') {
            nameInput.value = profile.fullName;
        } else if (nameInput && !nameInput.value) {
            nameInput.value = '';
        }
    };

    const fetchProfile = async () => {
        if (typeof window.getCurrentUserProfile !== 'function') {
            return null;
        }
        try {
            const profile = await window.getCurrentUserProfile(false);
            applyProfileToView(profile);
            return profile;
        } catch (error) {
            console.error('Không thể tải thông tin người dùng:', error);
            showError('Không thể tải thông tin người dùng. Vui lòng thử lại sau.');
            return null;
        }
    };

    const validateName = (value) => {
        if (!value) {
            return 'Vui lòng nhập tên hiển thị.';
        }
        if (value.length < 2) {
            return 'Tên hiển thị phải có tối thiểu 2 ký tự.';
        }
        if (value.length > 80) {
            return 'Tên hiển thị không được vượt quá 80 ký tự.';
        }
        return '';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!nameInput) {
            return;
        }

        const fullName = nameInput.value.trim();
        const validationMessage = validateName(fullName);
        if (validationMessage) {
            showError(validationMessage);
            nameInput.focus();
            return;
        }

        showError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fullName })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = payload?.error || 'Không thể cập nhật thông tin người dùng.';
                showError(message);
                return;
            }

            showError('');
            if (typeof window.refreshCurrentUserProfile === 'function') {
                await window.refreshCurrentUserProfile();
            }

            if (window.toastSystem) {
                window.toastSystem.success('Đã cập nhật tên hiển thị.', { duration: 2400 });
            }
        } catch (error) {
            console.error('Cập nhật thông tin thất bại:', error);
            showError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const attachBackHandlers = () => {
        const handler = (event) => {
            event.preventDefault();
            navigateToDashboard();
        };

        backButtons.forEach((button) => {
            button.addEventListener('click', handler);
        });

        return handler;
    };

    let backButtonHandler = null;

    window.initChangeThongtin = function initChangeThongtin() {
        formElement = document.getElementById('change-profile-form');
        nameInput = document.getElementById('change-profile-name');
        submitButton = document.getElementById('change-profile-submit');
        errorBox = formElement ? formElement.querySelector('[data-role="form-error"]') : null;
        emailLabel = document.getElementById('change-profile-email');
        currentNameLabel = document.getElementById('change-profile-current-name');
        backButtons = Array.from(document.querySelectorAll('[data-action="go-dashboard"]'));

        if (!formElement || !nameInput) {
            return;
        }

        formElement.addEventListener('submit', handleSubmit);
        backButtonHandler = attachBackHandlers();

        fetchProfile();

        profileListener = (event) => {
            const profile = event?.detail?.profile || null;
            applyProfileToView(profile);
        };
        document.addEventListener('userprofile:updated', profileListener);

        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    };

    window.cleanupChangeThongtin = function cleanupChangeThongtin() {
        if (formElement) {
            formElement.removeEventListener('submit', handleSubmit);
        }

        if (backButtonHandler) {
            backButtons.forEach((button) => {
                button.removeEventListener('click', backButtonHandler);
            });
        }

        if (profileListener) {
            document.removeEventListener('userprofile:updated', profileListener);
        }

        formElement = null;
        nameInput = null;
        submitButton = null;
        errorBox = null;
        emailLabel = null;
        currentNameLabel = null;
        backButtons = [];
        profileListener = null;
        backButtonHandler = null;
    };
})();
