document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.auth-form');
    const passwordToggles = document.querySelectorAll('.password-toggle');

    passwordToggles.forEach((button) => {
        button.addEventListener('click', () => togglePasswordVisibility(button));
    });

    forms.forEach((form) => {
        const alertBox = form.querySelector('.auth-alert');

        form.addEventListener('input', () => {
            hideAlert(alertBox);
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            void handleSubmit(form, alertBox);
        });
    });
});

async function handleSubmit(form, alertBox) {
    if (!form.checkValidity()) {
        form.reportValidity();
        showAlert(alertBox, 'error', 'Vui lòng kiểm tra lại thông tin.');
        return;
    }

    const formType = form.dataset.formType;
    if (formType === 'forgot') {
        showAlert(alertBox, 'success', 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.');
        form.reset();
        return;
    }

    const payload = buildPayload(form, alertBox);
    if (!payload) {
        return;
    }

    const endpoint = formType === 'register' ? '/api/auth/register' : '/api/auth/login';

    showAlert(alertBox, 'info', 'Đang xử lý, vui lòng chờ...');
    setSubmitting(form, true);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const data = await parseJsonSafely(response);
        if (!response.ok) {
            const isLoginForm = formType === 'login';
            const isAuthError = response.status === 401 || response.status === 400;
            const fallbackLoginMessage = 'Thông tin đăng nhập không đúng, vui lòng kiểm tra lại';

            const message = isLoginForm && isAuthError
                ? fallbackLoginMessage
                : data?.error || 'Không thể hoàn tất yêu cầu.';

            showAlert(alertBox, 'error', message);
            return;
        }

        showAlert(alertBox, 'success', data?.message || getDefaultSuccessMessage(formType));
        redirectAfterAuth();
    } catch (error) {
        console.error('Auth request error:', error);
        showAlert(alertBox, 'error', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
        setSubmitting(form, false);
    }
}

function buildPayload(form, alertBox) {
    const formType = form.dataset.formType;
    const formData = new FormData(form);

    const email = sanitizeInput(formData.get('email'));
    const password = sanitizeInput(formData.get('password'));

    if (!email || !password) {
        showAlert(alertBox, 'error', 'Email và mật khẩu là bắt buộc.');
        return null;
    }

    if (formType === 'register') {
        const confirmPassword = sanitizeInput(formData.get('confirm'));
        if (password !== confirmPassword) {
            showAlert(alertBox, 'error', 'Mật khẩu xác nhận chưa trùng khớp.');
            return null;
        }

        const fullName = sanitizeInput(formData.get('fullName'));

        return {
            email,
            password,
            fullName: fullName || undefined
        };
    }

    return {
        email,
        password
    };
}

function parseJsonSafely(response) {
    return response
        .clone()
        .json()
        .catch(() => null);
}

function redirectAfterAuth() {
    setTimeout(() => {
        window.location.href = '/';
    }, 600);
}

function sanitizeInput(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function setSubmitting(form, isSubmitting) {
    const submitButton = form.querySelector('[type="submit"]');
    if (!submitButton) {
        return;
    }

    if (!submitButton.dataset.originalLabel) {
        submitButton.dataset.originalLabel = submitButton.textContent;
    }

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? 'Đang xử lý...' : submitButton.dataset.originalLabel;
}

function getDefaultSuccessMessage(type) {
    return type === 'register'
        ? 'Đăng ký thành công. Đang chuyển hướng...'
        : 'Đăng nhập thành công. Đang chuyển hướng...';
}

function togglePasswordVisibility(button) {
    const field = button.previousElementSibling;

    if (!field) {
        return;
    }

    const showing = field.type === 'text';
    field.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Hiện' : 'Ẩn';
}

function showAlert(alertBox, status, message) {
    if (!alertBox) {
        return;
    }

    alertBox.textContent = message || '';
    alertBox.classList.remove('is-error', 'is-success', 'is-info');

    if (!message) {
        return;
    }

    if (status === 'error') {
        alertBox.classList.add('is-error');
    } else if (status === 'info') {
        alertBox.classList.add('is-info');
    } else {
        alertBox.classList.add('is-success');
    }
}

function hideAlert(alertBox) {
    if (!alertBox) {
        return;
    }

    alertBox.textContent = '';
    alertBox.classList.remove('is-error', 'is-success', 'is-info');
}
