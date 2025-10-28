const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('./models/user');
const { issueAuthCookie, clearAuthCookie, requireAuth } = require('./middleware/auth');

class AuthRoutes {
    constructor() {
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
    this.router.post('/register', this.register.bind(this));
    this.router.post('/login', this.login.bind(this));
    this.router.post('/logout', this.logout.bind(this));
    this.router.get('/me', requireAuth, this.getProfile.bind(this));
    this.router.patch('/profile', requireAuth, this.updateProfile.bind(this));
    this.router.patch('/password', requireAuth, this.changePassword.bind(this));
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
