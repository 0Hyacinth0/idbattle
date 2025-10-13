import { PlayerRepository } from './playerRepository.js';
import { MockPlayerRepository } from './mockPlayerRepository.js';

/**
 * 玩家数据访问服务，对仓储层进行封装，供 UI 或业务逻辑调用。
 */
export class PlayerDataService {
    /**
     * @param {{ playerRepository?: PlayerRepository }} [options]
     */
    constructor({ playerRepository } = {}) {
        const repository = playerRepository || new MockPlayerRepository();
        if (!(repository instanceof PlayerRepository)) {
            throw new TypeError('playerRepository 必须继承 PlayerRepository');
        }
        this.repository = repository;
    }

    /**
     * 获取基础模板。
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async getBaseProfile(name) {
        return this.repository.fetchBaseProfile(name);
    }

    /**
     * 获取包含装备与自定义调整的完整玩家数据。
     * @param {string} name
     * @param {{ customization?: object, fallbackToStored?: boolean }} [options]
     * @returns {Promise<object|null>}
     */
    async getPlayerProfile(name, { customization, fallbackToStored = true } = {}) {
        let finalCustomization = customization;
        if (typeof finalCustomization === 'undefined' && fallbackToStored) {
            finalCustomization = await this.repository.getCustomization(name);
        }
        return this.repository.fetchPlayerProfile(name, { customization: finalCustomization });
    }

    /**
     * 获取存储的自定义配置。
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async getCustomization(name) {
        return this.repository.getCustomization(name);
    }

    /**
     * 保存自定义配置并返回最新的玩家数据。
     * @param {string} name
     * @param {object} customization
     * @returns {Promise<{ player: object|null, customization: object }>} 
     */
    async saveCustomization(name, customization) {
        const saved = await this.repository.saveCustomization(name, customization);
        const player = await this.getPlayerProfile(name, { customization });
        return {
            player,
            customization: saved?.config || customization
        };
    }

    /**
     * 列出已保存的玩家条目。
     * @returns {Promise<Array<object>>}
     */
    async listSavedPlayers() {
        return this.repository.listSavedPlayers();
    }
}

/**
 * 创建默认的数据访问服务实例。
 * @param {{ playerRepository?: PlayerRepository }} [options]
 */
export function createPlayerDataService(options) {
    return new PlayerDataService(options);
}
