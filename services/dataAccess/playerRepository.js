/**
 * 基础玩家仓储接口，约束所有数据源实现需要具备的能力。
 */
export class PlayerRepository {
    /**
     * 获取指定玩家的基础模板，不包含任何自定义调整。
     * @param {string} name 玩家名称
     * @returns {Promise<object|null>}
     */
    // eslint-disable-next-line class-methods-use-this
    async fetchBaseProfile(name) {
        throw new Error('fetchBaseProfile 未实现');
    }

    /**
     * 获取包含自定义调整的完整玩家数据。
     * @param {string} name 玩家名称
     * @param {{ customization?: object }} [options]
     * @returns {Promise<object|null>}
     */
    // eslint-disable-next-line class-methods-use-this
    async fetchPlayerProfile(name, { customization } = {}) {
        void customization;
        throw new Error('fetchPlayerProfile 未实现');
    }

    /**
     * 读取存储在数据源中的玩家自定义配置。
     * @param {string} name 玩家名称
     * @returns {Promise<object|null>}
     */
    // eslint-disable-next-line class-methods-use-this
    async getCustomization(name) {
        throw new Error('getCustomization 未实现');
    }

    /**
     * 持久化玩家自定义配置。
     * @param {string} name 玩家名称
     * @param {object} customization 自定义配置
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line class-methods-use-this
    async saveCustomization(name, customization) {
        void customization;
        throw new Error('saveCustomization 未实现');
    }

    /**
     * 列出有保存记录的玩家概要信息。
     * @returns {Promise<Array<object>>}
     */
    // eslint-disable-next-line class-methods-use-this
    async listSavedPlayers() {
        throw new Error('listSavedPlayers 未实现');
    }
}
