const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: String,
        index: true
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    plan: {
        type: String,
        enum: ['basic', 'premium'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'VND'
    },
    provider: {
        type: String,
        default: 'vnpay'
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'canceled'],
        default: 'pending'
    },
    txnRef: {
        type: String,
        unique: true,
        index: true
    },
    orderInfo: String,
    vnp_ResponseCode: String,
    vnp_TransactionNo: String,
    vnp_TmnCode: String,
    vnp_PayDate: String,
    vnp_BankCode: String,
    rawQuery: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    note: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
