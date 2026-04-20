import { getBasePlayerProfile } from '../../models/player.js';
import {
    equipmentList,
    getEquipmentWithEnhancement,
    MAX_ENHANCEMENT_LEVEL,
    deriveEnhancementLevelFromHash
} from '../../models/equipment.js';
import skills from '../../models/skills.js';

export const TOTAL_ATTRIBUTE_POINTS = 20;
export const ATTRIBUTE_RULES = {
    health: { label: '生命', stepValue: 5, costPerStep: 1 },
    attack: { label: '攻击', stepValue: 1, costPerStep: 1 },
    defense: { label: '防御', stepValue: 1, costPerStep: 1 },
    speed: { label: '速度', stepValue: 1, costPerStep: 1 }
};

export const ATTRIBUTE_LABELS = {
    attack: '攻击',
    defense: '防御',
    health: '生命',
    speed: '速度',
    critChance: '会心',
    critDamage: '会心伤害',
    parryChance: '招架',
    dodge: '闪避',
    block: '格挡',
    lifeSteal: '吸血',
    resilience: '韧性'
};

export const BUILDER_KEYS = ['p1', 'p2'];

export function clampEnhancement(level, fallback = 0) {
    const parsed = Number.parseInt(level, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    return Math.min(Math.max(parsed, 0), MAX_ENHANCEMENT_LEVEL);
}

export function resolveDefaultEnhancement(baseItem, state, typeKey) {
    if (!baseItem || !state?.baseProfile?.md5) {
        return 0;
    }
    return deriveEnhancementLevelFromHash(state.baseProfile.md5, typeKey, baseItem.name);
}

export function normalizeEquipmentSelection(selection) {
    if (!selection) return null;
    if (typeof selection === 'string') {
        const baseItem = equipmentList[selection];
        if (!baseItem) return null;
        return { name: baseItem.name, enhancementLevel: null };
    }
    if (typeof selection === 'object') {
        const name = selection.name || selection.equipmentName;
        if (!name || !equipmentList[name]) return null;
        const baseItem = equipmentList[name];
        const hasLevel = typeof selection.enhancementLevel === 'number';
        const level = hasLevel ? clampEnhancement(selection.enhancementLevel, 0) : null;
        return { name: baseItem.name, enhancementLevel: level };
    }
    return null;
}

export function normalizeEquipmentLoadout(loadout = {}) {
    const normalized = {};
    Object.entries(loadout).forEach(([typeKey, value]) => {
        const normalizedSelection = normalizeEquipmentSelection(value);
        if (normalizedSelection) {
            normalized[typeKey] = normalizedSelection;
        }
    });
    return normalized;
}

export function createDefaultState() {
    return {
        name: '',
        baseProfile: null,
        statAdjustments: { health: 0, attack: 0, defense: 0, speed: 0 },
        equipmentLoadout: {},
        skillOverride: '',
        metadata: { availablePoints: TOTAL_ATTRIBUTE_POINTS }
    };
}

export const builderState = {
    p1: createDefaultState(),
    p2: createDefaultState()
};

export function computeEquipmentBonus(equipmentLoadout, state) {
    const bonuses = {};
    Object.entries(equipmentLoadout || {}).forEach(([typeKey, selection]) => {
        if (!selection || !selection.name) return;
        const baseItem = equipmentList[selection.name];
        if (!baseItem) return;

        const fallbackLevel = resolveDefaultEnhancement(baseItem, state, typeKey);
        const level = typeof selection.enhancementLevel === 'number'
            ? clampEnhancement(selection.enhancementLevel, fallbackLevel)
            : fallbackLevel;

        const item = getEquipmentWithEnhancement(selection.name, level);
        if (!item || !item.attributes) return;

        Object.entries(item.attributes).forEach(([attr, value]) => {
            if (typeof value === 'number') {
                bonuses[attr] = (bonuses[attr] || 0) + value;
            }
        });
    });
    return bonuses;
}

export function recalcAvailablePoints(state) {
    let spent = 0;
    Object.entries(ATTRIBUTE_RULES).forEach(([attr, rule]) => {
        const adjustment = state.statAdjustments[attr] || 0;
        const steps = Math.round(adjustment / rule.stepValue);
        spent += steps * rule.costPerStep;
    });
    const remaining = TOTAL_ATTRIBUTE_POINTS - spent;
    state.metadata.availablePoints = Math.max(remaining, 0);
    return state.metadata.availablePoints;
}

export function getSkillByName(name) {
    if (!name) return null;
    return skills.find(skill => skill.name === name) || null;
}

export function applyConfigToState(state, config) {
    state.statAdjustments = {
        health: 0, attack: 0, defense: 0, speed: 0,
        ...(config?.statAdjustments || {})
    };
    state.equipmentLoadout = normalizeEquipmentLoadout(config?.equipmentLoadout);
    state.skillOverride = config?.skillOverride || '';
    const metadata = {
        availablePoints: TOTAL_ATTRIBUTE_POINTS,
        ...(config?.metadata || {})
    };
    delete metadata.notes;
    delete metadata.level;
    delete metadata.experience;
    state.metadata = metadata;
    recalcAvailablePoints(state);
}

export function resetState(state) {
    const defaults = createDefaultState();
    state.statAdjustments = { ...defaults.statAdjustments };
    state.equipmentLoadout = {};
    state.skillOverride = '';
    state.metadata = { ...defaults.metadata };
    recalcAvailablePoints(state);
}
