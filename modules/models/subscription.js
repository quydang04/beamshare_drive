const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    plan: {
        type: String,
        enum: ['basic', 'premium'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'canceled'],
        default: 'active'
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    currentPeriodEnd: Date,
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, {
    timestamps: true
});

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, plan: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
