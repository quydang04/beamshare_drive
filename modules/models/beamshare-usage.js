const mongoose = require('mongoose');

const beamshareUsageSchema = new mongoose.Schema({
    userId: {
        type: String,
        index: true
    },
    clientKey: {
        type: String,
        index: true
    },
    plan: {
        type: String,
        enum: ['guest', 'basic', 'premium'],
        required: true
    },
    windowStart: {
        type: Date,
        required: true
    },
    windowDurationMs: {
        type: Number,
        required: true
    },
    count: {
        type: Number,
        default: 0
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, {
    timestamps: true
});

beamshareUsageSchema.index({ userId: 1, plan: 1 });
beamshareUsageSchema.index({ clientKey: 1, plan: 1 });

module.exports = mongoose.model('BeamshareUsage', beamshareUsageSchema);
