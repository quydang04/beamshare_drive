const express = require('express');
const { IpnUnknownError } = require('vnpay');
const { PLAN_DEFINITIONS, resolvePlan, BEAMSHARE_GUEST_LIMIT } = require('./constants/plans');
const PaymentService = require('./services/payment-service');
const BeamshareUsageService = require('./services/beamshare-usage-service');
const { issueAuthCookie } = require('./middleware/auth');
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
    return Object.values(PLAN_DEFINITIONS).map((plan) => ({
        id: plan.id,
        title: plan.title,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        currency: plan.currency || 'VND',
        storageLimitBytes: plan.storageLimitBytes,
        storageLabel: formatBytes(plan.storageLimitBytes),
        beamshare: {
            limitLabel: plan.beamshare.limitLabel,
            windowMs: plan.beamshare.windowMs,
            maxTransfers: plan.beamshare.maxTransfers
        }
    }));
}

class SubscriptionRoutes {
    constructor({ fileMetadata, authMiddleware, paymentService, usageService } = {}) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.auth = authMiddleware;
        this.paymentService = paymentService || new PaymentService();
        this.usageService = usageService || new BeamshareUsageService();
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.get('/overview', this.auth.optionalAuth, this.getOverview.bind(this));
        this.router.post('/payments/vnpay', this.auth.requireAuth, this.createVNPayPayment.bind(this));
        this.router.get('/payments/vnpay/return', this.handleReturn.bind(this));
        this.router.get('/payments/vnpay/ipn', this.handleIpn.bind(this));
        this.router.post('/payments/vnpay/ipn', this.handleIpn.bind(this));
    }

    async getOverview(req, res) {
        try {
            const plans = buildPlanList();
            const guestBeamshare = {
                limitLabel: BEAMSHARE_GUEST_LIMIT.limitLabel || '5 lượt gửi mỗi 5 giờ',
                windowMs: BEAMSHARE_GUEST_LIMIT.windowMs,
                maxTransfers: BEAMSHARE_GUEST_LIMIT.maxTransfers
            };

            if (!req.user) {
                return res.json({
                    authenticated: false,
                    plans,
                    currentPlan: 'guest',
                    storage: null,
                    beamshare: await this.usageService.getUsageSummary({
                        plan: 'guest',
                        clientKey: resolveClientIp(req)
                    }),
                    guestBeamshare
                });
            }

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

            const beamshareSummary = await this.usageService.getUsageSummary({
                plan: user.plan || 'basic',
                userId: user.userId
            });

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
                beamshare: beamshareSummary,
                guestBeamshare
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

            const appBaseUrl = this.paymentService.buildReturnUrl('').replace(/\/$/, '');
            const redirectUrl = `${appBaseUrl}/?${params.toString()}`;
            return res.redirect(302, redirectUrl);
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

    getRouter() {
        return this.router;
    }
}

module.exports = SubscriptionRoutes;
