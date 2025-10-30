document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.auth-form');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const urlParams = new URLSearchParams(window.location.search);
    const resetTokenFromUrl = urlParams.get('token') || '';

    passwordToggles.forEach((button) => {
        button.addEventListener('click', () => togglePasswordVisibility(button));
    });

    forms.forEach((form) => {
        const alertBox = form.querySelector('.auth-alert');
        const formType = form.dataset.formType;

        if (formType === 'reset') {
            setupResetForm(form, alertBox, resetTokenFromUrl);
        }

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
        await submitForgotPassword(form, alertBox);
        return;
    }

    if (formType === 'reset') {
        await submitResetPassword(form, alertBox);
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

        const successMessage = data?.message || getDefaultSuccessMessage(formType);
        showAlert(alertBox, 'success', successMessage);

        const requiresVerification = formType === 'register' && (data?.requiresEmailVerification || data?.verificationEmailSent);
        if (requiresVerification) {
            setTimeout(() => {
                window.location.href = '/auth/login';
            }, 2200);
        } else {
            redirectAfterAuth();
        }
    } catch (error) {
        console.error('Auth request error:', error);
        showAlert(alertBox, 'error', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
        setSubmitting(form, false);
    }
}
async function submitForgotPassword(form, alertBox) {
    const formData = new FormData(form);
    const email = sanitizeInput(formData.get('email'));

    if (!email) {
        showAlert(alertBox, 'error', 'Email là bắt buộc.');
        return;
    }

    showAlert(alertBox, 'info', 'Đang gửi hướng dẫn, vui lòng chờ...');
    setSubmitting(form, true);

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await parseJsonSafely(response);
        if (!response.ok) {
            const message = data?.error || 'Không thể gửi email đặt lại mật khẩu.';
            showAlert(alertBox, 'error', message);
            return;
        }

        showAlert(alertBox, 'success', data?.message || 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.');
        form.reset();
    } catch (error) {
        console.error('Forgot password request error:', error);
        showAlert(alertBox, 'error', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
        setSubmitting(form, false);
    }
}

async function submitResetPassword(form, alertBox) {
    const formData = new FormData(form);
    const token = sanitizeInput(formData.get('token'));
    const password = sanitizeInput(formData.get('password'));
    const confirm = sanitizeInput(formData.get('confirm'));

    if (!token) {
        showAlert(alertBox, 'error', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        return;
    }

    if (!password || password.length < 6) {
        showAlert(alertBox, 'error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
    }

    if (password !== confirm) {
        showAlert(alertBox, 'error', 'Mật khẩu xác nhận chưa trùng khớp.');
        return;
    }

    showAlert(alertBox, 'info', 'Đang cập nhật mật khẩu...');
    setSubmitting(form, true);

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token, password })
        });

        const data = await parseJsonSafely(response);
        if (!response.ok) {
            const message = data?.error || 'Không thể đặt lại mật khẩu.';
            showAlert(alertBox, 'error', message);
            return;
        }

        showAlert(alertBox, 'success', data?.message || 'Đặt lại mật khẩu thành công. Đang chuyển hướng...');
        redirectAfterAuth();
    } catch (error) {
        console.error('Reset password request error:', error);
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

    if (formType === 'login') {
        return {
            email,
            password
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

function setupResetForm(form, alertBox, token) {
    form.dataset.resetToken = token;
    const tokenField = form.querySelector('input[name="token"]');
    if (tokenField) {
        tokenField.value = token;
    }

    if (!token) {
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
        showAlert(alertBox, 'error', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
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
