document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.auth-form');
    const passwordToggles = document.querySelectorAll('.password-toggle');

    passwordToggles.forEach(button => {
        button.addEventListener('click', () => togglePasswordVisibility(button));
    });

    forms.forEach(form => {
        const alertBox = form.querySelector('.auth-alert');

        form.addEventListener('input', () => {
            hideAlert(alertBox);
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            handleSubmit(form, alertBox);
        });
    });
});

function handleSubmit(form, alertBox) {
    if (!form.checkValidity()) {
        form.reportValidity();
        showAlert(alertBox, 'error', 'Vui lòng kiểm tra lại thông tin.');
        return;
    }

    const formType = form.dataset.formType;

    if (formType === 'register') {
        const password = form.querySelector('#register-password').value.trim();
        const confirm = form.querySelector('#register-confirm').value.trim();

        if (password !== confirm) {
            showAlert(alertBox, 'error', 'Mật khẩu xác nhận chưa trùng khớp.');
            return;
        }
    }

    showAlert(alertBox, 'success', getSuccessMessage(formType));
    form.reset();
    resetPasswordFields(form);
}

function getSuccessMessage(type) {
    switch (type) {
        case 'login':
            return 'Đăng nhập thành công (mô phỏng).';
        case 'register':
            return 'Tạo tài khoản thành công (mô phỏng).';
        case 'forgot':
            return 'Đã gửi hướng dẫn đặt lại mật khẩu (mô phỏng).';
        default:
            return 'Thao tác hoàn tất.';
    }
}

function togglePasswordVisibility(button) {
    const field = button.previousElementSibling;

    if (!field) return;

    const showing = field.type === 'text';
    field.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Hiện' : 'Ẩn';
}

function resetPasswordFields(form) {
    const passwordInputs = form.querySelectorAll('.password-field input');
    const toggleButtons = form.querySelectorAll('.password-toggle');

    passwordInputs.forEach(input => {
        input.type = 'password';
    });

    toggleButtons.forEach(button => {
        button.textContent = 'Hiện';
    });
}

function showAlert(alertBox, status, message) {
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.classList.remove('is-error', 'is-success');
    alertBox.classList.add(status === 'error' ? 'is-error' : 'is-success');
}

function hideAlert(alertBox) {
    if (!alertBox) return;

    alertBox.textContent = '';
    alertBox.classList.remove('is-error', 'is-success');
}
