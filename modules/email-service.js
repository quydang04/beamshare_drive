const { Resend } = require('resend');

class EmailService {
    constructor() {
        this.resendClient = null;
        this.apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || '';
        this.fromAddress = process.env.RESEND_FROM_EMAIL || 'BeamShare Drive <beamshare@mail.quydang.name.vn>';
        this.enabled = Boolean(this.apiKey);
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
}

module.exports = EmailService;
