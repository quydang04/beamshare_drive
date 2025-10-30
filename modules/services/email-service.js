const { Resend } = require('resend');

class EmailService {
    constructor() {
        this.resendClient = null;
        this.apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || '';
        this.fromAddress = process.env.RESEND_FROM_EMAIL || 'BeamShare Drive <beamshare@mail.quydang.name.vn>';
        this.enabled = Boolean(this.apiKey);
    }

    formatCurrency(amount, currency = 'VND') {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            return `${amount || 0} ${currency}`;
        }

        try {
            const locale = currency === 'VND' ? 'vi-VN' : 'en-US';
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                maximumFractionDigits: currency === 'VND' ? 0 : 2
            }).format(amount);
        } catch (error) {
            console.warn('Currency formatting fallback triggered:', error?.message || error);
            const formatted = amount.toLocaleString('vi-VN');
            return `${formatted} ${currency}`.trim();
        }
    }

    formatDate(date) {
        if (!date) {
            return 'Chưa xác định';
        }

        try {
            return new Intl.DateTimeFormat('vi-VN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                hour12: false
            }).format(date);
        } catch (error) {
            console.warn('Date formatting fallback triggered:', error?.message || error);
            if (date instanceof Date && !Number.isNaN(date.getTime())) {
                return date.toISOString();
            }
            return String(date);
        }
    }

    getClient() {
        if (!this.enabled) {
            throw new Error('Resend API key is not configured.');
        }
        if (!this.resendClient) {
            this.resendClient = new Resend(this.apiKey);
        }
        return this.resendClient;
    }

    buildPaymentResultContent({
        success,
        planTitle,
        amount,
        currency,
        processedAt,
        transactionId,
        reference,
        failureReason,
        fullName,
        email
    }) {
        const safeName = fullName || email;
        const statusLabel = success ? 'thành công' : 'không thành công';
        const statusColor = success ? '#16a34a' : '#dc2626';
        const subject = `BeamShare Drive - Thanh toán ${statusLabel}`;
        const formattedAmount = this.formatCurrency(amount, currency);
        const processedLabel = this.formatDate(processedAt);
        const failureNote = failureReason ? String(failureReason).trim() : '';

        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>Xin chào ${safeName || 'bạn'},</p>
    <p style="color: ${statusColor}; font-weight: 600;">Thanh toán của bạn ${statusLabel}.</p>
    <p>${success
            ? `Cảm ơn bạn đã nâng cấp gói <strong>${planTitle}</strong>. Tài khoản của bạn đã được cập nhật quyền lợi tương ứng.`
            : `Rất tiếc, thanh toán cho gói <strong>${planTitle}</strong> chưa thể hoàn tất.`}</p>
    <div style="margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">Thông tin thanh toán</p>
        <p style="margin: 4px 0;">Gói: <strong>${planTitle}</strong></p>
        <p style="margin: 4px 0;">Số tiền: <strong>${formattedAmount}</strong></p>
        <p style="margin: 4px 0;">Thời gian xử lý: <strong>${processedLabel}</strong></p>
        <p style="margin: 4px 0;">Mã giao dịch ngân hàng: <strong>${transactionId || 'Không có'}</strong></p>
        <p style="margin: 4px 0;">Mã tham chiếu BeamShare: <strong>${reference || 'Không có'}</strong></p>
    </div>
    ${failureNote ? `<p><strong>Lý do:</strong> ${failureNote}</p>` : ''}
    <p>Nếu bạn cần hỗ trợ, vui lòng phản hồi email này hoặc liên hệ đội ngũ BeamShare Drive.</p>
    <p>Trân trọng.</p>
</div>
        `;

        const textSections = [
            `Xin chào ${safeName || 'bạn'},`,
            `Thanh toán của bạn ${statusLabel}.`,
            success
                ? `Cảm ơn bạn đã nâng cấp gói ${planTitle}. Tài khoản đã được cập nhật.`
                : `Rất tiếc, thanh toán cho gói ${planTitle} chưa thể hoàn tất.`,
            'Thông tin thanh toán:',
            `- Gói: ${planTitle}`,
            `- Số tiền: ${formattedAmount}`,
            `- Thời gian xử lý: ${processedLabel}`,
            `- Mã giao dịch ngân hàng: ${transactionId || 'Không có'}`,
            `- Mã tham chiếu BeamShare: ${reference || 'Không có'}`
        ];

        if (failureNote) {
            textSections.push(`Lý do: ${failureNote}`);
        }

        textSections.push('Nếu bạn cần hỗ trợ, hãy phản hồi email này hoặc liên hệ đội ngũ BeamShare Drive.', 'Trân trọng.');

        const text = textSections.join('\n\n');

        return { subject, html, text };
    }

    buildPasswordResetContent({ resetUrl, fullName, email }) {
        const safeName = fullName || email;
        const subject = 'BeamShare Drive - Đặt lại mật khẩu';
        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>Xin chào ${safeName || 'bạn'},</p>
    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản BeamShare Drive của bạn.</p>
    <p>Để tạo mật khẩu mới, vui lòng nhấp vào nút bên dưới:</p>
    <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Đặt lại mật khẩu
        </a>
    </p>
    <p>Nếu bạn không thể nhấp vào nút, hãy sao chép và dán liên kết sau vào trình duyệt của bạn:</p>
    <p style="word-break: break-all;">${resetUrl}</p>
    <p>Liên kết này sẽ hết hạn sau 60 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua email này.</p>
    <p>Trân trọng.</p>
</div>
        `;

        const text = [
            `Xin chào ${safeName || 'bạn'},`,
            'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản BeamShare Drive của bạn.',
            'Để tạo mật khẩu mới, vui lòng truy cập liên kết sau:',
            resetUrl,
            'Liên kết này sẽ hết hạn sau 60 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua email này.',
            'Trân trọng.'
        ].join('\n\n');

        return { subject, html, text };
    }

    buildEmailVerificationContent({ verifyUrl, fullName, email }) {
        const safeName = fullName || email;
        const subject = 'BeamShare Drive - Xác thực email đăng ký';
        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>Xin chào ${safeName || 'bạn'},</p>
    <p>Cảm ơn bạn đã đăng ký BeamShare Drive. Để hoàn tất việc tạo tài khoản, vui lòng xác thực email của bạn.</p>
    <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background: #6366f1; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Xác thực email
        </a>
    </p>
    <p>Nếu bạn không thể nhấp vào nút, hãy sao chép và dán liên kết sau vào trình duyệt của bạn:</p>
    <p style="word-break: break-all;">${verifyUrl}</p>
    <p>Liên kết xác thực sẽ hết hạn sau 24 giờ. Nếu bạn không tạo tài khoản BeamShare Drive, vui lòng bỏ qua email này.</p>
    <p>Trân trọng.</p>
</div>
        `;

        const text = [
            `Xin chào ${safeName || 'bạn'},`,
            'Cảm ơn bạn đã đăng ký BeamShare Drive. Vui lòng xác thực email của bạn bằng cách truy cập liên kết sau:',
            verifyUrl,
            'Liên kết xác thực sẽ hết hạn sau 24 giờ. Nếu bạn không tạo tài khoản BeamShare Drive, vui lòng bỏ qua email này.',
            'Trân trọng.'
        ].join('\n\n');

        return { subject, html, text };
    }

    async sendPasswordResetEmail({ to, resetUrl, fullName }) {
        if (!to || !resetUrl) {
            throw new Error('Missing "to" or "resetUrl" when sending password reset email.');
        }

        const client = this.getClient();
        const normalizedRecipient = Array.isArray(to) ? to : [to];
        const { subject, html, text } = this.buildPasswordResetContent({ resetUrl, fullName, email: normalizedRecipient[0] });

        await client.emails.send({
            from: this.fromAddress,
            to: normalizedRecipient,
            subject,
            html,
            text
        });
    }

    async sendEmailVerificationEmail({ to, verifyUrl, fullName }) {
        if (!to || !verifyUrl) {
            throw new Error('Missing "to" or "verifyUrl" when sending email verification.');
        }

        const client = this.getClient();
        const normalizedRecipient = Array.isArray(to) ? to : [to];
        const primaryEmail = normalizedRecipient[0];
        const { subject, html, text } = this.buildEmailVerificationContent({
            verifyUrl,
            fullName,
            email: primaryEmail
        });

        await client.emails.send({
            from: this.fromAddress,
            to: normalizedRecipient,
            subject,
            html,
            text
        });
    }

    async sendPaymentResultEmail({
        to,
        success,
        planTitle,
        amount,
        currency,
        processedAt,
        transactionId,
        reference,
        failureReason,
        fullName
    }) {
        if (!to) {
            throw new Error('Missing "to" when sending payment result email.');
        }

        const client = this.getClient();
        const normalizedRecipient = Array.isArray(to) ? to : [to];
        const primaryEmail = normalizedRecipient[0];
        const { subject, html, text } = this.buildPaymentResultContent({
            success,
            planTitle,
            amount,
            currency,
            processedAt,
            transactionId,
            reference,
            failureReason,
            fullName,
            email: primaryEmail
        });

        await client.emails.send({
            from: this.fromAddress,
            to: normalizedRecipient,
            subject,
            html,
            text
        });
    }
}

module.exports = EmailService;
