const FIVE_GIB = 5 * 1024 * 1024 * 1024;
const FIFTEEN_GIB = 15 * 1024 * 1024 * 1024;
const BASIC_BEAMSHARE_FILE_LIMIT = 200 * 1024 * 1024; // 200MB per file

const PLAN_DEFINITIONS = {
    basic: {
        id: 'basic',
        title: 'Basic',
        description: 'Free plan for everyday personal transfers.',
        monthlyPrice: 0,
        currency: 'VND',
        storageLimitBytes: FIVE_GIB,
        beamshare: {
            limitLabel: 'Unlimited sends, up to 200MB per file',
            fileSizeLimitBytes: BASIC_BEAMSHARE_FILE_LIMIT,
            windowMs: null,
            maxTransfers: null
        }
    },
    premium: {
        id: 'premium',
        title: 'Premium',
        description: 'Expanded storage and unlimited BeamShare.',
        monthlyPrice: 50000,
        currency: 'VND',
        storageLimitBytes: FIFTEEN_GIB,
        beamshare: {
            limitLabel: 'Unlimited',
            fileSizeLimitBytes: null,
            windowMs: null,
            maxTransfers: null
        }
    }
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
    resolvePlan
};
