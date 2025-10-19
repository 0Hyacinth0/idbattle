const STORAGE_KEY = 'idbattle_player_growth';

const subscribers = new Set();
let memoryStore = {};

function isLocalStorageAvailable() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        const testKey = '__idbattle_localstorage_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('LocalStorage 不可用，使用内存存储。', error);
        return false;
    }
}

const hasLocalStorage = isLocalStorageAvailable();

function readRawStore() {
    if (hasLocalStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch (error) {
            console.error('解析玩家成长数据失败，将重置存储。', error);
        }
        return {};
    }
    return memoryStore;
}

function writeRawStore(data) {
    const normalized = data && typeof data === 'object' ? data : {};
    if (hasLocalStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } else {
        memoryStore = { ...normalized };
    }
}

function normalizeNameKey(name) {
    if (typeof name !== 'string') {
        return '';
    }
    return name.trim().toLowerCase();
}

function cloneConfig(config) {
    if (typeof config === 'undefined') {
        return {};
    }
    return JSON.parse(JSON.stringify(config));
}

function listPlayerConfigs() {
    const store = readRawStore();
    return Object.values(store)
        .map(entry => ({
            key: normalizeNameKey(entry.name || ''),
            name: entry.name,
            updatedAt: entry.updatedAt,
            config: cloneConfig(entry.config)
        }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getPlayerConfig(name) {
    const key = normalizeNameKey(name);
    if (!key) {
        return null;
    }
    const store = readRawStore();
    const entry = store[key];
    if (!entry) {
        return null;
    }
    return cloneConfig(entry.config);
}

function notifySubscribers() {
    const snapshot = listPlayerConfigs();
    subscribers.forEach(callback => {
        try {
            callback(snapshot);
        } catch (error) {
            console.error('玩家成长数据订阅回调执行失败:', error);
        }
    });
}

function savePlayerConfig(name, config) {
    const key = normalizeNameKey(name);
    if (!key) {
        throw new Error('玩家名称不能为空');
    }

    const sanitizedConfig = cloneConfig(config ? { ...config } : {});
    const store = readRawStore();
    store[key] = {
        name,
        updatedAt: Date.now(),
        config: sanitizedConfig
    };
    writeRawStore(store);
    notifySubscribers();
    return cloneConfig(store[key].config);
}

function removePlayerConfig(name) {
    const key = normalizeNameKey(name);
    if (!key) {
        return false;
    }
    const store = readRawStore();
    if (!store[key]) {
        return false;
    }
    delete store[key];
    writeRawStore(store);
    notifySubscribers();
    return true;
}

function exportPlayerConfigs(pretty = true) {
    const players = listPlayerConfigs();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        players
    };
    return JSON.stringify(payload, null, pretty ? 2 : 0);
}

function importPlayerConfigs(rawText, { merge = true } = {}) {
    if (typeof rawText !== 'string' || rawText.trim() === '') {
        throw new Error('导入内容不能为空');
    }

    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (error) {
        throw new Error('导入内容不是有效的JSON');
    }

    const { players } = parsed || {};
    if (!Array.isArray(players)) {
        throw new Error('导入数据缺少 players 字段');
    }

    const store = merge ? readRawStore() : {};
    players.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const name = entry.name || entry.config?.metadata?.name;
        const key = normalizeNameKey(name);
        if (!key || !entry.config) {
            return;
        }
        store[key] = {
            name: name || entry.name,
            updatedAt: entry.updatedAt || Date.now(),
            config: cloneConfig(entry.config)
        };
    });

    writeRawStore(store);
    notifySubscribers();
    return listPlayerConfigs();
}

function subscribeToPlayerConfigs(callback) {
    if (typeof callback !== 'function') {
        return () => {};
    }
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
    };
}

export {
    listPlayerConfigs,
    getPlayerConfig,
    savePlayerConfig,
    removePlayerConfig,
    exportPlayerConfigs,
    importPlayerConfigs,
    subscribeToPlayerConfigs
};
