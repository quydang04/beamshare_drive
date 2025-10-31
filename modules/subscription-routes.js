const express = require('express');
const { IpnUnknownError } = require('vnpay');
const { PLAN_DEFINITIONS, resolvePlan } = require('./constants/plans');
const PaymentService = require('./services/payment-service');
const { issueAuthCookie } = require('./middleware/auth-middleware');
const User = require('./models/user');

function formatBytes(bytes) {
    if (!bytes) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function resolveClientIp(req) {
    const forwarded = (req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || '')
        .split(',')
        .map((token) => token.trim())
        .find(Boolean);
    const raw = forwarded || req.ip || req.connection?.remoteAddress || '127.0.0.1';
    if (raw.startsWith('::ffff:')) {
        return raw.slice(7);
    }
    if (raw === '::1') {
        return '127.0.0.1';
    }
    return raw;
}

function buildPlanList() {
    return Object.values(PLAN_DEFINITIONS).map((plan) => {
        const fileSizeLimitBytes = Number(plan.beamshare?.fileSizeLimitBytes);
        const normalizedFileLimit = Number.isFinite(fileSizeLimitBytes) && fileSizeLimitBytes > 0
            ? fileSizeLimitBytes
            : null;

        return {
            id: plan.id,
            title: plan.title,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            currency: plan.currency || 'VND',
            storageLimitBytes: plan.storageLimitBytes,
            storageLabel: formatBytes(plan.storageLimitBytes),
            beamshare: {
                limitLabel: plan.beamshare.limitLabel,
                windowMs: Number(plan.beamshare.windowMs) || 0,
                maxTransfers: Number(plan.beamshare.maxTransfers) > 0 ? plan.beamshare.maxTransfers : null,
                fileSizeLimitBytes: normalizedFileLimit,
                fileSizeLimitLabel: normalizedFileLimit ? formatBytes(normalizedFileLimit) : 'Unlimited'
            }
        };
    });
}

function buildBeamshareSummary(planName) {
    const plan = resolvePlan(planName || 'basic');
    const beamshare = plan.beamshare || {};
    const rawFileLimit = Number(beamshare.fileSizeLimitBytes);
    const fileSizeLimitBytes = Number.isFinite(rawFileLimit) && rawFileLimit > 0 ? rawFileLimit : null;
    const rawWindowMs = Number(beamshare.windowMs);
    const rawMaxTransfers = Number(beamshare.maxTransfers);
    const hasTransferLimit = Number.isFinite(rawMaxTransfers) && rawMaxTransfers > 0;
    const normalizedWindowMs = Number.isFinite(rawWindowMs) && rawWindowMs > 0 ? rawWindowMs : 0;
    const limitLabel = beamshare.limitLabel || '';

    return {
        plan: plan.id,
        limit: hasTransferLimit
            ? {
                windowMs: normalizedWindowMs,
                maxTransfers: rawMaxTransfers,
                label: limitLabel,
                limitLabel
            }
            : null,
        count: 0,
        remaining: hasTransferLimit ? rawMaxTransfers : null,
        resetAt: null,
        fileSizeLimitBytes,
        fileSizeLimitLabel: beamshare.limitLabel || null
    };
}

class SubscriptionRoutes {
    constructor({ fileMetadata, authMiddleware, paymentService } = {}) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.auth = authMiddleware;
        this.paymentService = paymentService || new PaymentService();
        this.setupRoutes();
    }

    setupRoutes() {
    this.router.get('/overview', this.auth.requireAuth, this.getOverview.bind(this));
        this.router.post('/plan', this.auth.requireAuth, this.switchPlan.bind(this));
        this.router.post('/payments/vnpay', this.auth.requireAuth, this.createVNPayPayment.bind(this));
        this.router.get('/payments/vnpay/return', this.handleReturn.bind(this));
        this.router.get('/payments/vnpay/ipn', this.handleIpn.bind(this));
        this.router.post('/payments/vnpay/ipn', this.handleIpn.bind(this));
    }

    async getOverview(req, res) {
        try {
            const plans = buildPlanList();
            const user = await User.findById(req.user.id).lean();
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            const plan = resolvePlan(user.plan || 'basic');
            const storageLimitBytes = plan.storageLimitBytes;
            const totalUsageBytes = await this.fileMetadata.getTotalUsageBytes(user.userId);
            const usagePercent = storageLimitBytes
                ? Math.min(100, (totalUsageBytes / storageLimitBytes) * 100)
                : 0;

            const beamshareSummary = buildBeamshareSummary(user.plan || 'basic');

            return res.json({
                authenticated: true,
                plans,
                currentPlan: user.plan || 'basic',
                storage: {
                    totalBytes: totalUsageBytes,
                    formattedTotal: formatBytes(totalUsageBytes),
                    limitBytes: storageLimitBytes,
                    formattedLimit: formatBytes(storageLimitBytes),
                    percent: Number.isFinite(usagePercent) ? Math.round(usagePercent) : 0
                },
                beamshare: beamshareSummary
            });
        } catch (error) {
            console.error('Subscription overview error:', error);
            res.status(500).json({ error: 'Không thể tải thông tin gói.' });
        }
    }

    async createVNPayPayment(req, res) {
        try {
            const planId = (req.body?.plan || 'premium').toLowerCase();
            if (planId !== 'premium') {
                return res.status(400).json({ error: 'Chỉ hỗ trợ thanh toán cho gói Premium.' });
            }

            if (req.user.plan === 'premium') {
                return res.status(400).json({ error: 'Bạn đang ở gói Premium.' });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            const clientIp = resolveClientIp(req);
            const { paymentUrl } = await this.paymentService.createPaymentUrl({
                user,
                planId,
                clientIp,
                returnPath: '/api/subscriptions/payments/vnpay/return'
            });

            return res.status(201).json({ paymentUrl });
        } catch (error) {
            console.error('Create VNPay payment error:', error);
            res.status(500).json({ error: error.message || 'Không thể tạo thanh toán VNPay.' });
        }
    }

    async handleReturn(req, res) {
        try {
            const { verify, payment } = await this.paymentService.handleReturn(req.query || {});
            let status = 'failed';
            let message = verify?.message || 'Thanh toán không thành công.';

            if (verify?.isVerified && verify?.isSuccess) {
                status = 'success';
                message = verify?.message || 'Thanh toán thành công.';
            }

            if (payment?.userId) {
                const user = await User.findOne({ userId: payment.userId });
                if (user) {
                    issueAuthCookie(res, user);
                }
            }

            const params = new URLSearchParams();
            params.set('paymentStatus', status);
            params.set('message', message);
            if (payment?.plan) {
                params.set('plan', payment.plan);
            }

            const appBaseUrl = this.paymentService.buildReturnUrl('').replace(/\/$/, '');
            if (status === 'success') {
                const thankYouUrl = `${appBaseUrl}/thank-you?${params.toString()}`;
                return res.redirect(302, thankYouUrl);
            }

            const fallbackUrl = `${appBaseUrl}/?${params.toString()}`;
            return res.redirect(302, fallbackUrl);
        } catch (error) {
            console.error('VNPay return error:', error);
            return res.redirect(302, `/?paymentStatus=failed&message=${encodeURIComponent('Không thể xác thực thanh toán.')}`);
        }
    }

    async handleIpn(req, res) {
        try {
            const { response } = await this.paymentService.handleIpn(req.query || req.body || {});
            return res.json(response);
        } catch (error) {
            console.error('VNPay IPN error:', error);
            return res.json(IpnUnknownError);
        }
    }

    async switchPlan(req, res) {
        try {
            const requestedPlan = String(req.body?.plan || '').trim().toLowerCase();

            if (!requestedPlan) {
                return res.status(400).json({ error: 'Thiếu thông tin gói cần chuyển.' });
            }

            if (!PLAN_DEFINITIONS[requestedPlan]) {
                return res.status(400).json({ error: 'Gói không hợp lệ.' });
            }

            if (requestedPlan !== 'basic') {
                return res.status(400).json({ error: 'Chỉ hỗ trợ chuyển về gói Basic.' });
            }

            if (req.user.plan === 'basic') {
                return res.json({ message: 'Bạn đang ở gói Basic.', plan: 'basic' });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            user.plan = 'basic';
            await user.save();
            req.user.plan = 'basic';
            issueAuthCookie(res, user);

            return res.json({ message: 'Đã chuyển về gói Basic.', plan: user.plan });
        } catch (error) {
            console.error('Switch plan error:', error);
            return res.status(500).json({ error: 'Không thể chuyển gói lúc này.' });
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = SubscriptionRoutes;
