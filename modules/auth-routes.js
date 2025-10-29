const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('./models/user');
const EmailService = require('./email-service');
const { issueAuthCookie, clearAuthCookie, requireAuth } = require('./middleware/auth');

class AuthRoutes {
    constructor() {
        this.router = express.Router();
        this.emailService = new EmailService();
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.post('/register', this.register.bind(this));
        this.router.post('/login', this.login.bind(this));
        this.router.post('/logout', this.logout.bind(this));
        this.router.post('/forgot-password', this.requestPasswordReset.bind(this));
        this.router.post('/reset-password', this.resetPassword.bind(this));
        this.router.get('/me', requireAuth, this.getProfile.bind(this));
        this.router.patch('/profile', requireAuth, this.updateProfile.bind(this));
        this.router.patch('/password', requireAuth, this.changePassword.bind(this));
    }

    getAppBaseUrl() {
        const configured = process.env.APP_URL
            || process.env.APP_BASE_URL
            || process.env.FRONTEND_URL
            || process.env.PUBLIC_APP_URL
            || '';

        if (configured) {
            return configured.replace(/\/+$/, '');
        }

        const port = process.env.PORT || 8080;
        return `http://localhost:${port}`;
    }

    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body || {};

            if (!email) {
                return res.status(400).json({ error: 'Email là bắt buộc.' });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            const responseMessage = 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.';

            if (!user) {
                return res.json({ message: responseMessage });
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            user.passwordResetToken = hashedToken;
            user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();

            const resetUrl = `${this.getAppBaseUrl()}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

            try {
                await this.emailService.sendPasswordResetEmail({
                    to: user.email,
                    resetUrl,
                    fullName: user.fullName
                });
            } catch (emailError) {
                console.error('Failed to send password reset email:', emailError);

                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save();

                return res.status(500).json({ error: 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.' });
            }

            return res.json({ message: responseMessage });
        } catch (error) {
            console.error('Forgot password error:', error);
            return res.status(500).json({ error: 'Không thể xử lý yêu cầu đặt lại mật khẩu.' });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, password } = req.body || {};

            if (!token || !password) {
                return res.status(400).json({ error: 'Token và mật khẩu mới là bắt buộc.' });
            }

            if (typeof password !== 'string' || password.trim().length < 6) {
                return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            }

            const hashedToken = crypto
                .createHash('sha256')
                .update(String(token).trim())
                .digest('hex');

            const user = await User.findOne({
                passwordResetToken: hashedToken,
                passwordResetExpires: { $gt: new Date() }
            });

            if (!user) {
                return res.status(400).json({ error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
            }

            const trimmedPassword = String(password).trim();

            const isSamePassword = await bcrypt.compare(trimmedPassword, user.passwordHash);
            if (isSamePassword) {
                return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
            }

            const passwordHash = await bcrypt.hash(trimmedPassword, 12);
            user.passwordHash = passwordHash;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            issueAuthCookie(res, user);

            return res.json({ message: 'Đặt lại mật khẩu thành công.' });
        } catch (error) {
            console.error('Reset password error:', error);
            return res.status(500).json({ error: 'Không thể đặt lại mật khẩu.' });
        }
    }

    async register(req, res) {
        try {
            const { email, password, fullName } = req.body || {};

            if (!email || !password) {
                return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc.' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const existingUser = await User.findOne({ email: standardizedEmail });
            if (existingUser) {
                return res.status(409).json({ error: 'Email đã được đăng ký.' });
            }

            const passwordHash = await bcrypt.hash(password, 12);
            const user = await User.create({
                email: standardizedEmail,
                passwordHash,
                fullName: fullName ? String(fullName).trim() : undefined
            });

            issueAuthCookie(res, user);

            return res.status(201).json({
                message: 'Đăng ký thành công.',
                user: user.toPublicProfile()
            });
        } catch (error) {
            console.error('Register error:', error);
            return res.status(500).json({ error: 'Không thể đăng ký tài khoản.' });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body || {};

            if (!email || !password) {
                return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc.' });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            if (!user) {
                return res.status(401).json({ error: 'Email hoặc mật khẩu không hợp lệ.' });
            }

            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Email hoặc mật khẩu không hợp lệ.' });
            }

            issueAuthCookie(res, user);

            return res.json({
                message: 'Đăng nhập thành công.',
                user: user.toPublicProfile()
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: 'Không thể đăng nhập.' });
        }
    }

    async logout(_req, res) {
        clearAuthCookie(res);
        return res.json({ message: 'Đã đăng xuất.' });
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            return res.json({ user: user.toPublicProfile() });
        } catch (error) {
            console.error('Profile error:', error);
            return res.status(500).json({ error: 'Không thể lấy thông tin người dùng.' });
        }
    }

    async updateProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            const { fullName } = req.body || {};
            const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';

            if (!normalizedName) {
                return res.status(400).json({ error: 'Tên hiển thị không được để trống.' });
            }

            if (normalizedName.length < 2) {
                return res.status(400).json({ error: 'Tên hiển thị phải có ít nhất 2 ký tự.' });
            }

            if (normalizedName.length > 80) {
                return res.status(400).json({ error: 'Tên hiển thị không được vượt quá 80 ký tự.' });
            }

            user.fullName = normalizedName;
            await user.save();
            issueAuthCookie(res, user);

            return res.json({
                message: 'Cập nhật thông tin người dùng thành công.',
                user: user.toPublicProfile()
            });
        } catch (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({ error: 'Không thể cập nhật thông tin người dùng.' });
        }
    }

    async changePassword(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            const { currentPassword, newPassword } = req.body || {};

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            }

            if (newPassword === currentPassword) {
                return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác.' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);
            user.passwordHash = passwordHash;
            await user.save();
            issueAuthCookie(res, user);

            return res.json({
                message: 'Đổi mật khẩu thành công.'
            });
        } catch (error) {
            console.error('Change password error:', error);
            return res.status(500).json({ error: 'Không thể đổi mật khẩu.' });
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AuthRoutes;
