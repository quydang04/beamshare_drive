const FIVE_GIB = 5 * 1024 * 1024 * 1024;
const FIFTEEN_GIB = 15 * 1024 * 1024 * 1024;

const PLAN_DEFINITIONS = {
    basic: {
        id: 'basic',
        title: 'Basic',
        description: 'Gói miễn phí cho nhu cầu sử dụng cơ bản.',
        monthlyPrice: 0,
        currency: 'VND',
        storageLimitBytes: FIVE_GIB,
        beamshare: {
            limitLabel: '10 lượt gửi mỗi 1 giờ',
            windowMs: 60 * 60 * 1000,
            maxTransfers: 10
        }
    },
    premium: {
        id: 'premium',
        title: 'Premium',
        description: 'Dung lượng mở rộng và BeamShare không giới hạn.',
        monthlyPrice: 50000,
        currency: 'VND',
        storageLimitBytes: FIFTEEN_GIB,
        beamshare: {
            limitLabel: 'Không giới hạn',
            windowMs: 0,
            maxTransfers: 0
        }
    }
};

const BEAMSHARE_GUEST_LIMIT = {
    label: '5 lượt gửi mỗi 5 giờ',
    windowMs: 5 * 60 * 60 * 1000,
    maxTransfers: 5
};

function resolvePlan(planName) {
    if (!planName) {
        return PLAN_DEFINITIONS.basic;
    }
    const key = String(planName).toLowerCase();
    return PLAN_DEFINITIONS[key] || PLAN_DEFINITIONS.basic;
}

module.exports = {
    PLAN_DEFINITIONS,
    BEAMSHARE_GUEST_LIMIT,
    resolvePlan
};
