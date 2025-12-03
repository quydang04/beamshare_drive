const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const EmailService = require('../services/email-service');
const { issueAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth-middleware');
const { t, getLangFromRequest, interpolate } = require('../translate/i18n');

class AuthRoutes {
    constructor() {
        this.router = express.Router();
        this.emailService = new EmailService();
        this.setupRoutes();
    }

    // Helper method to get translation
    msg(req, key) {
        const lang = getLangFromRequest(req);
        return t(lang, `backend.auth.${key}`);
    }

    // Get language from request (for backward compatibility)
    getLanguage(req) {
        return getLangFromRequest(req);
    }

    setupRoutes() {
        this.router.post('/register', this.register.bind(this));
        this.router.get('/verify-email', this.verifyEmail.bind(this));
        this.router.post('/login', this.login.bind(this));
        this.router.post('/logout', this.logout.bind(this));
        this.router.post('/forgot-password', this.requestPasswordReset.bind(this));
        this.router.post('/reset-password', this.resetPassword.bind(this));
        this.router.post('/resend-verification', this.resendVerificationEmail.bind(this));
        this.router.post('/resend-password-reset', this.resendPasswordResetEmail.bind(this));
        this.router.post('/check-token', this.checkTokenValidity.bind(this));
        this.router.get('/me', requireAuth, this.getProfile.bind(this));
        this.router.patch('/profile', requireAuth, this.updateProfile.bind(this));
        this.router.patch('/password', requireAuth, this.changePassword.bind(this));
    }

    getAppBaseUrl() {
        const configured = typeof process.env.APP_URL === 'string'
            ? process.env.APP_URL.trim()
            : '';

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
        user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000);
        user.emailVerified = false;
        user.lastVerificationEmailSent = new Date();

        return verificationToken;
    }

    buildEmailVerificationUrl(token) {
        const baseUrl = this.getAppBaseUrl();
        return `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    }

    sendVerificationResponse(req, res, { success, message, expired = false, email = '' }) {
        const status = success ? 200 : 400;
        const preferredType = req.accepts(['html', 'json']);

        if (preferredType === 'json') {
            return res.status(status).json({ success, message, expired, email });
        }

        const lang = this.getLanguage(req);
        const safeMessage = message || (success
            ? this.msg(req, 'verificationSuccess')
            : this.msg(req, 'verificationFailed'));
        
        // Get localized texts from i18n
        const i18nTexts = {
            successTitle: t(lang, 'backend.auth.successTitle'),
            failedTitle: t(lang, 'backend.auth.failedTitle'),
            linkExpiredHint: t(lang, 'backend.auth.linkExpiredHint'),
            resendBtn: t(lang, 'backend.auth.resendBtn'),
            sending: t(lang, 'backend.auth.sending'),
            resendError: t(lang, 'backend.auth.resendError'),
            resendSuccess: t(lang, 'backend.auth.resendSuccess'),
            connectionError: t(lang, 'backend.auth.connectionError'),
            resendAfter: t(lang, 'backend.auth.resendAfter'),
            goToLogin: t(lang, 'backend.auth.goToLogin')
        };

        const resendSection = expired && email ? `
            <div id="resend-section" style="margin-top: 20px;">
                <p style="font-size: 14px; color: #64748b; margin-bottom: 12px;">${i18nTexts.linkExpiredHint}</p>
                <button id="resend-btn" onclick="resendVerification()" style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; font-weight: 600; text-decoration: none; color: #ffffff; background: linear-gradient(90deg, #6366f1, #8b5cf6); box-shadow: 0 12px 30px -18px rgba(99, 102, 241, 0.9); border: none; cursor: pointer; font-size: 14px;">
                    ${i18nTexts.resendBtn}
                </button>
                <p id="resend-message" style="margin-top: 12px; font-size: 14px;"></p>
            </div>
            <script>
                let cooldown = 0;
                let timer = null;
                const i18n = ${JSON.stringify(i18nTexts)};
                
                async function resendVerification() {
                    if (cooldown > 0) return;
                    
                    const btn = document.getElementById('resend-btn');
                    const msg = document.getElementById('resend-message');
                    btn.disabled = true;
                    btn.textContent = i18n.sending;
                    
                    try {
                        const response = await fetch('/api/auth/resend-verification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: '${email}', lang: '${lang}' })
                        });
                        
                        const data = await response.json();
                        
                        if (response.status === 429) {
                            startCooldown(data.remainingSeconds || 90);
                            msg.style.color = '#f59e0b';
                            msg.textContent = data.error;
                            return;
                        }
                        
                        if (!response.ok) {
                            msg.style.color = '#dc2626';
                            msg.textContent = data.error || i18n.resendError;
                            btn.disabled = false;
                            btn.textContent = i18n.resendBtn;
                            return;
                        }
                        
                        msg.style.color = '#16a34a';
                        msg.textContent = i18n.resendSuccess;
                        startCooldown(90);
                    } catch (error) {
                        msg.style.color = '#dc2626';
                        msg.textContent = i18n.connectionError;
                        btn.disabled = false;
                        btn.textContent = i18n.resendBtn;
                    }
                }
                
                function startCooldown(seconds) {
                    cooldown = seconds;
                    updateButton();
                    if (timer) clearInterval(timer);
                    timer = setInterval(() => {
                        cooldown--;
                        updateButton();
                        if (cooldown <= 0) {
                            clearInterval(timer);
                            timer = null;
                        }
                    }, 1000);
                }
                
                function updateButton() {
                    const btn = document.getElementById('resend-btn');
                    if (cooldown > 0) {
                        btn.disabled = true;
                        btn.textContent = i18n.resendAfter + ' ' + cooldown + 's';
                    } else {
                        btn.disabled = false;
                        btn.textContent = i18n.resendBtn;
                    }
                }
            </script>
        ` : '';

        return res.status(status).send(`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeamShare Drive - ${success ? i18nTexts.successTitle : i18nTexts.failedTitle}</title>
    <link rel="icon" type="image/png" href="/public/img/favicon.png">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
        .card { background: #ffffff; border-radius: 18px; border: 1px solid rgba(148, 163, 184, 0.25); max-width: 420px; width: 100%; padding: 32px; text-align: center; box-shadow: 0 24px 60px -32px rgba(79, 70, 229, 0.25); }
        .card h1 { font-size: 24px; margin-bottom: 12px; color: ${success ? '#16a34a' : '#dc2626'}; }
        .card p { font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .card a { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 10px; font-weight: 600; text-decoration: none; color: #ffffff; background: linear-gradient(90deg, #6366f1, #8b5cf6); box-shadow: 0 12px 30px -18px rgba(99, 102, 241, 0.9); }
        .card a:hover { background: linear-gradient(90deg, #4f46e5, #7c3aed); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="card">
        <img src="/public/img/favicon.png" alt="BeamShare Drive" style="width: 48px; height: 48px; margin-bottom: 18px; border-radius: 14px; box-shadow: 0 12px 30px -18px rgba(99, 102, 241, 0.65);">
        <h1>${success ? i18nTexts.successTitle : i18nTexts.failedTitle}</h1>
        <p>${safeMessage}</p>
        ${resendSection}
        <a href="/auth/login" style="${expired ? 'margin-top: 16px;' : ''}">${i18nTexts.goToLogin}</a>
    </div>
</body>
</html>`);
    }

    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body || {};

            if (!email) {
                return res.status(400).json({ error: this.msg(req, 'emailRequired') });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            const responseMessage = this.msg(req, 'forgotPasswordSuccess');

            if (!user) {
                return res.json({ message: responseMessage });
            }

            const lang = this.getLanguage(req);
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            user.passwordResetToken = hashedToken;
            user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
            user.lastPasswordResetEmailSent = new Date();
            await user.save();

            const resetUrl = `${this.getAppBaseUrl()}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

            try {
                await this.emailService.sendPasswordResetEmail({
                    to: user.email,
                    resetUrl,
                    fullName: user.fullName,
                    lang
                });
            } catch (emailError) {
                console.error('Failed to send password reset email:', emailError);

                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save();

                return res.status(500).json({ error: this.msg(req, 'forgotPasswordError') });
            }

            return res.json({ message: responseMessage });
        } catch (error) {
            console.error('Forgot password error:', error);
            return res.status(500).json({ error: this.msg(req, 'forgotPasswordProcessError') });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, password } = req.body || {};

            if (!token || !password) {
                return res.status(400).json({ error: this.msg(req, 'tokenPasswordRequired') });
            }

            if (typeof password !== 'string' || password.trim().length < 6) {
                return res.status(400).json({ error: this.msg(req, 'newPasswordMinLength') });
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
                return res.status(400).json({ error: this.msg(req, 'invalidResetLink') });
            }

            const trimmedPassword = String(password).trim();

            const isSamePassword = await bcrypt.compare(trimmedPassword, user.passwordHash);
            if (isSamePassword) {
                return res.status(400).json({ error: this.msg(req, 'passwordSameAsCurrent') });
            }

            const passwordHash = await bcrypt.hash(trimmedPassword, 12);
            user.passwordHash = passwordHash;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            issueAuthCookie(res, user);

            return res.json({ message: this.msg(req, 'resetPasswordSuccess') });
        } catch (error) {
            console.error('Reset password error:', error);
            return res.status(500).json({ error: this.msg(req, 'resetPasswordError') });
        }
    }

    async register(req, res) {
        try {
            const { email, password, fullName } = req.body || {};

            if (!email || !password) {
                return res.status(400).json({ error: this.msg(req, 'emailPasswordRequired') });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: this.msg(req, 'passwordMinLength') });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const existingUser = await User.findOne({ email: standardizedEmail });
            if (existingUser) {
                return res.status(409).json({ error: this.msg(req, 'emailAlreadyRegistered') });
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
                const lang = this.getLanguage(req);
                try {
                    await this.emailService.sendEmailVerificationEmail({
                        to: user.email,
                        verifyUrl,
                        fullName: user.fullName,
                        lang
                    });
                    verificationEmailSent = true;
                } catch (emailError) {
                    console.error('Failed to send email verification message:', emailError);
                }
            }

            if (user.emailVerified) {
                issueAuthCookie(res, user);
            }

            const lang = this.getLanguage(req);
            let responseMessage;
            if (verificationToken) {
                responseMessage = verificationEmailSent
                    ? t(lang, 'backend.auth.registerSuccess')
                    : t(lang, 'backend.auth.registerSuccessNoEmail');
            } else {
                responseMessage = t(lang, 'backend.auth.registerSuccessSimple');
            }

            return res.status(201).json({
                message: responseMessage,
                user: user.toPublicProfile(),
                verificationEmailSent,
                requiresEmailVerification: !user.emailVerified
            });
        } catch (error) {
            console.error('Register error:', error);
            return res.status(500).json({ 
                error: this.msg(req, 'registerError')
            });
        }
    }

    async verifyEmail(req, res) {
        try {
            const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
            if (!token) {
                return this.sendVerificationResponse(req, res, {
                    success: false,
                    message: this.msg(req, 'verifyLinkInvalid')
                });
            }

            const hashedToken = crypto
                .createHash('sha256')
                .update(token)
                .digest('hex');

            // First, find user with this token (regardless of expiration)
            const userWithToken = await User.findOne({
                emailVerificationToken: hashedToken
            });

            if (!userWithToken) {
                return this.sendVerificationResponse(req, res, {
                    success: false,
                    message: this.msg(req, 'invalidToken')
                });
            }

            // Check if token is expired
            if (!userWithToken.emailVerificationExpires || new Date() > userWithToken.emailVerificationExpires) {
                return this.sendVerificationResponse(req, res, {
                    success: false,
                    message: this.msg(req, 'verifyLinkExpired'),
                    expired: true,
                    email: userWithToken.email
                });
            }

            userWithToken.emailVerified = true;
            userWithToken.emailVerificationToken = undefined;
            userWithToken.emailVerificationExpires = undefined;
            await userWithToken.save();

            issueAuthCookie(res, userWithToken);

            return this.sendVerificationResponse(req, res, {
                success: true,
                message: this.msg(req, 'verifySuccess')
            });
        } catch (error) {
            console.error('Verify email error:', error);
            return this.sendVerificationResponse(req, res, {
                success: false,
                message: this.msg(req, 'verificationFailed')
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body || {};

            if (!email || !password) {
                return res.status(400).json({ error: this.msg(req, 'emailPasswordRequired') });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            if (!user) {
                return res.status(401).json({ error: this.msg(req, 'invalidCredentials') });
            }

            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: this.msg(req, 'invalidCredentials') });
            }

            // Check if email is verified
            if (!user.emailVerified) {
                return res.status(403).json({
                    error: this.msg(req, 'emailNotVerified'),
                    code: 'EMAIL_NOT_VERIFIED',
                    email: user.email
                });
            }

            issueAuthCookie(res, user);

            return res.json({
                message: this.msg(req, 'loginSuccess'),
                user: user.toPublicProfile()
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ 
                error: this.msg(req, 'loginError')
            });
        }
    }

    async logout(req, res) {
        clearAuthCookie(res);
        return res.json({ message: this.msg(req, 'logoutSuccess') });
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: this.msg(req, 'userNotFound') });
            }

            return res.json({ user: user.toPublicProfile() });
        } catch (error) {
            console.error('Profile error:', error);
            return res.status(500).json({ 
                error: this.msg(req, 'getProfileError')
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: this.msg(req, 'userNotFound') });
            }

            const { fullName } = req.body || {};
            const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';

            if (!normalizedName) {
                return res.status(400).json({ 
                    error: this.msg(req, 'displayNameEmpty')
                });
            }

            if (normalizedName.length < 2) {
                return res.status(400).json({ 
                    error: this.msg(req, 'displayNameMinLength')
                });
            }

            if (normalizedName.length > 80) {
                return res.status(400).json({ 
                    error: this.msg(req, 'displayNameMaxLength')
                });
            }

            user.fullName = normalizedName;
            await user.save();
            issueAuthCookie(res, user);

            return res.json({
                message: this.msg(req, 'profileUpdateSuccess'),
                user: user.toPublicProfile()
            });
        } catch (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({ error: this.msg(req, 'profileUpdateError') });
        }
    }

    async changePassword(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: this.msg(req, 'userNotFound') });
            }

            const { currentPassword, newPassword } = req.body || {};

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ 
                    error: this.msg(req, 'passwordBothRequired')
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: this.msg(req, 'newPasswordMinLength') });
            }

            if (newPassword === currentPassword) {
                return res.status(400).json({ error: this.msg(req, 'passwordSameAsCurrent') });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: this.msg(req, 'currentPasswordIncorrect') });
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);
            user.passwordHash = passwordHash;
            await user.save();
            issueAuthCookie(res, user);

            return res.json({
                message: this.msg(req, 'passwordChangeSuccess')
            });
        } catch (error) {
            console.error('Change password error:', error);
            return res.status(500).json({ error: this.msg(req, 'passwordChangeError') });
        }
    }

    // Resend verification email with 90 second rate limiting
    async resendVerificationEmail(req, res) {
        try {
            const { email } = req.body || {};
            const lang = this.getLanguage(req);

            if (!email) {
                return res.status(400).json({ 
                    error: this.msg(req, 'emailRequired')
                });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            // Don't reveal if user exists
            const genericMessage = t(lang, 'backend.auth.accountExistsNotVerified');

            if (!user) {
                return res.json({ message: genericMessage });
            }

            if (user.emailVerified) {
                return res.status(400).json({ 
                    error: t(lang, 'backend.auth.accountAlreadyVerified')
                });
            }

            // Check rate limiting (90 seconds)
            const RATE_LIMIT_SECONDS = 90;
            if (user.lastVerificationEmailSent) {
                const timeSinceLastEmail = (Date.now() - user.lastVerificationEmailSent.getTime()) / 1000;
                if (timeSinceLastEmail < RATE_LIMIT_SECONDS) {
                    const remainingSeconds = Math.ceil(RATE_LIMIT_SECONDS - timeSinceLastEmail);
                    return res.status(429).json({
                        error: interpolate(t(lang, 'backend.auth.waitSecondsBeforeResend'), { seconds: remainingSeconds }),
                        remainingSeconds
                    });
                }
            }

            // Generate new verification token
            const verificationToken = this.createEmailVerificationToken(user);
            await user.save();

            const verifyUrl = this.buildEmailVerificationUrl(verificationToken);
            try {
                await this.emailService.sendEmailVerificationEmail({
                    to: user.email,
                    verifyUrl,
                    fullName: user.fullName,
                    lang
                });
            } catch (emailError) {
                console.error('Failed to resend verification email:', emailError);
                return res.status(500).json({ 
                    error: t(lang, 'backend.auth.sendVerificationError')
                });
            }

            return res.json({ message: genericMessage });
        } catch (error) {
            console.error('Resend verification email error:', error);
            return res.status(500).json({ 
                error: this.msg(req, 'sendVerificationGenericError')
            });
        }
    }

    // Resend password reset email with 90 second rate limiting
    async resendPasswordResetEmail(req, res) {
        try {
            const { email } = req.body || {};
            const lang = this.getLanguage(req);

            if (!email) {
                return res.status(400).json({ 
                    error: this.msg(req, 'emailRequired')
                });
            }

            const standardizedEmail = String(email).trim().toLowerCase();
            const user = await User.findOne({ email: standardizedEmail });

            const genericMessage = t(lang, 'backend.auth.sendResetLinkGeneric');

            if (!user) {
                return res.json({ message: genericMessage });
            }

            // Check rate limiting (90 seconds)
            const RATE_LIMIT_SECONDS = 90;
            if (user.lastPasswordResetEmailSent) {
                const timeSinceLastEmail = (Date.now() - user.lastPasswordResetEmailSent.getTime()) / 1000;
                if (timeSinceLastEmail < RATE_LIMIT_SECONDS) {
                    const remainingSeconds = Math.ceil(RATE_LIMIT_SECONDS - timeSinceLastEmail);
                    return res.status(429).json({
                        error: interpolate(t(lang, 'backend.auth.waitSecondsBeforeResend'), { seconds: remainingSeconds }),
                        remainingSeconds
                    });
                }
            }

            // Generate new password reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            user.passwordResetToken = hashedToken;
            user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
            user.lastPasswordResetEmailSent = new Date();
            await user.save();

            const resetUrl = `${this.getAppBaseUrl()}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

            try {
                await this.emailService.sendPasswordResetEmail({
                    to: user.email,
                    resetUrl,
                    fullName: user.fullName,
                    lang
                });
            } catch (emailError) {
                console.error('Failed to resend password reset email:', emailError);
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save();
                return res.status(500).json({ 
                    error: t(lang, 'backend.auth.sendResetError')
                });
            }

            return res.json({ message: genericMessage });
        } catch (error) {
            console.error('Resend password reset email error:', error);
            return res.status(500).json({ 
                error: this.msg(req, 'sendResetGenericError')
            });
        }
    }

    // Check token validity (for password reset or email verification)
    async checkTokenValidity(req, res) {
        try {
            const { token, type } = req.body || {};
            const lang = this.getLanguage(req);

            if (!token || !type) {
                return res.status(400).json({ valid: false, error: t(lang, 'backend.auth.tokenTypeRequired') });
            }

            const hashedToken = crypto
                .createHash('sha256')
                .update(String(token).trim())
                .digest('hex');

            let user;
            let tokenField;
            let expiresField;

            if (type === 'password-reset') {
                tokenField = 'passwordResetToken';
                expiresField = 'passwordResetExpires';
                user = await User.findOne({
                    passwordResetToken: hashedToken
                });
            } else if (type === 'email-verification') {
                tokenField = 'emailVerificationToken';
                expiresField = 'emailVerificationExpires';
                user = await User.findOne({
                    emailVerificationToken: hashedToken
                });
            } else {
                return res.status(400).json({ valid: false, error: t(lang, 'backend.auth.tokenTypeInvalid') });
            }

            if (!user) {
                return res.json({
                    valid: false,
                    expired: false,
                    error: t(lang, 'backend.auth.linkInvalid')
                });
            }

            const expirationDate = user[expiresField];
            if (!expirationDate || new Date() > expirationDate) {
                return res.json({
                    valid: false,
                    expired: true,
                    email: user.email,
                    error: t(lang, 'backend.auth.linkExpired')
                });
            }

            return res.json({ valid: true, email: user.email });
        } catch (error) {
            console.error('Check token validity error:', error);
            return res.status(500).json({ valid: false, error: this.msg(req, 'checkTokenError') });
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AuthRoutes;
