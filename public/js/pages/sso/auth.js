(function() {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    document.addEventListener('DOMContentLoaded', () => {
        const authForms = document.querySelectorAll('.auth-form');
        const inputs = document.querySelectorAll('.form-input');
        const toggles = document.querySelectorAll('.password-toggle');

        inputs.forEach(input => {
            updateFieldState(input);
            input.addEventListener('focus', () => toggleFocusState(input, true));
            input.addEventListener('blur', () => toggleFocusState(input, false));
            input.addEventListener('input', () => updateFieldState(input));
            input.addEventListener('change', () => updateFieldState(input));
        });

        toggles.forEach(button => {
            button.addEventListener('click', () => handleTogglePassword(button));
        });

        authForms.forEach(form => {
            form.addEventListener('submit', event => {
                event.preventDefault();
                handleSubmit(form);
            });
        });
    });

    function handleSubmit(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const formType = form.getAttribute('data-form-type') || 'login';
        const validation = validateForm(formType, formData, form);

        if (!validation.valid) {
            showAlert(form, 'error', validation.errors);
            if (window.toastSystem) {
                window.toastSystem.error('Vui lòng kiểm tra lại thông tin vừa nhập.');
            }
            return;
        }

        showAlert(form, 'success', validation.message);

        if (submitButton) {
            const originalText = submitButton.innerHTML;
            setSubmitting(submitButton, true);

            setTimeout(() => {
                setSubmitting(submitButton, false, originalText);
                if (validation.reset) {
                    form.reset();
                    const inputs = form.querySelectorAll('.form-input');
                    inputs.forEach(updateFieldState);
                }

                if (window.toastSystem) {
                    window.toastSystem.success(validation.toastMessage || 'Thao tác hoàn tất.');
                }
            }, 600);
        } else if (window.toastSystem) {
            window.toastSystem.success(validation.toastMessage || 'Thao tác hoàn tất.');
        }
    }

    function setSubmitting(button, isSubmitting, originalMarkup) {
        if (isSubmitting) {
            button.dataset.originalContent = button.innerHTML;
            button.innerHTML = '<span class="spinner"></span> Đang xử lý';
            button.disabled = true;
        } else {
            button.innerHTML = originalMarkup || button.dataset.originalContent || button.innerHTML;
            button.disabled = false;
            delete button.dataset.originalContent;
        }
    }

    function validateForm(type, data, form) {
        const errors = [];
        const result = {
            valid: false,
            errors,
            message: '',
            reset: false,
            toastMessage: ''
        };

        if (type === 'login') {
            const email = data.get('email')?.trim() || '';
            const password = data.get('password')?.trim() || '';

            if (!email) {
                errors.push('Vui lòng nhập email công việc.');
            } else if (!emailPattern.test(email)) {
                errors.push('Email chưa đúng định dạng.');
            }

            if (!password) {
                errors.push('Vui lòng nhập mật khẩu.');
            } else if (password.length < 6) {
                errors.push('Mật khẩu cần tối thiểu 6 ký tự.');
            }

            if (errors.length === 0) {
                result.valid = true;
                result.message = 'Đăng nhập thành công! Chúc bạn một ngày làm việc hiệu quả.';
                result.toastMessage = 'Đăng nhập thành công.';
                result.reset = false;
            }
        }

        if (type === 'register') {
            const fullName = data.get('fullname')?.trim() || '';
            const email = data.get('email')?.trim() || '';
            const password = data.get('password')?.trim() || '';
            const confirm = data.get('confirm')?.trim() || '';
            const team = data.get('team')?.trim() || '';
            const termsAccepted = form.querySelector('#register-terms')?.checked;

            if (!fullName) {
                errors.push('Vui lòng nhập họ tên đầy đủ.');
            } else if (fullName.length < 4) {
                errors.push('Họ tên cần tối thiểu 4 ký tự.');
            }

            if (!email) {
                errors.push('Vui lòng nhập email công việc.');
            } else if (!emailPattern.test(email)) {
                errors.push('Email chưa đúng định dạng.');
            }

            if (!password) {
                errors.push('Vui lòng tạo mật khẩu.');
            } else {
                if (password.length < 8) {
                    errors.push('Mật khẩu cần tối thiểu 8 ký tự.');
                }
                if (!/[A-ZÀ-Ỵ]/.test(password)) {
                    errors.push('Mật khẩu cần ít nhất 1 ký tự viết hoa.');
                }
                if (!/[0-9]/.test(password)) {
                    errors.push('Mật khẩu cần ít nhất 1 chữ số.');
                }
            }

            if (!confirm) {
                errors.push('Vui lòng nhập lại mật khẩu để xác nhận.');
            } else if (password && confirm !== password) {
                errors.push('Mật khẩu xác nhận chưa trùng khớp.');
            }

            if (!team) {
                errors.push('Vui lòng nhập tên nhóm hoặc công ty.');
            }

            if (!termsAccepted) {
                errors.push('Bạn cần đồng ý với điều khoản để tiếp tục.');
            }

            if (errors.length === 0) {
                result.valid = true;
                result.message = `Đăng ký thành công! Chúng tôi đã gửi email kích hoạt tới <strong>${email}</strong>.`;
                result.toastMessage = 'Tạo tài khoản thành công, vui lòng kiểm tra email của bạn.';
                result.reset = true;
            }
        }

        if (type === 'recover') {
            const email = data.get('email')?.trim() || '';
            const method = data.get('method');

            if (!email) {
                errors.push('Bạn cần nhập email đã đăng ký.');
            } else if (!emailPattern.test(email)) {
                errors.push('Email chưa đúng định dạng.');
            }

            if (!method) {
                errors.push('Vui lòng chọn phương thức xác thực.');
            }

            if (errors.length === 0) {
                result.valid = true;
                result.message = `Đã gửi liên kết đặt lại mật khẩu đến <strong>${email}</strong>.`;
                result.toastMessage = 'Email đặt lại mật khẩu đã được gửi.';
                result.reset = true;
            }
        }

        return result;
    }

    function showAlert(form, type, content) {
        const alert = form.querySelector('.auth-alert');
        if (!alert) return;

        alert.classList.remove('is-visible', 'is-error', 'is-success');

        if (!content || (Array.isArray(content) && content.length === 0)) {
            alert.innerHTML = '';
            return;
        }

        if (Array.isArray(content)) {
            const listItems = content.map(item => `<li>${item}</li>`).join('');
            alert.innerHTML = `<ul>${listItems}</ul>`;
        } else {
            alert.innerHTML = content;
        }

        alert.classList.add('is-visible');
        alert.classList.add(type === 'error' ? 'is-error' : 'is-success');
    }

    function updateFieldState(input) {
        const wrapper = input.closest('.field-control');
        if (!wrapper) return;

        const hasValue = input.value && input.value.trim().length > 0;
        wrapper.classList.toggle('is-filled', hasValue);
    }

    function toggleFocusState(input, isFocused) {
        const wrapper = input.closest('.field-control');
        if (!wrapper) return;
        wrapper.classList.toggle('is-focused', isFocused);
    }

    function handleTogglePassword(button) {
        const input = button.previousElementSibling;
        if (!input || input.tagName !== 'INPUT') {
            return;
        }

        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.textContent = isHidden ? 'Ẩn' : 'Hiện';
        button.setAttribute('aria-label', isHidden ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu');
    }
})();
