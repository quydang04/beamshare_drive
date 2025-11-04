const { VNPay, ProductCode, VnpLocale, IpnFailChecksum, IpnSuccess, IpnUnknownError } = require('vnpay');
const Payment = require('../models/payment');
const Subscription = require('../models/subscription');
const User = require('../models/user');
const EmailService = require('./email-service');
const { resolvePlan } = require('../constants/plans');

function sanitizeEnvValue(value) {
    if (!value) {
        return '';
    }

    let normalized = String(value).trim();
    if (!normalized) {
        return '';
    }

    // Remove trailing commas often left in copied snippets (e.g. value',)
    normalized = normalized.replace(/,+$/, '');

    // Strip wrapping quotes once commas are handled
    normalized = normalized.replace(/^['"]/, '').replace(/['"]$/, '');

    return normalized.trim();
}

function resolveEnv(keys, fallback = '') {
    for (const key of keys) {
        const value = sanitizeEnvValue(process.env[key]);
        if (value) {
            return value;
        }
    }
    return fallback;
}

function getBaseUrl() {
    const configured = resolveEnv(['APP_URL', 'APP_BASE_URL', 'FRONTEND_URL', 'PUBLIC_APP_URL']);
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    const port = process.env.PORT || 8080;
    return `http://localhost:${port}`;
}

function normalizeIp(reqIp, fallback = '127.0.0.1') {
    if (!reqIp) {
        return fallback;
    }
    if (reqIp.startsWith('::ffff:')) {
        return reqIp.substring(7);
    }
    if (reqIp === '::1') {
        return '127.0.0.1';
    }
    return reqIp;
}

function formatVNPayDate(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

class PaymentService {
    constructor({ emailService } = {}) {
        const vnpayHost = resolveEnv(['VNPAY_HOST', 'VNPAY_URL', 'VNPAY_BASE_URL', 'vnpayHost'], 'https://sandbox.vnpayment.vn');
        const tmnCode = resolveEnv(['VNPAY_TMN_CODE', 'VNPAY_TMN', 'TMN_CODE', 'tmnCode']);
        const secureSecret = resolveEnv(['VNPAY_HASH_SECRET', 'VNPAY_SECRET', 'SECURE_SECRET', 'secureSecret']);

        if (!tmnCode || !secureSecret) {
            throw new Error('Thiếu cấu hình VNPay (TMN code hoặc secure secret)');
        }

        this.vnpay = new VNPay({
            vnpayHost,
            tmnCode,
            secureSecret,
            testMode: resolveEnv(['VNPAY_TEST_MODE']) !== 'false'
        });
        this.emailService = emailService || new EmailService();
    }

    buildReturnUrl(pathname = '/api/subscriptions/payments/vnpay/return') {
        const base = getBaseUrl();
        return `${base}${pathname}`;
    }

    buildIpnUrl(pathname = '/api/subscriptions/payments/vnpay/ipn') {
        const base = getBaseUrl();
        return `${base}${pathname}`;
    }

    async createPaymentUrl({ user, planId = 'premium', clientIp, returnPath }) {
        const plan = resolvePlan(planId);
        const amount = plan.monthlyPrice;
        if (!amount) {
            throw new Error('Gói cước này không yêu cầu thanh toán.');
        }

        const currency = plan.currency || 'VND';
        const orderInfo = `BeamShare ${plan.title} - ${user.email}`;

        const payment = await Payment.create({
            userId: user.userId,
            plan: plan.id,
            amount,
            currency,
            status: 'pending',
            orderInfo
        });

        const txnRef = `${payment._id.toString().slice(-8)}${Date.now()}`;
        const now = new Date();
        const locale = (resolveEnv(['VNPAY_LOCALE']) || 'vn').toLowerCase() === 'en' ? VnpLocale.EN : VnpLocale.VN;

        const returnUrl = returnPath ? `${getBaseUrl()}${returnPath}` : this.buildReturnUrl();

        const url = this.vnpay.buildPaymentUrl({
            vnp_TxnRef: txnRef,
            vnp_Amount: amount,
            vnp_OrderInfo: orderInfo,
            vnp_IpAddr: normalizeIp(clientIp),
            vnp_ReturnUrl: returnUrl,
            vnp_CreateDate: formatVNPayDate(now),
            vnp_Locale: locale,
            vnp_OrderType: ProductCode.Other
        });

        payment.txnRef = txnRef;
        payment.vnp_TmnCode = this.vnpay.defaultConfig.tmnCode;
        await payment.save();

        return {
            paymentUrl: url,
            payment
        };
    }

    async markPaymentSuccess(payment, verifyResult) {
        const alreadyPaid = payment.status === 'paid';
        payment.status = 'paid';
        payment.vnp_ResponseCode = verifyResult.vnp_ResponseCode;
        payment.vnp_TransactionNo = verifyResult.vnp_TransactionNo;
        payment.vnp_PayDate = verifyResult.vnp_PayDate;
        payment.vnp_BankCode = verifyResult.vnp_BankCode;
        payment.rawQuery = verifyResult;
        await payment.save();

        if (alreadyPaid) {
            return;
        }

        await Subscription.findOneAndUpdate(
            { userId: payment.userId },
            {
                plan: payment.plan,
                status: 'active',
                startedAt: new Date(),
                currentPeriodEnd: null
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const user = await User.findOneAndUpdate(
            { userId: payment.userId },
            { plan: payment.plan },
            { new: true }
        );

        await this.notifyPaymentResult({ payment, verifyResult, user, success: true });
    }

    async markPaymentFailed(payment, verifyResult) {
        const alreadyFailed = payment.status === 'failed';
        payment.status = 'failed';
        payment.vnp_ResponseCode = verifyResult?.vnp_ResponseCode;
        payment.rawQuery = verifyResult;
        await payment.save();

        if (alreadyFailed) {
            return;
        }

        const user = await User.findOne({ userId: payment.userId });
        await this.notifyPaymentResult({ payment, verifyResult, user, success: false });
    }

    async handleReturn(query) {
        const verify = this.vnpay.verifyReturnUrl(query, {
            logger: { loggerFn: () => {} }
        });

        const txnRef = verify?.vnp_TxnRef;
        if (!txnRef) {
            return {
                verify,
                payment: null
            };
        }

        const payment = await Payment.findOne({ txnRef });
        if (!payment) {
            return { verify, payment: null };
        }

        if (!verify.isVerified) {
            await this.markPaymentFailed(payment, verify);
            return { verify, payment };
        }

        if (verify.isSuccess) {
            await this.markPaymentSuccess(payment, verify);
        } else {
            await this.markPaymentFailed(payment, verify);
        }

        return { verify, payment };
    }

    async handleIpn(query) {
        const verify = this.vnpay.verifyIpnCall(query, {
            logger: { loggerFn: () => {} }
        });

        if (!verify.isVerified) {
            return { response: IpnFailChecksum, verify, payment: null };
        }

        const payment = await Payment.findOne({ txnRef: verify.vnp_TxnRef });
        if (!payment) {
            return { response: IpnUnknownError, verify, payment: null };
        }

        if (verify.isSuccess) {
            await this.markPaymentSuccess(payment, verify);
            return { response: IpnSuccess, verify, payment };
        }

        await this.markPaymentFailed(payment, verify);
        return { response: IpnUnknownError, verify, payment };
    }

    parseVNPayDate(value) {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        const stringValue = String(value).trim();
        if (/^\d{14}$/.test(stringValue)) {
            const year = Number(stringValue.slice(0, 4));
            const month = Number(stringValue.slice(4, 6)) - 1;
            const day = Number(stringValue.slice(6, 8));
            const hours = Number(stringValue.slice(8, 10));
            const minutes = Number(stringValue.slice(10, 12));
            const seconds = Number(stringValue.slice(12, 14));
            const date = new Date(year, month, day, hours, minutes, seconds);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        const parsed = new Date(stringValue);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    resolveFailureMessage(verifyResult) {
        if (!verifyResult) {
            return 'Giao dịch chưa thể hoàn tất. Vui lòng thử lại sau.';
        }

        if (verifyResult.message) {
            return verifyResult.message;
        }

        if (verifyResult.isVerified === false) {
            return 'Không thể xác thực giao dịch. Vui lòng thử lại sau.';
        }

        if (verifyResult.vnp_ResponseCode) {
            return `Giao dịch được trả về với mã ${verifyResult.vnp_ResponseCode}. Vui lòng thử lại hoặc liên hệ ngân hàng phát hành.`;
        }

        return 'Giao dịch chưa thể hoàn tất. Vui lòng thử lại sau.';
    }

    async notifyPaymentResult({ payment, verifyResult, user, success }) {
        if (!this.emailService || !this.emailService.enabled) {
            return;
        }

        try {
            const targetUser = user || (await User.findOne({ userId: payment.userId }));
            if (!targetUser || !targetUser.email) {
                return;
            }

            const plan = resolvePlan(payment.plan);
            const processedAt = this.parseVNPayDate(verifyResult?.vnp_PayDate) || payment.updatedAt || new Date();
            const failureReason = success ? null : this.resolveFailureMessage(verifyResult);

            await this.emailService.sendPaymentResultEmail({
                to: targetUser.email,
                success,
                planTitle: plan.title,
                amount: payment.amount,
                currency: payment.currency || plan.currency || 'VND',
                processedAt,
                transactionId: verifyResult?.vnp_TransactionNo || null,
                reference: payment.txnRef,
                failureReason,
                fullName: targetUser.fullName
            });
        } catch (error) {
            console.error('Payment notification email error:', error);
        }
    }
}

module.exports = PaymentService;
