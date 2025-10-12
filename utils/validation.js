const ATTRIBUTE_LIMITS = {
    health: { min: 1, softCap: 600, hardCap: 1200 },
    attack: { min: 1, softCap: 80, hardCap: 150 },
    defense: { min: 0, softCap: 70, hardCap: 130 },
    speed: { min: 1, softCap: 40, hardCap: 80 },
    critChance: { min: 0, softCap: 0.4, hardCap: 0.8 },
    parryChance: { min: 0, softCap: 0.3, hardCap: 0.6 },
    shield: { min: 0, softCap: 300, hardCap: 600 }
};

function applySoftCap(value, limits) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new TypeError('数值字段必须为有效数字');
    }

    const { softCap = Number.POSITIVE_INFINITY, hardCap = Number.POSITIVE_INFINITY } = limits;
    const baseMin = typeof limits.min === 'number' ? limits.min : Number.NEGATIVE_INFINITY;
    let sanitized = Math.max(value, baseMin);

    if (sanitized <= softCap) {
        return Math.min(sanitized, hardCap);
    }

    // 软上限以平方根递减方式压制过高的数值
    const exceeded = sanitized - softCap;
    const softened = softCap + Math.sqrt(exceeded);
    return Math.min(softened, hardCap);
}

function validateAttributes(attributes) {
    const sanitized = {};
    const adjustments = {};

    Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'undefined') {
            return;
        }

        const limits = ATTRIBUTE_LIMITS[key] || { min: 0, softCap: Number.POSITIVE_INFINITY, hardCap: Number.POSITIVE_INFINITY };
        const applied = applySoftCap(value, limits);
        sanitized[key] = applied;

        if (applied !== value) {
            adjustments[key] = { original: value, adjusted: applied };
        }
    });

    return { sanitized, adjustments };
}

function mergeAttributes(base, overrides = {}) {
    const merged = { ...base };
    Object.entries(overrides).forEach(([key, value]) => {
        if (typeof value === 'number') {
            merged[key] = (merged[key] || 0) + value;
        }
    });
    return merged;
}

export { ATTRIBUTE_LIMITS, applySoftCap, validateAttributes, mergeAttributes };
