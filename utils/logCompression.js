const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

function getIndex(list, value) {
    const existingIndex = list.indexOf(value);
    if (existingIndex !== -1) {
        return existingIndex;
    }
    list.push(value);
    return list.length - 1;
}

function getEntityIndex(dictionaries, entity) {
    if (!entity) {
        return null;
    }
    const key = JSON.stringify({ name: entity.name ?? null, role: entity.role ?? null, id: entity.id ?? null });
    if (!dictionaries._entityMap) {
        dictionaries._entityMap = new Map();
    }
    const { entities } = dictionaries;
    const map = dictionaries._entityMap;
    if (map.has(key)) {
        return map.get(key);
    }
    entities.push({
        name: entity.name ?? null,
        role: entity.role ?? null,
        id: entity.id ?? null
    });
    const index = entities.length - 1;
    map.set(key, index);
    return index;
}

export function compressStructuredLog(structuredLog) {
    if (!structuredLog) {
        return null;
    }

    const dictionaries = {
        entities: [],
        eventTypes: [],
        keyframeTypes: [],
        stateAttributes: [],
        logTypes: []
    };

    const keyframes = (structuredLog.keyframes || []).map((keyframe) => {
        const typeIndex = getIndex(dictionaries.keyframeTypes, keyframe.type || 'unknown');
        return [
            keyframe.timestamp ?? 0,
            typeIndex,
            keyframe.detail ?? null
        ];
    });

    const events = (structuredLog.events || []).map((event) => {
        const typeIndex = getIndex(dictionaries.eventTypes, event.type || 'unknown');
        const actorIndex = getEntityIndex(dictionaries, event.actor || null);
        const targetIndex = getEntityIndex(dictionaries, event.target || null);
        return [
            event.timestamp ?? 0,
            typeIndex,
            actorIndex,
            targetIndex,
            event.parameters ?? null
        ];
    });

    const stateChanges = (structuredLog.stateChanges || []).map((change) => {
        const attributeIndex = getIndex(dictionaries.stateAttributes, change.attribute || 'unknown');
        const entityIndex = getEntityIndex(dictionaries, change.entity || null);
        return [
            change.timestamp ?? 0,
            entityIndex,
            attributeIndex,
            change.previousValue ?? null,
            change.currentValue ?? null,
            change.context ?? null
        ];
    });

    const logEntries = (structuredLog.logEntries || []).map((entry) => {
        const typeIndex = getIndex(dictionaries.logTypes, entry.type || 'entry');
        return [
            entry.timestamp ?? 0,
            typeIndex,
            entry.text ?? '',
            entry.round ?? null
        ];
    });

    const compressed = {
        meta: structuredLog.meta ? JSON.parse(JSON.stringify(structuredLog.meta)) : null,
        dictionaries: {
            entities: dictionaries.entities,
            eventTypes: dictionaries.eventTypes,
            keyframeTypes: dictionaries.keyframeTypes,
            stateAttributes: dictionaries.stateAttributes,
            logTypes: dictionaries.logTypes
        },
        keyframes,
        events,
        stateChanges,
        logEntries
    };

    return compressed;
}

export function decompressStructuredLog(compressedLog) {
    if (!compressedLog || !isObject(compressedLog)) {
        return null;
    }

    const { dictionaries = {} } = compressedLog;
    const entities = dictionaries.entities || [];
    const eventTypes = dictionaries.eventTypes || [];
    const keyframeTypes = dictionaries.keyframeTypes || [];
    const stateAttributes = dictionaries.stateAttributes || [];
    const logTypes = dictionaries.logTypes || [];

    const reconstructEntity = (index) => {
        if (index === null || typeof index !== 'number') {
            return null;
        }
        return entities[index] ?? null;
    };

    const keyframes = (compressedLog.keyframes || []).map(([timestamp, typeIndex, detail]) => ({
        timestamp: timestamp ?? 0,
        type: keyframeTypes[typeIndex] ?? 'unknown',
        detail: detail ?? null
    }));

    const events = (compressedLog.events || []).map(([timestamp, typeIndex, actorIndex, targetIndex, parameters]) => ({
        timestamp: timestamp ?? 0,
        type: eventTypes[typeIndex] ?? 'unknown',
        actor: reconstructEntity(actorIndex),
        target: reconstructEntity(targetIndex),
        parameters: parameters ?? null
    }));

    const stateChanges = (compressedLog.stateChanges || []).map(([timestamp, entityIndex, attributeIndex, previousValue, currentValue, context]) => ({
        timestamp: timestamp ?? 0,
        entity: reconstructEntity(entityIndex),
        attribute: stateAttributes[attributeIndex] ?? 'unknown',
        previousValue: previousValue ?? null,
        currentValue: currentValue ?? null,
        context: context ?? null
    }));

    const logEntries = (compressedLog.logEntries || []).map(([timestamp, typeIndex, text, round]) => ({
        timestamp: timestamp ?? 0,
        type: logTypes[typeIndex] ?? 'entry',
        text: typeof text === 'string' ? text : '',
        round: typeof round === 'number' ? round : null
    }));

    return {
        meta: compressedLog.meta ? JSON.parse(JSON.stringify(compressedLog.meta)) : null,
        keyframes,
        events,
        stateChanges,
        logEntries
    };
}
