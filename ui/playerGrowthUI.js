import { getBasePlayerProfile } from '../models/player.js';
import {
    EquipmentType,
    equipmentByType,
    equipmentList,
    getEquipmentWithEnhancement,
    MAX_ENHANCEMENT_LEVEL,
    deriveEnhancementLevelFromHash
} from '../models/equipment.js';
import skills from '../models/skills.js';
import {
    getPlayerConfig,
    savePlayerConfig,
    removePlayerConfig,
    listPlayerConfigs,
    exportPlayerConfigs,
    importPlayerConfigs,
    subscribeToPlayerConfigs
} from '../utils/storage.js';

import {
    TOTAL_ATTRIBUTE_POINTS,
    ATTRIBUTE_RULES,
    ATTRIBUTE_LABELS,
    BUILDER_KEYS,
    clampEnhancement,
    resolveDefaultEnhancement,
    builderState,
    computeEquipmentBonus,
    recalcAvailablePoints,
    getSkillByName,
    applyConfigToState,
    resetState
} from './growth/growthCore.js';

function formatNumber(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
    }
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
        return rounded.toString();
    }
    return rounded.toFixed(1).replace(/\.0$/, '');
}

function formatSigned(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
    }
    if (value > 0) {
        return `+${formatNumber(value)}`;
    }
    if (value < 0) {
        return `-${formatNumber(Math.abs(value))}`;
    }
    return '0';
}


function populateSkillOptions(select) {
    if (!select || select.dataset.initialized === 'true') {
        return;
    }
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '使用默认技能';
    select.appendChild(defaultOption);

    skills.forEach(skill => {
        const option = document.createElement('option');
        option.value = skill.name;
        option.textContent = skill.name;
        select.appendChild(option);
    });
    select.dataset.initialized = 'true';
}

function populateEquipmentOptions(select, typeKey) {
    if (!select || select.dataset.initialized === 'true') {
        return;
    }
    const typeLabel = EquipmentType[typeKey];
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = `默认随机${typeLabel}`;
    select.appendChild(defaultOption);

    const list = equipmentByType[typeLabel] || [];
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        select.appendChild(option);
    });
    select.dataset.initialized = 'true';
}

function renderEquipmentPreview(panel, state) {
    const container = panel.querySelector('[data-role="equipment-preview"]');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const entries = Object.entries(state.equipmentLoadout).filter(([, value]) => value && value.name);
    if (entries.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'growth-equipment__empty';
        placeholder.textContent = '未选择装备，战斗时将根据默认规则生成。';
        container.appendChild(placeholder);
        return;
    }

    entries.forEach(([typeKey, selection]) => {
        if (!selection || !selection.name) {
            return;
        }
        const baseItem = equipmentList[selection.name];
        const fallbackLevel = resolveDefaultEnhancement(baseItem, state, typeKey);
        const level = typeof selection.enhancementLevel === 'number'
            ? clampEnhancement(selection.enhancementLevel, fallbackLevel)
            : fallbackLevel;
        const item = getEquipmentWithEnhancement(selection.name, level);
        if (!item) {
            return;
        }
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'equipment-preview-item';

        const header = document.createElement('div');
        header.className = 'equipment-preview-item__header';
        const enhancementLabel = item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : '';
        header.textContent = `${EquipmentType[typeKey] || item.type}：${item.name}${enhancementLabel}`;
        itemWrapper.appendChild(header);

        const attrList = document.createElement('ul');
        attrList.className = 'equipment-preview-item__attributes';
        const attributes = item.attributes || {};
        const attrEntries = Object.entries(attributes);
        if (attrEntries.length === 0) {
            const attrItem = document.createElement('li');
            attrItem.textContent = '无额外属性';
            attrList.appendChild(attrItem);
        } else {
            attrEntries.forEach(([attr, value]) => {
                const attrItem = document.createElement('li');
                const label = ATTRIBUTE_LABELS[attr] || attr;
                attrItem.textContent = `${label} ${formatSigned(value)}`;
                attrList.appendChild(attrItem);
            });
        }
        itemWrapper.appendChild(attrList);
        container.appendChild(itemWrapper);
    });
}


function updatePanelStatus(panel, message, tone = 'info') {
    const status = panel.querySelector('[data-role="status"]');
    if (!status) {
        return;
    }
    status.textContent = message;
    status.dataset.tone = tone;
    if (message) {
        status.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    }
}

function updatePanelUI(panel, playerKey) {
    const state = builderState[playerKey];
    if (!state) {
        return;
    }
    recalcAvailablePoints(state);
    const basePlayer = state.baseProfile?.basePlayer || {};
    const equipmentBonus = computeEquipmentBonus(state.equipmentLoadout, state);

    const nameDisplay = panel.querySelector('[data-role="builder-name"]');
    if (nameDisplay) {
        nameDisplay.textContent = state.name || '未指定';
    }

    const availablePoints = panel.querySelector('[data-role="available-points"]');
    if (availablePoints) {
        availablePoints.textContent = state.metadata.availablePoints;
    }

    const totalPoints = panel.querySelector('[data-role="total-points"]');
    if (totalPoints) {
        totalPoints.textContent = TOTAL_ATTRIBUTE_POINTS;
    }

    Object.entries(ATTRIBUTE_RULES).forEach(([attr, rule]) => {
        const row = panel.querySelector(`[data-attribute="${attr}"]`);
        if (!row) {
            return;
        }
        const baseValue = basePlayer[attr];
        const adjustment = state.statAdjustments[attr] || 0;
        const equipmentValue = equipmentBonus[attr] || 0;
        const totalValue = (baseValue || 0) + adjustment + equipmentValue;

        const baseEl = row.querySelector('[data-role="base"]');
        if (baseEl) {
            baseEl.textContent = typeof baseValue === 'number' ? formatNumber(baseValue) : '--';
        }
        const adjustmentEl = row.querySelector('[data-role="adjustment"]');
        if (adjustmentEl) {
            adjustmentEl.textContent = formatSigned(adjustment);
        }
        const equipEl = row.querySelector('[data-role="equipment"]');
        if (equipEl) {
            equipEl.textContent = formatSigned(equipmentValue);
        }
        const totalEl = row.querySelector('[data-role="total"]');
        if (totalEl) {
            totalEl.textContent = formatNumber(totalValue);
        }

        const decrementButton = row.querySelector('button[data-action="decrement"]');
        if (decrementButton) {
            decrementButton.disabled = adjustment <= 0;
        }
        const incrementButton = row.querySelector('button[data-action="increment"]');
        if (incrementButton) {
            incrementButton.disabled = state.metadata.availablePoints < rule.costPerStep;
        }
    });

    const skillSelect = panel.querySelector('[data-role="skill-select"]');
    if (skillSelect) {
        populateSkillOptions(skillSelect);
        skillSelect.value = state.skillOverride || '';
    }

    const defaultSkillName = panel.querySelector('[data-role="default-skill"]');
    if (defaultSkillName) {
        defaultSkillName.textContent = state.baseProfile?.defaultSkill?.name || '未知技能';
    }

    const skillDescription = panel.querySelector('[data-role="skill-description"]');
    if (skillDescription) {
        const selectedSkill = getSkillByName(state.skillOverride) || state.baseProfile?.defaultSkill;
        skillDescription.textContent = selectedSkill ? selectedSkill.description : '未选择技能';
    }

    const defaultSkillWrapper = panel.querySelector('[data-role="default-skill-wrapper"]');
    if (defaultSkillWrapper) {
        defaultSkillWrapper.classList.toggle('is-hidden', !state.baseProfile);
    }

    Object.keys(EquipmentType).forEach(typeKey => {
        const select = panel.querySelector(`[data-equip="${typeKey}"]`);
        if (!select) {
            return;
        }
        populateEquipmentOptions(select, typeKey);
        const selection = state.equipmentLoadout[typeKey];
        select.value = selection?.name || '';

        const levelInput = panel.querySelector(`[data-equip-level="${typeKey}"]`);
        if (levelInput) {
            const baseItem = selection?.name ? equipmentList[selection.name] : null;
            const defaultLevel = resolveDefaultEnhancement(baseItem, state, typeKey);
            const levelValue = typeof selection?.enhancementLevel === 'number'
                ? selection.enhancementLevel
                : defaultLevel;
            levelInput.value = clampEnhancement(levelValue, defaultLevel);
            levelInput.disabled = !selection?.name;
            levelInput.setAttribute('aria-disabled', levelInput.disabled ? 'true' : 'false');
            levelInput.dataset.defaultLevel = defaultLevel;
        }
    });

    renderEquipmentPreview(panel, state);
}

function handleAttributeChange(panel, playerKey, attribute, action) {
    const state = builderState[playerKey];
    const rule = ATTRIBUTE_RULES[attribute];
    if (!state || !rule) {
        return;
    }
    const direction = action === 'increment' ? 1 : -1;
    const delta = rule.stepValue * direction;
    if (direction > 0 && state.metadata.availablePoints < rule.costPerStep) {
        updatePanelStatus(panel, '可用属性点不足', 'warn');
        return;
    }
    const current = state.statAdjustments[attribute] || 0;
    const next = current + delta;
    if (next < 0) {
        return;
    }
    state.statAdjustments[attribute] = next;
    recalcAvailablePoints(state);
    updatePanelUI(panel, playerKey);
    autoSaveConfig(panel, playerKey);
}

function autoSaveConfig(panel, playerKey) {
    const state = builderState[playerKey];
    if (!state.name) {
        return;
    }
    recalcAvailablePoints(state);
    const normalizedLoadout = {};
    Object.entries(state.equipmentLoadout).forEach(([typeKey, value]) => {
        if (!value || !value.name) {
            return;
        }
        const baseItem = equipmentList[value.name];
        const fallback = resolveDefaultEnhancement(baseItem, state, typeKey);
        normalizedLoadout[typeKey] = {
            name: value.name,
            enhancementLevel: clampEnhancement(value.enhancementLevel, fallback)
        };
    });
    const configToSave = {
        statAdjustments: { ...state.statAdjustments },
        equipmentLoadout: normalizedLoadout,
        skillOverride: state.skillOverride || '',
        metadata: {
            ...state.metadata,
            name: state.name,
            totalPoints: TOTAL_ATTRIBUTE_POINTS,
            lastSaved: new Date().toISOString()
        }
    };
    savePlayerConfig(state.name, configToSave);
    updatePanelStatus(panel, '配装已自动保存。', 'success');
}

function handlePanelActions(panel, playerKey, root) {
    panel.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }
        const action = button.dataset.action;
        if (action === 'increment' || action === 'decrement') {
            const attribute = button.dataset.attribute;
            handleAttributeChange(panel, playerKey, attribute, action);
            return;
        }
        if (action === 'save-config') {
            const state = builderState[playerKey];
            if (!state.name) {
                updatePanelStatus(panel, '请先输入玩家名称。', 'warn');
                return;
            }
            autoSaveConfig(panel, playerKey);
            if (root) {
                updateSavedPlayerSelections(root);
            }
            return;
        }
        if (action === 'reset-config') {
            const state = builderState[playerKey];
            resetState(state);
            updatePanelUI(panel, playerKey);
            updatePanelStatus(panel, '属性与选择已重置。', 'info');
            return;
        }
        if (action === 'remove-config') {
            const state = builderState[playerKey];
            if (!state.name) {
                updatePanelStatus(panel, '没有可删除的配置。', 'warn');
                return;
            }
            const removed = removePlayerConfig(state.name);
            if (removed) {
                resetState(state);
                updatePanelUI(panel, playerKey);
                updatePanelStatus(panel, '已删除该玩家的本地成长数据。', 'success');
                if (root) {
                    updateSavedPlayerSelections(root);
                }
            } else {
                updatePanelStatus(panel, '未找到可删除的成长数据。', 'warn');
            }
        }
    });
}

function handleInputs(panel, playerKey) {
    const skillSelect = panel.querySelector('[data-role="skill-select"]');
    if (skillSelect) {
        populateSkillOptions(skillSelect);
        skillSelect.addEventListener('change', () => {
            const state = builderState[playerKey];
            state.skillOverride = skillSelect.value;
            updatePanelUI(panel, playerKey);
            autoSaveConfig(panel, playerKey);
        });
    }

    Object.keys(EquipmentType).forEach(typeKey => {
        const select = panel.querySelector(`[data-equip="${typeKey}"]`);
        if (!select) {
            return;
        }
        populateEquipmentOptions(select, typeKey);
        select.addEventListener('change', () => {
            const state = builderState[playerKey];
            const value = select.value;
            if (value) {
                const baseItem = equipmentList[value];
                const defaultLevel = resolveDefaultEnhancement(baseItem, state, typeKey);
                const previous = state.equipmentLoadout[typeKey];
                const shouldKeepLevel = previous && previous.name === value;
                const nextLevel = shouldKeepLevel ? previous.enhancementLevel : defaultLevel;
                state.equipmentLoadout[typeKey] = {
                    name: value,
                    enhancementLevel: clampEnhancement(nextLevel, defaultLevel)
                };
            } else {
                delete state.equipmentLoadout[typeKey];
            }
            updatePanelUI(panel, playerKey);
            autoSaveConfig(panel, playerKey);
        });

        const levelInput = panel.querySelector(`[data-equip-level="${typeKey}"]`);
        if (levelInput) {
            levelInput.addEventListener('input', () => {
                const state = builderState[playerKey];
                const selection = state.equipmentLoadout[typeKey];
                if (!selection || !selection.name) {
                    return;
                }
                const baseItem = equipmentList[selection.name];
                const fallback = resolveDefaultEnhancement(baseItem, state, typeKey);
                selection.enhancementLevel = clampEnhancement(levelInput.value, fallback);
                updatePanelUI(panel, playerKey);
                autoSaveConfig(panel, playerKey);
            });
        }
    });
}

function updateSavedPlayerSelections(root) {
    const savedPlayers = listPlayerConfigs();
    const selects = root.querySelectorAll('[data-role="saved-player-select"]');
    selects.forEach(select => {
        const previous = select.value;
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '加载本地存档';
        select.appendChild(placeholder);
        savedPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player.name;
            option.textContent = player.name;
            select.appendChild(option);
        });
        if (previous) {
            const hasOption = savedPlayers.some(player => player.name === previous);
            select.value = hasOption ? previous : '';
        }
    });
}

function applyNameToPanel(playerKey, name) {
    const state = builderState[playerKey];
    state.name = name;
    if (name) {
        state.baseProfile = getBasePlayerProfile(name);
        const stored = getPlayerConfig(name);
        if (stored) {
            applyConfigToState(state, stored);
        } else {
            resetState(state);
        }
    } else {
        state.baseProfile = null;
        resetState(state);
    }
}

function syncNameInputs() {
    const inputMap = {
        p1: document.getElementById('player1'),
        p2: document.getElementById('player2')
    };
    Object.entries(inputMap).forEach(([key, input]) => {
        if (!input) {
            return;
        }
        const panel = document.querySelector(`[data-player-growth] [data-builder="${key}"]`);
        if (!panel) {
            return;
        }
        const update = () => {
            const name = input.value.trim();
            applyNameToPanel(key, name);
            updatePanelUI(panel, key);
        };
        input.addEventListener('input', update);
        update();
    });
}

function setupSavedSelectionHandlers(root) {
    const selects = root.querySelectorAll('[data-role="saved-player-select"]');
    selects.forEach(select => {
        select.addEventListener('change', () => {
            const name = select.value;
            if (!name) {
                return;
            }
            const playerInputId = select.dataset.targetInput;
            const targetInput = playerInputId ? document.getElementById(playerInputId) : null;
            if (targetInput) {
                targetInput.value = name;
                targetInput.dispatchEvent(new Event('input'));
            }
        });
    });
}

function setupImportExport(root) {
    const exportButton = root.querySelector('[data-action="export-configs"]');
    const importButton = root.querySelector('[data-action="import-configs"]');
    const storageTextarea = root.querySelector('[data-role="storage-text"]');
    const status = root.querySelector('[data-role="storage-status"]');

    if (exportButton) {
        exportButton.addEventListener('click', () => {
            if (!storageTextarea) {
                return;
            }
            storageTextarea.value = exportPlayerConfigs(true);
            if (status) {
                status.textContent = '已生成最新的成长数据导出，请复制保存。';
                status.dataset.tone = 'info';
            }
        });
    }

    if (importButton) {
        importButton.addEventListener('click', () => {
            if (!storageTextarea) {
                return;
            }
            try {
                importPlayerConfigs(storageTextarea.value, { merge: true });
                if (status) {
                    status.textContent = '导入完成，已同步本地成长数据。';
                    status.dataset.tone = 'success';
                }
                BUILDER_KEYS.forEach(key => {
                    const panel = root.querySelector(`[data-builder="${key}"]`);
                    const state = builderState[key];
                    if (panel && state.name) {
                        applyNameToPanel(key, state.name);
                        updatePanelUI(panel, key);
                    }
                });
                updateSavedPlayerSelections(root);
            } catch (error) {
                if (status) {
                    status.textContent = error.message;
                    status.dataset.tone = 'error';
                }
            }
        });
    }
}

function initPlayerGrowthUI() {
    if (typeof document === 'undefined') {
        return;
    }
    const root = document.querySelector('[data-player-growth]');
    if (!root) {
        return;
    }

    BUILDER_KEYS.forEach(key => {
        const panel = root.querySelector(`[data-builder="${key}"]`);
        if (!panel) {
            return;
        }
        handlePanelActions(panel, key, root);
        handleInputs(panel, key);
        updatePanelUI(panel, key);
    });

    subscribeToPlayerConfigs(() => {
        updateSavedPlayerSelections(root);
    });
    updateSavedPlayerSelections(root);
    setupSavedSelectionHandlers(root);
    setupImportExport(root);
    syncNameInputs();
}

export { initPlayerGrowthUI };
