const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('./models/user');
const EmailService = require('./services/email-service');
const { issueAuthCookie, clearAuthCookie, requireAuth } = require('./middleware/auth-middleware');

class AuthRoutes {
    constructor() {
        this.router = express.Router();
        this.emailService = new EmailService();
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.post('/register', this.register.bind(this));
        this.router.get('/verify-email', this.verifyEmail.bind(this));
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

    createEmailVerificationToken(user) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');

        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.emailVerified = false;

        return verificationToken;
    }

    buildEmailVerificationUrl(token) {
        const baseUrl = this.getAppBaseUrl();
        return `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    }

    sendVerificationResponse(req, res, { success, message }) {
        const status = success ? 200 : 400;
        const preferredType = req.accepts(['html', 'json']);

        if (preferredType === 'json') {
            return res.status(status).json({ success, message });
        }

        const safeMessage = message || (success
            ? 'Email của bạn đã được xác thực thành công.'
            : 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.');

        return res.status(status).send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeamShare Drive - ${success ? 'Xác thực thành công' : 'Xác thực thất bại'}</title>
    <link rel="icon" type="image/png" href="/public/img/favicon.png">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
        .card { background: #ffffff; border-radius: 18px; border: 1px solid rgba(148, 163, 184, 0.25); max-width: 420px; width: 100%; padding: 32px; text-align: center; box-shadow: 0 24px 60px -32px rgba(79, 70, 229, 0.25); }
        .card h1 { font-size: 24px; margin-bottom: 12px; color: ${success ? '#16a34a' : '#dc2626'}; }
        .card p { font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .card a { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; font-weight: 600; text-decoration: none; color: #ffffff; background: linear-gradient(90deg, #6366f1, #8b5cf6); box-shadow: 0 12px 30px -18px rgba(99, 102, 241, 0.9); }
        .card a:hover { background: linear-gradient(90deg, #4f46e5, #7c3aed); }
    </style>
</head>
<body>
    <div class="card">
        <img src="/public/img/favicon.png" alt="BeamShare Drive" style="width: 48px; height: 48px; margin-bottom: 18px; border-radius: 14px; box-shadow: 0 12px 30px -18px rgba(99, 102, 241, 0.65);">
        <h1>${success ? 'Xác thực thành công' : 'Xác thực thất bại'}</h1>
        <p>${safeMessage}</p>
        <a href="/auth/login">Đi tới trang đăng nhập</a>
    </div>
</body>
</html>`);
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
            const user = new User({
                email: standardizedEmail,
                passwordHash,
                fullName: fullName ? String(fullName).trim() : undefined
            });

            let verificationToken = null;
            if (this.emailService?.enabled) {
                verificationToken = this.createEmailVerificationToken(user);
            } else {
                user.emailVerified = true;
            }

            await user.save();

            let verificationEmailSent = false;
            if (verificationToken) {
                const verifyUrl = this.buildEmailVerificationUrl(verificationToken);
                try {
                    await this.emailService.sendEmailVerificationEmail({
                        to: user.email,
                        verifyUrl,
                        fullName: user.fullName
                    });
                    verificationEmailSent = true;
                } catch (emailError) {
                    console.error('Failed to send email verification message:', emailError);
                }
            }

            if (user.emailVerified) {
                issueAuthCookie(res, user);
            }

            const responseMessage = verificationToken
                ? (verificationEmailSent
                    ? 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.'
                    : 'Đăng ký thành công. Không thể gửi email xác thực, vui lòng thử lại sau.')
                : 'Đăng ký thành công.';

            return res.status(201).json({
                message: responseMessage,
                user: user.toPublicProfile(),
                verificationEmailSent,
                requiresEmailVerification: !user.emailVerified
            });
        } catch (error) {
            console.error('Register error:', error);
            return res.status(500).json({ error: 'Không thể đăng ký tài khoản.' });
        }
    }

    async verifyEmail(req, res) {
        try {
            const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
            if (!token) {
                return this.sendVerificationResponse(req, res, {
                    success: false,
                    message: 'Liên kết xác thực không hợp lệ.'
                });
            }

            const hashedToken = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');

            const user = await User.findOne({
                emailVerificationToken: hashedToken,
                emailVerificationExpires: { $gt: new Date() }
            });

            if (!user) {
                return this.sendVerificationResponse(req, res, {
                    success: false,
                    message: 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.'
                });
            }

            user.emailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save();

            issueAuthCookie(res, user);

            return this.sendVerificationResponse(req, res, {
                success: true,
                message: 'Email của bạn đã được xác thực thành công. Bạn có thể tiếp tục sử dụng BeamShare Drive.'
            });
        } catch (error) {
            console.error('Verify email error:', error);
            return this.sendVerificationResponse(req, res, {
                success: false,
                message: 'Không thể xác thực email. Vui lòng thử lại sau.'
            });
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
