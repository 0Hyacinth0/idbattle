const healthMeterRegistry = new Map();

function ensureMeter(prefix) {
    const container = document.getElementById(`${prefix}-health-bar`);
    if (!container) {
        console.warn(`[healthMeter] 容器不存在: ${prefix}-health-bar`);
        return null;
    }

    const fill = container.querySelector('.health-meter__fill');
    const value = container.querySelector('.health-meter__value');

    if (!fill || !value) {
        console.warn(`[healthMeter] 缺少必要的DOM节点: ${prefix}`);
        return null;
    }

    const entry = {
        container,
        fill,
        value,
        previousRatio: 0,
        previousValue: 0
    };

    healthMeterRegistry.set(prefix, entry);
    return entry;
}

function getMeter(prefix) {
    const cached = healthMeterRegistry.get(prefix);
    if (cached && cached.container.isConnected) {
        return cached;
    }
    return ensureMeter(prefix);
}

function formatValue(value) {
    if (!Number.isFinite(value)) {
        return '0';
    }
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 0.01) {
        return String(rounded);
    }
    return value.toFixed(1);
}

function determineState(ratio, isOverheal) {
    if (isOverheal) {
        return 'overheal';
    }
    if (ratio >= 0.66) {
        return 'healthy';
    }
    if (ratio >= 0.33) {
        return 'warning';
    }
    return 'critical';
}

function determineTrend(previousRatio, nextRatio) {
    const epsilon = 0.005;
    if (nextRatio > previousRatio + epsilon) {
        return 'up';
    }
    if (nextRatio < previousRatio - epsilon) {
        return 'down';
    }
    return 'steady';
}

function updateAria(entry, currentValue, maxValue, labelText) {
    entry.container.setAttribute('aria-valuenow', String(Math.round(currentValue)));
    entry.container.setAttribute('aria-valuemax', String(Math.round(maxValue)));
    entry.container.setAttribute('aria-valuetext', labelText);
}

function updateHealthMeter(prefix, currentHealth, maxHealth) {
    const entry = getMeter(prefix);
    if (!entry) {
        return;
    }

    const sanitizedHealth = Math.max(0, Number(currentHealth) || 0);
    const sanitizedMax = Math.max(0, Number(maxHealth) || 0);
    const effectiveMax = Math.max(sanitizedMax, sanitizedHealth);
    const ratio = effectiveMax > 0 ? sanitizedHealth / effectiveMax : 0;
    const overheal = sanitizedMax > 0 && sanitizedHealth > sanitizedMax;

    entry.fill.style.width = `${Math.min(ratio, 1) * 100}%`;
    entry.fill.style.setProperty('--health-meter-progress', `${Math.min(ratio, 1) * 100}%`);

    const labelText = sanitizedMax > 0
        ? `${formatValue(sanitizedHealth)}/${formatValue(sanitizedMax)}`
        : formatValue(sanitizedHealth);
    entry.value.textContent = labelText;

    const state = determineState(ratio, overheal);
    entry.container.dataset.state = state;
    entry.container.dataset.trend = determineTrend(entry.previousRatio, ratio);

    if (overheal) {
        entry.container.dataset.overheal = 'true';
    } else {
        delete entry.container.dataset.overheal;
    }

    updateAria(entry, sanitizedHealth, effectiveMax, labelText);

    entry.previousRatio = ratio;
    entry.previousValue = sanitizedHealth;
}

function resetHealthMeter(prefix) {
    const entry = getMeter(prefix);
    if (!entry) {
        return;
    }

    entry.fill.style.width = '0%';
    entry.fill.style.setProperty('--health-meter-progress', '0%');
    entry.value.textContent = '--';
    entry.container.dataset.state = 'idle';
    entry.container.dataset.trend = 'steady';
    delete entry.container.dataset.overheal;
    updateAria(entry, 0, 0, '--');

    entry.previousRatio = 0;
    entry.previousValue = 0;
}

export { updateHealthMeter, resetHealthMeter };
