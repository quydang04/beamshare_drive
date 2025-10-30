const crypto = require('crypto');
const BeamshareUsage = require('../models/beamshare-usage');
const { PLAN_DEFINITIONS, BEAMSHARE_GUEST_LIMIT } = require('../constants/plans');

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function cloneLimit(limit, fallback) {
    if (!limit) {
        return fallback || null;
    }
    return {
        windowMs: limit.windowMs || 0,
        maxTransfers: limit.maxTransfers || 0,
        label: limit.limitLabel || limit.label || '',
        limitLabel: limit.limitLabel || limit.label || ''
    };
}

class BeamshareUsageService {
    constructor(model = BeamshareUsage) {
        this.Model = model;
    }

    normalizePlan(plan) {
        const normalized = String(plan || 'guest').toLowerCase();
        if (normalized === 'premium') return 'premium';
        if (normalized === 'basic') return 'basic';
        return 'guest';
    }

    getLimitForPlan(plan) {
        const normalized = this.normalizePlan(plan);
        if (normalized === 'premium') {
            return null; // Unlimited
        }
        if (normalized === 'basic') {
            return cloneLimit(PLAN_DEFINITIONS.basic.beamshare);
        }
        return cloneLimit(BEAMSHARE_GUEST_LIMIT, {
            windowMs: 5 * 60 * 60 * 1000,
            maxTransfers: 5,
            limitLabel: '5 lượt gửi mỗi 5 giờ'
        });
    }

    buildQuery(plan, { userId, clientKey }) {
        const normalized = this.normalizePlan(plan);
        if (normalized === 'guest') {
            if (!clientKey) {
                return null;
            }
            return { plan: 'guest', clientKey: hashValue(clientKey) };
        }
        if (!userId) {
            return null;
        }
        return { plan: normalized, userId };
    }

    async getUsageSummary({ plan, userId, clientKey }) {
        const normalized = this.normalizePlan(plan);
        const limit = this.getLimitForPlan(normalized);
        const query = this.buildQuery(normalized, { userId, clientKey });

        if (!limit) {
            return {
                plan: normalized,
                limit: null,
                count: 0,
                remaining: null,
                resetAt: null
            };
        }

        if (!query) {
            return {
                plan: normalized,
                limit,
                count: 0,
                remaining: limit.maxTransfers,
                resetAt: null
            };
        }

        const record = await this.Model.findOne(query).sort({ updatedAt: -1 }).lean();
        if (!record) {
            return {
                plan: normalized,
                limit,
                count: 0,
                remaining: limit.maxTransfers,
                resetAt: null
            };
        }

        const windowEnd = new Date(record.windowStart.getTime() + record.windowDurationMs);
        if (Date.now() >= windowEnd.getTime()) {
            return {
                plan: normalized,
                limit,
                count: 0,
                remaining: limit.maxTransfers,
                resetAt: null
            };
        }

        const remaining = Math.max(limit.maxTransfers - record.count, 0);
        return {
            plan: normalized,
            limit,
            count: record.count,
            remaining,
            resetAt: windowEnd
        };
    }

    async assertAndConsume({ plan, userId, clientKey }) {
        const normalized = this.normalizePlan(plan);
        const limit = this.getLimitForPlan(normalized);
        if (!limit) {
            return {
                allowed: true,
                plan: normalized,
                limit: null,
                remaining: null,
                resetAt: null
            };
        }

        const query = this.buildQuery(normalized, { userId, clientKey });
        if (!query) {
            return {
                allowed: false,
                plan: normalized,
                limit,
                remaining: 0,
                resetAt: null,
                message: 'Không xác định được danh tính người dùng để áp dụng giới hạn BeamShare.'
            };
        }

        const now = new Date();
        const windowEndThreshold = now.getTime() - limit.windowMs;

        let record = await this.Model.findOne(query);
        if (!record || record.windowStart.getTime() <= windowEndThreshold) {
            const update = {
                $set: {
                    plan: normalized,
                    windowStart: now,
                    windowDurationMs: limit.windowMs,
                    lastActivityAt: now
                },
                $setOnInsert: {}
            };

            if (normalized === 'guest') {
                update.$set.clientKey = query.clientKey;
            } else {
                update.$set.userId = query.userId;
            }

            update.$set.count = 1;

            record = await this.Model.findOneAndUpdate(query, update, {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            });

            return {
                allowed: true,
                plan: normalized,
                limit,
                remaining: Math.max(limit.maxTransfers - 1, 0),
                resetAt: new Date(now.getTime() + limit.windowMs)
            };
        }

        if (record.count >= limit.maxTransfers) {
            const resetAt = new Date(record.windowStart.getTime() + record.windowDurationMs);
            return {
                allowed: false,
                plan: normalized,
                limit,
                remaining: 0,
                resetAt,
                message: 'Bạn đã đạt tới giới hạn BeamShare trong khoảng thời gian hiện tại.'
            };
        }

        record.count += 1;
        record.lastActivityAt = now;
        await record.save();

        const remaining = Math.max(limit.maxTransfers - record.count, 0);
        const resetAt = new Date(record.windowStart.getTime() + record.windowDurationMs);

        return {
            allowed: true,
            plan: normalized,
            limit,
            remaining,
            resetAt
        };
    }
}

module.exports = BeamshareUsageService;
