// Base JavaScript - Common functionality and navigation
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const logoutButton = document.getElementById('logout-button');
    const logoutLabel = logoutButton ? logoutButton.querySelector('span') : null;
    const defaultLogoutText = logoutLabel ? logoutLabel.textContent : '';
    const canUseDynamicRouter = () => typeof window.loadPage === 'function';

    let currentUserProfile = null;
    let currentUserFetchPromise = null;

    const avatarPalette = ['#8b5cf6', '#6366f1', '#2563eb', '#0ea5e9', '#14b8a6', '#10b981', '#f97316', '#ec4899'];

    const headerMenuContainer = document.getElementById('header-user-menu-container');
    const headerMenuButton = headerMenuContainer ? headerMenuContainer.querySelector('.user-menu-button') : null;
    const headerMenuPanel = document.getElementById('header-user-menu');
    const headerMenuProfileButton = document.getElementById('header-user-menu-profile');
    const headerMenuPasswordButton = document.getElementById('header-user-menu-password');
    const headerMenuLogoutButton = document.getElementById('header-user-menu-logout');
    const headerMenuAvatarEl = document.getElementById('header-menu-avatar');
    const headerMenuInitialEl = document.getElementById('header-menu-initial');
    const headerMenuNameEl = document.getElementById('header-menu-name');
    const headerMenuEmailEl = document.getElementById('header-menu-email');
    let isUserMenuOpen = false;

    // Generate a deterministic avatar color from the provided key so each user keeps the same tone.
    function getAvatarColor(key) {
        if (!key) {
            return avatarPalette[0];
        }

        let hash = 0;
        for (let index = 0; index < key.length; index += 1) {
            hash = (hash << 5) - hash + key.charCodeAt(index);
            hash |= 0; // Keep the hash in the 32-bit integer range
        }

        const paletteIndex = Math.abs(hash) % avatarPalette.length;
        return avatarPalette[paletteIndex];
    }

    function normaliseText(value) {
        if (!value) {
            return '';
        }
        const text = String(value);
        if (typeof text.normalize === 'function') {
            return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return text;
    }

    function computeInitials(nameText, emailText) {
        const cleanedName = normaliseText(nameText).trim();
        const nameParts = cleanedName.split(/\s+/).filter(Boolean);
        let initials = '';

        if (nameParts.length >= 2) {
            const first = nameParts[0].charAt(0);
            const last = nameParts[nameParts.length - 1].charAt(0);
            initials = `${first}${last}`;
        } else if (nameParts.length === 1) {
            const word = nameParts[0];
            initials = word.substring(0, 2);
        }

        if (!initials) {
            const fallbackSource = normaliseText(emailText || '').split('@')[0];
            initials = fallbackSource ? fallbackSource.substring(0, 2) : '';
        }

        const upper = (initials || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return upper || 'U';
    }

    function deriveUserDisplay(user) {
        const fallbackName = 'User';
        const fallbackInitials = 'U';

        if (!user) {
            return {
                displayName: fallbackName,
                initials: fallbackInitials,
                initial: fallbackInitials,
                color: avatarPalette[0],
                email: null
            };
        }

        const rawName = (user.fullName && user.fullName.trim()) || '';
        let displayName = rawName;

        if (!displayName && user.email) {
            const email = String(user.email).trim();
            const mailbox = email.split('@')[0];
            displayName = mailbox || email;
        }

        displayName = displayName || fallbackName;
        const initials = computeInitials(displayName, user.email) || fallbackInitials;
        const color = getAvatarColor(user.email || rawName || displayName);

        return {
            displayName,
            initials,
            initial: initials,
            color,
            email: user.email || null
        };
    }

    function openUserMenu() {
        if (!headerMenuPanel || !headerMenuButton || !headerMenuContainer) {
            return;
        }

        headerMenuPanel.classList.add('is-visible');
        headerMenuContainer.classList.add('is-open');
        headerMenuButton.setAttribute('aria-expanded', 'true');
        isUserMenuOpen = true;

        if (headerMenuProfileButton) {
            setTimeout(() => {
                headerMenuProfileButton.focus();
            }, 0);
        }
    }

    function closeUserMenu() {
        if (!headerMenuPanel || !headerMenuButton || !headerMenuContainer) {
            return;
        }

        headerMenuPanel.classList.remove('is-visible');
        headerMenuContainer.classList.remove('is-open');
        headerMenuButton.setAttribute('aria-expanded', 'false');
        isUserMenuOpen = false;
    }

    function toggleUserMenu() {
        if (!headerMenuPanel || !headerMenuButton) {
            return;
        }

        if (isUserMenuOpen) {
            closeUserMenu();
        } else {
            openUserMenu();
        }
    }

    function applyUserInfoToDom(user) {
    const display = deriveUserDisplay(user);
    const displayName = display.displayName || 'User';
    const initials = display.initials || display.initial || 'U';
    const color = display.color || avatarPalette[0];
    const email = display.email || null;

        const sidebarInitialEl = document.getElementById('user-initial');
        const sidebarAvatarEl = document.getElementById('sidebar-user-avatar');
        const userNameEl = document.getElementById('user-name');
        const dashboardAvatarEl = document.getElementById('dashboard-user-avatar');
        const dashboardInitialEl = document.getElementById('dashboard-user-initial');
        const dashboardNameEl = document.getElementById('dashboard-user-name');

        if (sidebarInitialEl) {
            sidebarInitialEl.textContent = initials;
        }

        if (userNameEl) {
            userNameEl.textContent = displayName;
            userNameEl.setAttribute('title', displayName);
        }

        if (sidebarAvatarEl) {
            sidebarAvatarEl.style.background = color;
        }

        if (headerMenuInitialEl) {
            headerMenuInitialEl.textContent = initials;
        }

        if (headerMenuAvatarEl) {
            headerMenuAvatarEl.style.background = color;
            headerMenuAvatarEl.setAttribute('title', displayName);
        }

        if (headerMenuNameEl) {
            headerMenuNameEl.textContent = displayName;
            headerMenuNameEl.setAttribute('title', displayName);
        }

        if (headerMenuEmailEl) {
            if (email) {
                headerMenuEmailEl.textContent = email;
                headerMenuEmailEl.style.display = '';
            } else {
                headerMenuEmailEl.textContent = '';
                headerMenuEmailEl.style.display = 'none';
            }
        }

        if (headerMenuButton) {
            headerMenuButton.setAttribute('aria-label', `Mở menu người dùng cho ${displayName}`);
        }

        if (dashboardInitialEl) {
            dashboardInitialEl.textContent = initials;
        }

        if (dashboardAvatarEl) {
            dashboardAvatarEl.style.background = color;
            dashboardAvatarEl.setAttribute('title', displayName);
        }

        if (dashboardNameEl) {
            dashboardNameEl.textContent = `Xin chào, ${displayName}`;
        }

        const profileUpdatedEvent = new CustomEvent('userprofile:updated', {
            detail: { profile: user || null }
        });
        document.dispatchEvent(profileUpdatedEvent);
    }

    function fetchCurrentUserProfile(forceRefresh = false) {
        if (!forceRefresh) {
            if (currentUserProfile) {
                return Promise.resolve(currentUserProfile);
            }

            if (currentUserFetchPromise) {
                return currentUserFetchPromise;
            }
        }

        currentUserFetchPromise = (async () => {
            try {
                const response = await fetch('/api/auth/me', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json().catch(() => ({}));
                    currentUserProfile = data && data.user ? data.user : null;
                    return currentUserProfile;
                }

                if (response.status === 401) {
                    currentUserProfile = null;
                    window.location.href = '/landing';
                    return null;
                }

                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || `Failed to fetch profile (${response.status})`);
            } catch (error) {
                console.error('Không thể tải thông tin người dùng:', error);
                if (currentUserProfile) {
                    return currentUserProfile;
                }
                throw error;
            } finally {
                currentUserFetchPromise = null;
            }
        })();

        return currentUserFetchPromise;
    }

    async function updateUserInfo() {
        try {
            const profile = await fetchCurrentUserProfile(false);
            currentUserProfile = profile;
            window.currentUserProfile = profile;
            applyUserInfoToDom(profile);
        } catch (_error) {
            applyUserInfoToDom(null);
        }
    }

    async function fallbackPerformLogout(origin = 'sidebar') {
        const isSidebarTrigger = origin === 'sidebar' && Boolean(logoutButton);
        const triggerButton = isSidebarTrigger ? logoutButton : headerMenuLogoutButton;
        const labelElement = isSidebarTrigger ? logoutLabel : null;

        if (triggerButton && triggerButton.disabled) {
            return;
        }

        if (triggerButton) {
            triggerButton.disabled = true;
            triggerButton.setAttribute('aria-busy', 'true');
        }

        if (labelElement) {
            labelElement.textContent = 'Đang đăng xuất...';
        } else if (origin === 'menu' && window.toastSystem) {
            window.toastSystem.info('Đang đăng xuất...', { duration: 2000 });
        }

        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Logout failed with status ${response.status}`);
            }

            currentUserProfile = null;
            window.currentUserProfile = null;
            window.location.href = '/landing';
        } catch (error) {
            console.error('Đăng xuất thất bại:', error);
            if (window.toastSystem) {
                window.toastSystem.error('Không thể đăng xuất. Vui lòng thử lại.', { duration: 3200 });
            }
            if (labelElement) {
                labelElement.textContent = defaultLogoutText;
            }
            if (triggerButton) {
                triggerButton.disabled = false;
                triggerButton.removeAttribute('aria-busy');
            }
        }
    }

    async function performLogout(origin = 'sidebar') {
        const module = window.logoutModule;
        if (module && typeof module.performLogout === 'function') {
            const isSidebarTrigger = origin === 'sidebar' && Boolean(logoutButton);
            const triggerButton = isSidebarTrigger ? logoutButton : headerMenuLogoutButton;
            const labelElement = isSidebarTrigger ? logoutLabel : null;

            try {
                await module.performLogout({
                    origin,
                    triggerButton,
                    labelElement,
                    defaultLabelText: defaultLogoutText,
                    toastSystem: window.toastSystem,
                    onSuccess: () => {
                        currentUserProfile = null;
                        window.currentUserProfile = null;
                        window.location.href = '/landing';
                    }
                });
            } catch (_error) {
                // Error notifications are handled inside the logout module.
            }

            return;
        }

        await fallbackPerformLogout(origin);
    }

    function openProfileModal() {
        const profile = currentUserProfile || window.currentUserProfile || null;
        const formId = 'user-profile-update-form';
        const errorId = 'user-profile-update-error';
        const body = `
            <form id="${formId}" class="modal-form" novalidate>
                <div class="form-group">
                    <label for="profile-display-name">Tên hiển thị</label>
                    <input type="text" id="profile-display-name" name="fullName" maxlength="80" value="${escapeHtml(profile?.fullName || '')}" placeholder="Nhập tên hiển thị" required />
                    <p class="form-hint">Tên này sẽ xuất hiện trên dashboard và menu người dùng.</p>
                </div>
                <div class="form-error" id="${errorId}" style="display: none;"></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" type="button" id="user-profile-update-cancel">Hủy</button>
            <button class="btn btn-primary" type="submit" form="${formId}" id="user-profile-update-save">Lưu thay đổi</button>
        `;

        modalSystem.show({
            title: 'Cập nhật thông tin người dùng',
            body,
            footer
        });

        const form = document.getElementById(formId);
        const cancelButton = document.getElementById('user-profile-update-cancel');
        const saveButton = document.getElementById('user-profile-update-save');
        const errorBox = document.getElementById(errorId);
        const nameInput = document.getElementById('profile-display-name');

        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                modalSystem.hide();
            });
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!nameInput) {
                    return;
                }

                const fullName = nameInput.value.trim();

                if (!fullName) {
                    if (errorBox) {
                        errorBox.textContent = 'Vui lòng nhập tên hiển thị.';
                        errorBox.style.display = 'block';
                    }
                    nameInput.focus();
                    return;
                }

                if (fullName.length < 2) {
                    if (errorBox) {
                        errorBox.textContent = 'Tên hiển thị phải có ít nhất 2 ký tự.';
                        errorBox.style.display = 'block';
                    }
                    nameInput.focus();
                    return;
                }

                if (errorBox) {
                    errorBox.textContent = '';
                    errorBox.style.display = 'none';
                }

                if (saveButton) {
                    saveButton.disabled = true;
                    saveButton.textContent = 'Đang lưu...';
                }

                try {
                    const response = await fetch('/api/auth/profile', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ fullName })
                    });

                    const payload = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        const message = payload?.error || 'Không thể cập nhật thông tin người dùng.';
                        if (errorBox) {
                            errorBox.textContent = message;
                            errorBox.style.display = 'block';
                        }
                        return;
                    }

                    if (payload?.user) {
                        currentUserProfile = payload.user;
                        window.currentUserProfile = payload.user;
                        applyUserInfoToDom(payload.user);
                    }

                    modalSystem.hide();
                    if (window.toastSystem) {
                        window.toastSystem.success('Đã cập nhật tên hiển thị.', { duration: 2200 });
                    }
                } catch (error) {
                    console.error('Cập nhật hồ sơ thất bại:', error);
                    if (errorBox) {
                        errorBox.textContent = 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
                        errorBox.style.display = 'block';
                    }
                } finally {
                    if (saveButton) {
                        saveButton.disabled = false;
                        saveButton.textContent = 'Lưu thay đổi';
                    }
                }
            });
        }
    }

    function openPasswordModal() {
        const formId = 'user-password-update-form';
        const errorId = 'user-password-update-error';
        const body = `
            <form id="${formId}" class="modal-form" novalidate>
                <div class="form-group">
                    <label for="current-password">Mật khẩu hiện tại</label>
                    <input type="password" id="current-password" name="currentPassword" autocomplete="current-password" required />
                </div>
                <div class="form-group">
                    <label for="new-password">Mật khẩu mới</label>
                    <input type="password" id="new-password" name="newPassword" autocomplete="new-password" required />
                    <p class="form-hint">Mật khẩu mới cần ít nhất 6 ký tự.</p>
                </div>
                <div class="form-group">
                    <label for="confirm-password">Nhập lại mật khẩu mới</label>
                    <input type="password" id="confirm-password" autocomplete="new-password" required />
                </div>
                <div class="form-error" id="${errorId}" style="display: none;"></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" type="button" id="user-password-update-cancel">Hủy</button>
            <button class="btn btn-primary" type="submit" form="${formId}" id="user-password-update-save">Đổi mật khẩu</button>
        `;

        modalSystem.show({
            title: 'Đổi mật khẩu',
            body,
            footer
        });

        const form = document.getElementById(formId);
        const cancelButton = document.getElementById('user-password-update-cancel');
        const saveButton = document.getElementById('user-password-update-save');
        const errorBox = document.getElementById(errorId);
        const currentInput = document.getElementById('current-password');
        const newInput = document.getElementById('new-password');
        const confirmInput = document.getElementById('confirm-password');

        if (currentInput) {
            currentInput.focus();
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                modalSystem.hide();
            });
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                const currentPassword = currentInput ? currentInput.value : '';
                const newPassword = newInput ? newInput.value : '';
                const confirmPassword = confirmInput ? confirmInput.value : '';

                if (!currentPassword || !newPassword || !confirmPassword) {
                    if (errorBox) {
                        errorBox.textContent = 'Vui lòng nhập đầy đủ thông tin.';
                        errorBox.style.display = 'block';
                    }
                    return;
                }

                if (newPassword.length < 6) {
                    if (errorBox) {
                        errorBox.textContent = 'Mật khẩu mới phải có tối thiểu 6 ký tự.';
                        errorBox.style.display = 'block';
                    }
                    if (newInput) {
                        newInput.focus();
                    }
                    return;
                }

                if (newPassword !== confirmPassword) {
                    if (errorBox) {
                        errorBox.textContent = 'Mật khẩu mới và nhập lại chưa trùng khớp.';
                        errorBox.style.display = 'block';
                    }
                    if (confirmInput) {
                        confirmInput.focus();
                    }
                    return;
                }

                if (currentPassword === newPassword) {
                    if (errorBox) {
                        errorBox.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
                        errorBox.style.display = 'block';
                    }
                    if (newInput) {
                        newInput.focus();
                    }
                    return;
                }

                if (errorBox) {
                    errorBox.textContent = '';
                    errorBox.style.display = 'none';
                }

                if (saveButton) {
                    saveButton.disabled = true;
                    saveButton.textContent = 'Đang cập nhật...';
                }

                try {
                    const response = await fetch('/api/auth/password', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ currentPassword, newPassword })
                    });

                    const payload = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        const message = payload?.error || 'Không thể đổi mật khẩu.';
                        if (errorBox) {
                            errorBox.textContent = message;
                            errorBox.style.display = 'block';
                        }
                        return;
                    }

                    modalSystem.hide();
                    if (window.toastSystem) {
                        window.toastSystem.success('Đổi mật khẩu thành công.', { duration: 2400 });
                    }
                } catch (error) {
                    console.error('Đổi mật khẩu thất bại:', error);
                    if (errorBox) {
                        errorBox.textContent = 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
                        errorBox.style.display = 'block';
                    }
                } finally {
                    if (saveButton) {
                        saveButton.disabled = false;
                        saveButton.textContent = 'Đổi mật khẩu';
                    }
                }
            });
        }
    }

    if (headerMenuButton && headerMenuPanel) {
        headerMenuButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleUserMenu();
        });
    }

    if (headerMenuPanel) {
        headerMenuPanel.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    document.addEventListener('click', (event) => {
        if (!isUserMenuOpen) {
            return;
        }

        if (headerMenuContainer && headerMenuContainer.contains(event.target)) {
            return;
        }

        closeUserMenu();
    });

    document.addEventListener('focusin', (event) => {
        if (!isUserMenuOpen) {
            return;
        }

        if (headerMenuContainer && headerMenuContainer.contains(event.target)) {
            return;
        }

        closeUserMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (!isUserMenuOpen) {
            return;
        }

        if (event.key === 'Escape') {
            closeUserMenu();
            if (headerMenuButton) {
                headerMenuButton.focus();
            }
        }
    });

    if (headerMenuProfileButton) {
        headerMenuProfileButton.addEventListener('click', () => {
            closeUserMenu();
            if (canUseDynamicRouter() && typeof window.switchToPage === 'function') {
                window.switchToPage('change-thongtin');
            } else {
                openProfileModal();
            }
        });
    }

    if (headerMenuPasswordButton) {
        headerMenuPasswordButton.addEventListener('click', () => {
            closeUserMenu();
            if (canUseDynamicRouter() && typeof window.switchToPage === 'function') {
                window.switchToPage('change-matkhau');
            } else {
                openPasswordModal();
            }
        });
    }

    if (headerMenuLogoutButton) {
        headerMenuLogoutButton.addEventListener('click', async () => {
            closeUserMenu();
            await performLogout('menu');
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await performLogout('sidebar');
        });
    }

    // Load page-specific functionality
    function loadPageFunctionality(page) {
        // This function is kept for compatibility but functionality
        // is now handled by the main index.html script
        switch(page) {
            case 'myfiles':
                if (window.initMyFiles) window.initMyFiles();
                break;
            case 'upload':
                if (window.initUpload) window.initUpload();
                break;
            case 'dashboard':
                if (window.initDashboard) window.initDashboard();
                break;
            case 'subscription':
                if (window.initSubscription) window.initSubscription();
                break;
        }
    }
    
    // Initialize with default page (Dashboard)
    updateUserInfo('dashboard');
    
    // Global functions
    window.updateUserInfo = updateUserInfo;
    window.getCurrentUserProfile = function(forceRefresh = false) {
        return fetchCurrentUserProfile(forceRefresh);
    };
    window.refreshCurrentUserProfile = async function() {
        const profile = await fetchCurrentUserProfile(true);
        currentUserProfile = profile;
        window.currentUserProfile = profile;
        applyUserInfoToDom(profile);
        return profile;
    };
    window.switchToPage = function(pageName, options) {
        if (typeof window.loadPage === 'function') {
            window.loadPage(pageName, options);
            return;
        }

        const navItem = document.querySelector(`[data-page="${pageName}"]`);
        if (navItem) {
            navItem.click();
        }
    };
    window.getUserDisplayInfo = deriveUserDisplay;
});

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Show notification utility
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}