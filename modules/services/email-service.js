const { Resend } = require('resend');
const { t, interpolate } = require('../translate/i18n');

class EmailService {
    constructor() {
        this.resendClient = null;
        this.apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || '';
        this.fromAddress = process.env.RESEND_FROM_EMAIL || 'BeamShare Drive <beamshare@mail.quydang.name.vn>';
        this.enabled = Boolean(this.apiKey);
    }

    formatCurrency(amount, currency = 'VND', lang = 'vi') {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            return `${amount || 0} ${currency}`;
        }

        try {
            const locale = lang === 'en' ? 'en-US' : 'vi-VN';
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

    formatDate(date, lang = 'vi') {
        if (!date) {
            return t(lang, 'backend.email.notSpecified');
        }

        try {
            const locale = lang === 'en' ? 'en-US' : 'vi-VN';
            return new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                hour12: lang === 'en'
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

    // Helper to get greeting with name
    getGreeting(name, lang = 'vi') {
        if (name) {
            return interpolate(t(lang, 'backend.email.greeting'), { name });
        }
        return t(lang, 'backend.email.greetingDefault');
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
        email,
        lang = 'vi'
    }) {
        const safeName = fullName || email;
        const subject = success 
            ? t(lang, 'backend.email.payment.successSubject')
            : t(lang, 'backend.email.payment.failedSubject');
        const statusLabel = success 
            ? t(lang, 'backend.email.payment.statusSuccess')
            : t(lang, 'backend.email.payment.statusFailed');
        const statusColor = success ? '#16a34a' : '#dc2626';
        const formattedAmount = this.formatCurrency(amount, currency, lang);
        const processedLabel = this.formatDate(processedAt, lang);
        const failureNote = failureReason ? String(failureReason).trim() : '';

        const greeting = this.getGreeting(safeName, lang);
        const regards = t(lang, 'backend.email.regards');
        const supportNote = t(lang, 'backend.email.supportNote');
        const notAvailable = t(lang, 'backend.email.notAvailable');
        
        const yourPayment = t(lang, 'backend.email.payment.yourPayment');
        const paymentInfo = t(lang, 'backend.email.payment.paymentInfo');
        const planLabel = t(lang, 'backend.email.payment.plan');
        const amountLabel = t(lang, 'backend.email.payment.amount');
        const processedAtLabel = t(lang, 'backend.email.payment.processedAt');
        const transactionIdLabel = t(lang, 'backend.email.payment.transactionId');
        const referenceLabel = t(lang, 'backend.email.payment.reference');
        const reasonLabel = t(lang, 'backend.email.payment.reason');

        const messageBody = success
            ? interpolate(t(lang, 'backend.email.payment.thankYouUpgrade'), { planTitle })
            : interpolate(t(lang, 'backend.email.payment.sorryFailed'), { planTitle });

        const messageBodyText = success
            ? interpolate(t(lang, 'backend.email.payment.thankYouUpgradeText'), { planTitle })
            : interpolate(t(lang, 'backend.email.payment.sorryFailedText'), { planTitle });

        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>${greeting},</p>
    <p style="color: ${statusColor}; font-weight: 600;">${yourPayment} ${statusLabel}.</p>
    <p>${messageBody}</p>
    <div style="margin: 16px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">${paymentInfo}</p>
        <p style="margin: 4px 0;">${planLabel}: <strong>${planTitle}</strong></p>
        <p style="margin: 4px 0;">${amountLabel}: <strong>${formattedAmount}</strong></p>
        <p style="margin: 4px 0;">${processedAtLabel}: <strong>${processedLabel}</strong></p>
        <p style="margin: 4px 0;">${transactionIdLabel}: <strong>${transactionId || notAvailable}</strong></p>
        <p style="margin: 4px 0;">${referenceLabel}: <strong>${reference || notAvailable}</strong></p>
    </div>
    ${failureNote ? `<p><strong>${reasonLabel}:</strong> ${failureNote}</p>` : ''}
    <p>${supportNote}</p>
    <p>${regards.replace(/\n/g, '<br>')}</p>
</div>
        `;

        const textSections = [
            `${greeting},`,
            `${yourPayment} ${statusLabel}.`,
            messageBodyText,
            `${paymentInfo}:`,
            `- ${planLabel}: ${planTitle}`,
            `- ${amountLabel}: ${formattedAmount}`,
            `- ${processedAtLabel}: ${processedLabel}`,
            `- ${transactionIdLabel}: ${transactionId || notAvailable}`,
            `- ${referenceLabel}: ${reference || notAvailable}`
        ];

        if (failureNote) {
            textSections.push(`${reasonLabel}: ${failureNote}`);
        }

        textSections.push(supportNote, regards);

        const text = textSections.join('\n\n');

        return { subject, html, text };
    }

    buildPasswordResetContent({ resetUrl, fullName, email, lang = 'vi' }) {
        const safeName = fullName || email;
        const subject = t(lang, 'backend.email.passwordReset.subject');
        const greeting = this.getGreeting(safeName, lang);
        const regards = t(lang, 'backend.email.regards');
        
        const received = t(lang, 'backend.email.passwordReset.received');
        const clickButton = t(lang, 'backend.email.passwordReset.clickButton');
        const buttonText = t(lang, 'backend.email.passwordReset.buttonText');
        const cantClick = t(lang, 'backend.email.passwordReset.cantClick');
        const expiry = t(lang, 'backend.email.passwordReset.expiry');
        
        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>${greeting},</p>
    <p>${received}</p>
    <p>${clickButton}</p>
    <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
            ${buttonText}
        </a>
    </p>
    <p>${cantClick}</p>
    <p style="word-break: break-all;">${resetUrl}</p>
    <p>${expiry}</p>
    <p>${regards.replace(/\n/g, '<br>')}</p>
</div>
        `;

        const text = [
            `${greeting},`,
            received,
            clickButton,
            resetUrl,
            expiry,
            regards
        ].join('\n\n');

        return { subject, html, text };
    }

    buildEmailVerificationContent({ verifyUrl, fullName, email, lang = 'vi' }) {
        const safeName = fullName || email;
        const subject = t(lang, 'backend.email.emailVerification.subject');
        const greeting = this.getGreeting(safeName, lang);
        const regards = t(lang, 'backend.email.regards');

        const thankYou = t(lang, 'backend.email.emailVerification.thankYou');
        const buttonText = t(lang, 'backend.email.emailVerification.buttonText');
        const cantClick = t(lang, 'backend.email.emailVerification.cantClick');
        const expiry = t(lang, 'backend.email.emailVerification.expiry');
        
        const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
    <p>${greeting},</p>
    <p>${thankYou}</p>
    <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background: #6366f1; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
            ${buttonText}
        </a>
    </p>
    <p>${cantClick}</p>
    <p style="word-break: break-all;">${verifyUrl}</p>
    <p>${expiry}</p>
    <p>${regards.replace(/\n/g, '<br>')}</p>
</div>
        `;

        const text = [
            `${greeting},`,
            thankYou,
            verifyUrl,
            expiry,
            regards
        ].join('\n\n');

        return { subject, html, text };
    }

    async sendPasswordResetEmail({ to, resetUrl, fullName, lang = 'vi' }) {
        if (!to || !resetUrl) {
            throw new Error('Missing "to" or "resetUrl" when sending password reset email.');
        }

        const client = this.getClient();
        const normalizedRecipient = Array.isArray(to) ? to : [to];
        const { subject, html, text } = this.buildPasswordResetContent({ resetUrl, fullName, email: normalizedRecipient[0], lang });

        await client.emails.send({
            from: this.fromAddress,
            to: normalizedRecipient,
            subject,
            html,
            text
        });
    }

    async sendEmailVerificationEmail({ to, verifyUrl, fullName, lang = 'vi' }) {
        if (!to || !verifyUrl) {
            throw new Error('Missing "to" or "verifyUrl" when sending email verification.');
        }

        const client = this.getClient();
        const normalizedRecipient = Array.isArray(to) ? to : [to];
        const primaryEmail = normalizedRecipient[0];
        const { subject, html, text } = this.buildEmailVerificationContent({
            verifyUrl,
            fullName,
            email: primaryEmail,
            lang
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
        fullName,
        lang = 'vi'
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
            email: primaryEmail,
            lang
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
