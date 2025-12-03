const DEFAULT_AUTH_REDIRECT = '/dashboard';
let redirectTarget = DEFAULT_AUTH_REDIRECT;
let hasRedirectParam = false;
let redirectQuery = '';
let loginUrlWithRedirect = '/auth/login';
let resendCooldown = 0;
let resendTimer = null;

// Get translation from authTranslate if available
function t(key, fallbackVi, fallbackEn) {
    if (window.authTranslate && typeof window.authTranslate.t === 'function') {
        const translated = window.authTranslate.t(key);
        if (translated && translated !== key) {
            return translated;
        }
    }
    // Fallback based on current language
    const lang = window.authTranslate?.getCurrentLang?.() || 'vi';
    return lang === 'en' ? (fallbackEn || fallbackVi) : fallbackVi;
}

// Get current language for API calls
function getCurrentLang() {
    return window.authTranslate?.getCurrentLang?.() || 'vi';
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in and redirect to dashboard
    checkAuthAndRedirect();

    const forms = document.querySelectorAll('.auth-form');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const urlParams = new URLSearchParams(window.location.search);
    const resetTokenFromUrl = urlParams.get('token') || '';
    const redirectParamRaw = urlParams.get('redirect');

    redirectTarget = getSafeRedirectTarget(redirectParamRaw);
    hasRedirectParam = typeof redirectParamRaw === 'string' && redirectParamRaw.trim() !== '';
    redirectQuery = hasRedirectParam ? `?redirect=${encodeURIComponent(redirectTarget)}` : '';
    loginUrlWithRedirect = hasRedirectParam ? `/auth/login${redirectQuery}` : '/auth/login';

    if (redirectQuery) {
        updateRedirectAwareLinks(redirectQuery);
    }

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
        showAlert(alertBox, 'error', t('auth.messages.checkInfo', 'Vui lòng kiểm tra lại thông tin.', 'Please check your information.'));
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

    showAlert(alertBox, 'info', t('auth.messages.processing', 'Đang xử lý, vui lòng chờ...', 'Processing, please wait...'));
    setSubmitting(form, true);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ ...payload, lang: getCurrentLang() })
        });

        const data = await parseJsonSafely(response);
        if (!response.ok) {
            const isLoginForm = formType === 'login';
            const isAuthError = response.status === 401 || response.status === 400;
            const fallbackLoginMessage = t('auth.messages.invalidCredentials', 
                'Thông tin đăng nhập không đúng, vui lòng kiểm tra lại', 
                'Invalid credentials, please check again');

            // Check if email is not verified
            if (isLoginForm && response.status === 403 && data?.code === 'EMAIL_NOT_VERIFIED') {
                showEmailVerificationRequired(alertBox, data?.email);
                return;
            }

            const message = isLoginForm && isAuthError
                ? fallbackLoginMessage
                : data?.error || t('auth.messages.serverError', 'Không thể hoàn tất yêu cầu.', 'Could not complete request.');

            showAlert(alertBox, 'error', message);
            return;
        }

        const successMessage = data?.message || getDefaultSuccessMessage(formType);
        showAlert(alertBox, 'success', successMessage);

        const requiresVerification = formType === 'register' && (data?.requiresEmailVerification || data?.verificationEmailSent);
        if (requiresVerification) {
            setTimeout(() => {
                window.location.href = loginUrlWithRedirect;
            }, 2200);
        } else {
            redirectAfterAuth();
        }
    } catch (error) {
        console.error('Auth request error:', error);
        showAlert(alertBox, 'error', t('auth.messages.serverError', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.', 'Cannot connect to server. Please try again.'));
    } finally {
        setSubmitting(form, false);
    }
}
async function submitForgotPassword(form, alertBox) {
    const formData = new FormData(form);
    const email = sanitizeInput(formData.get('email'));

    if (!email) {
        showAlert(alertBox, 'error', t('auth.messages.emailRequired', 'Email là bắt buộc.', 'Email is required.'));
        return;
    }

    showAlert(alertBox, 'info', t('auth.messages.sendingInstructions', 'Đang gửi hướng dẫn, vui lòng chờ...', 'Sending instructions, please wait...'));
    setSubmitting(form, true);

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, lang: getCurrentLang() })
        });

        const data = await parseJsonSafely(response);
        if (!response.ok) {
            const message = data?.error || t('auth.messages.serverError', 'Không thể gửi email đặt lại mật khẩu.', 'Could not send password reset email.');
            showAlert(alertBox, 'error', message);
            return;
        }

        const successMessage = data?.message || t('auth.forgotPassword.successMessage', 
            'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.', 
            'If the email exists, we have sent password reset instructions.');
        showAlert(alertBox, 'success', successMessage);
        form.reset();
    } catch (error) {
        console.error('Forgot password request error:', error);
        showAlert(alertBox, 'error', t('auth.messages.serverError', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.', 'Cannot connect to server. Please try again.'));
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
        showAlert(alertBox, 'error', t('auth.messages.invalidResetLink', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 'Password reset link is invalid or expired.'));
        return;
    }

    if (!password || password.length < 6) {
        showAlert(alertBox, 'error', t('auth.messages.passwordMinLength', 'Mật khẩu mới phải có ít nhất 6 ký tự.', 'New password must be at least 6 characters.'));
        return;
    }

    if (password !== confirm) {
        showAlert(alertBox, 'error', t('auth.messages.passwordMismatch', 'Mật khẩu xác nhận chưa trùng khớp.', 'Passwords do not match.'));
        return;
    }

    showAlert(alertBox, 'info', t('auth.messages.updatingPassword', 'Đang cập nhật mật khẩu...', 'Updating password...'));
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
            const message = data?.error || t('auth.messages.resetPasswordError', 'Không thể đặt lại mật khẩu.', 'Could not reset password.');
            showAlert(alertBox, 'error', message);
            return;
        }

        showAlert(alertBox, 'success', data?.message || t('auth.messages.resetPasswordSuccess', 'Đặt lại mật khẩu thành công. Đang chuyển hướng...', 'Password reset successful. Redirecting...'));
        redirectAfterAuth();
    } catch (error) {
        console.error('Reset password request error:', error);
        showAlert(alertBox, 'error', t('auth.messages.connectionError', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.', 'Could not connect to server. Please try again.'));
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
        showAlert(alertBox, 'error', t('auth.messages.emailPasswordRequired', 'Email và mật khẩu là bắt buộc.', 'Email and password are required.'));
        return null;
    }

    if (formType === 'register') {
        const confirmPassword = sanitizeInput(formData.get('confirm'));
        if (password !== confirmPassword) {
            showAlert(alertBox, 'error', t('auth.messages.passwordMismatch', 'Mật khẩu xác nhận chưa trùng khớp.', 'Passwords do not match.'));
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
        showAlert(alertBox, 'error', t('auth.messages.invalidResetLink', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 'Password reset link is invalid or has expired.'));
        return;
    }

    // Check token validity with server
    checkResetTokenValidity(form, alertBox, token);
}
function redirectAfterAuth() {
    setTimeout(() => {
        window.location.href = redirectTarget || DEFAULT_AUTH_REDIRECT;
    }, 600);
}

function getSafeRedirectTarget(rawValue) {
    if (typeof rawValue !== 'string' || rawValue.trim() === '') {
        return DEFAULT_AUTH_REDIRECT;
    }

    const trimmed = rawValue.trim();

    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return DEFAULT_AUTH_REDIRECT;
    }

    try {
        const url = new URL(trimmed, window.location.origin);
        if (url.origin !== window.location.origin) {
            return DEFAULT_AUTH_REDIRECT;
        }

        const candidate = `${url.pathname}${url.search}${url.hash}` || DEFAULT_AUTH_REDIRECT;
        if (candidate === '/' || candidate.trim() === '') {
            return DEFAULT_AUTH_REDIRECT;
        }

        return candidate;
    } catch (_error) {
        return DEFAULT_AUTH_REDIRECT;
    }
}

function updateRedirectAwareLinks(query) {
    if (!query) {
        return;
    }

    const selectors = [
        'a[href="/auth/login"]',
        'a[href="/auth/register"]',
        'a[href="/auth/forgot-password"]',
        'a[href="/auth/reset-password"]'
    ];

    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((link) => {
            const baseHref = link.getAttribute('href');
            if (!baseHref || baseHref.includes('?redirect=')) {
                return;
            }
            link.setAttribute('href', `${baseHref}${query}`);
        });
    });
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
    submitButton.textContent = isSubmitting ? t('auth.messages.processing', 'Đang xử lý...', 'Processing...') : submitButton.dataset.originalLabel;
}

function getDefaultSuccessMessage(type) {
    return type === 'register'
        ? t('auth.messages.registerSuccess', 'Đăng ký thành công. Đang chuyển hướng...', 'Registration successful. Redirecting...')
        : t('auth.messages.loginSuccess', 'Đăng nhập thành công. Đang chuyển hướng...', 'Login successful. Redirecting...');
}

function togglePasswordVisibility(button) {
    const field = button.previousElementSibling;

    if (!field) {
        return;
    }

    const showing = field.type === 'text';
    field.type = showing ? 'password' : 'text';
    button.classList.toggle('is-visible', !showing);
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

// Check if user is already authenticated and redirect to dashboard
async function checkAuthAndRedirect() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            const user = data?.user || data;
            if (user && (user.id || user._id)) {
                // User is already logged in, redirect to dashboard or intended target
                const urlParams = new URLSearchParams(window.location.search);
                const redirectParam = urlParams.get('redirect');
                const safeRedirect = getSafeRedirectTarget(redirectParam);
                window.location.href = safeRedirect;
            }
        }
    } catch (error) {
        // User not logged in, continue with auth page
        console.log('User not authenticated, showing auth form');
    }
}

// Check reset token validity with server
async function checkResetTokenValidity(form, alertBox, token) {
    try {
        const response = await fetch('/api/auth/check-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, type: 'password-reset' })
        });

        const data = await parseJsonSafely(response);

        if (!data?.valid) {
            const submitButton = form.querySelector('[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }

            if (data?.expired && data?.email) {
                showTokenExpiredWithResend(alertBox, data.email, 'password-reset');
            } else {
                showAlert(alertBox, 'error', data?.error || t('auth.messages.invalidResetLink', 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 'Password reset link is invalid or has expired.'));
            }
        }
    } catch (error) {
        console.error('Error checking token validity:', error);
    }
}

// Show email verification required message with resend button
function showEmailVerificationRequired(alertBox, email) {
    if (!alertBox) return;

    const lang = getLang();
    const title = t('auth.messages.accountNotVerifiedTitle', 'Tài khoản chưa được xác thực!', 'Account not verified!');
    const checkEmail = t('auth.messages.checkEmailVerify', 'Vui lòng kiểm tra hộp thư email', 'Please check your email');
    const clickLink = t('auth.messages.clickLinkToActivate', 'và nhấp vào liên kết xác thực để kích hoạt tài khoản.', 'and click the verification link to activate your account.');
    const resendHint = t('auth.messages.resendHint', 'Không nhận được email? Kiểm tra thư mục spam hoặc', 'Didn\'t receive the email? Check your spam folder or');
    const resendBtn = t('auth.messages.resendVerificationBtn', 'Gửi lại email xác thực', 'Resend verification email');

    alertBox.innerHTML = `
        <div class="verification-required">
            <p><strong>${title}</strong></p>
            <p>${checkEmail} <strong>${email || ''}</strong> ${clickLink}</p>
            <p class="resend-hint">${resendHint}</p>
            <button type="button" class="btn-resend" onclick="resendVerificationEmail('${email}', this.closest('.auth-alert'))">
                ${resendBtn}
            </button>
        </div>
    `;
    alertBox.classList.remove('is-success', 'is-info');
    alertBox.classList.add('is-error');
}

// Show token expired message with resend button
function showTokenExpiredWithResend(alertBox, email, type) {
    if (!alertBox) return;

    const isPasswordReset = type === 'password-reset';
    const actionText = isPasswordReset 
        ? t('auth.messages.resetPasswordAction', 'đặt lại mật khẩu', 'password reset')
        : t('auth.messages.verifyEmailAction', 'xác thực email', 'email verification');
    const buttonText = isPasswordReset 
        ? t('auth.messages.resendResetBtn', 'Gửi lại liên kết đặt lại mật khẩu', 'Resend password reset link')
        : t('auth.messages.resendVerificationBtn', 'Gửi lại email xác thực', 'Resend verification email');
    const resendFunction = isPasswordReset ? 'resendPasswordResetEmail' : 'resendVerificationEmail';
    
    const expiredTitle = t('auth.messages.linkExpiredTitle', 'Liên kết', 'Link for') + ' ' + actionText + ' ' + t('auth.messages.hasExpired', 'đã hết hạn!', 'has expired!');
    const expiredDesc = t('auth.messages.linkExpiredDesc', 'Liên kết chỉ có hiệu lực trong 15 phút. Vui lòng yêu cầu gửi lại email.', 'The link is only valid for 15 minutes. Please request a new email.');

    alertBox.innerHTML = `
        <div class="token-expired">
            <p><strong>${expiredTitle}</strong></p>
            <p>${expiredDesc}</p>
            <button type="button" class="btn-resend" id="resend-btn" onclick="${resendFunction}('${email}', this.closest('.auth-alert'))">
                ${buttonText}
            </button>
        </div>
    `;
    alertBox.classList.remove('is-success', 'is-info');
    alertBox.classList.add('is-error');
}

// Resend verification email
async function resendVerificationEmail(email, alertBox) {
    if (!email || resendCooldown > 0) return;

    const resendBtn = alertBox?.querySelector('.btn-resend');
    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = t('auth.messages.sending', 'Đang gửi...', 'Sending...');
    }

    try {
        const lang = getLang();
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, lang })
        });

        const data = await parseJsonSafely(response);

        if (response.status === 429) {
            // Rate limited
            startResendCooldown(data?.remainingSeconds || 90, resendBtn);
            return;
        }

        if (!response.ok) {
            showAlert(alertBox, 'error', data?.error || t('auth.messages.resendVerificationError', 'Không thể gửi lại email xác thực.', 'Could not resend verification email.'));
            return;
        }

        showAlert(alertBox, 'success', t('auth.messages.verificationEmailSent', 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.', 'Verification email has been resent. Please check your inbox.'));
        startResendCooldown(90, resendBtn);
    } catch (error) {
        console.error('Resend verification email error:', error);
        showAlert(alertBox, 'error', t('auth.messages.connectionError', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.', 'Could not connect to server. Please try again.'));
        if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.textContent = t('auth.messages.resendVerificationBtn', 'Gửi lại email xác thực', 'Resend verification email');
        }
    }
}

// Resend password reset email
async function resendPasswordResetEmail(email, alertBox) {
    if (!email || resendCooldown > 0) return;

    const resendBtn = alertBox?.querySelector('.btn-resend');
    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = t('auth.messages.sending', 'Đang gửi...', 'Sending...');
    }

    try {
        const lang = getLang();
        const response = await fetch('/api/auth/resend-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, lang })
        });

        const data = await parseJsonSafely(response);

        if (response.status === 429) {
            // Rate limited
            startResendCooldown(data?.remainingSeconds || 90, resendBtn);
            return;
        }

        if (!response.ok) {
            showAlert(alertBox, 'error', data?.error || t('auth.messages.resendResetError', 'Không thể gửi lại email đặt lại mật khẩu.', 'Could not resend password reset email.'));
            return;
        }

        showAlert(alertBox, 'success', t('auth.messages.resetEmailSent', 'Email đặt lại mật khẩu đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.', 'Password reset email has been resent. Please check your inbox.'));
        startResendCooldown(90, resendBtn);
    } catch (error) {
        console.error('Resend password reset email error:', error);
        showAlert(alertBox, 'error', t('auth.messages.connectionError', 'Không thể kết nối tới máy chủ. Vui lòng thử lại.', 'Could not connect to server. Please try again.'));
        if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.textContent = t('auth.messages.resendResetBtn', 'Gửi lại liên kết đặt lại mật khẩu', 'Resend password reset link');
        }
    }
}

// Start resend cooldown timer
function startResendCooldown(seconds, button) {
    resendCooldown = seconds;
    
    if (resendTimer) {
        clearInterval(resendTimer);
    }

    updateResendButtonText(button);

    resendTimer = setInterval(() => {
        resendCooldown--;
        updateResendButtonText(button);

        if (resendCooldown <= 0) {
            clearInterval(resendTimer);
            resendTimer = null;
            if (button) {
                button.disabled = false;
            }
        }
    }, 1000);
}

// Update resend button text with countdown
function updateResendButtonText(button) {
    if (!button) return;

    if (resendCooldown > 0) {
        button.disabled = true;
        const resendAfter = t('auth.messages.resendAfter', 'Gửi lại sau', 'Resend in');
        button.textContent = `${resendAfter} ${resendCooldown}s`;
    } else {
        button.disabled = false;
        // Restore original button text based on context
        const isPasswordReset = button.closest('.token-expired') !== null;
        button.textContent = isPasswordReset 
            ? t('auth.messages.resendResetBtn', 'Gửi lại liên kết đặt lại mật khẩu', 'Resend password reset link')
            : t('auth.messages.resendVerificationBtn', 'Gửi lại email xác thực', 'Resend verification email');
    }
}
