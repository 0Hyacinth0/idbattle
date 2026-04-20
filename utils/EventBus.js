/**
 * 轻量级全局事件总线，用于战斗引擎和 UI 层的解耦
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * 订阅事件
     * @param {string} eventName 事件名称
     * @param {Function} callback 回调函数
     * @returns {Function} 返回一个取消订阅的函数
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);

        // 返回取消订阅的句柄
        return () => this.off(eventName, callback);
    }

    /**
     * 仅订阅一次事件
     * @param {string} eventName 事件名称
     * @param {Function} callback 回调函数
     */
    once(eventName, callback) {
        const wrapper = (...args) => {
            this.off(eventName, wrapper);
            callback(...args);
        };
        this.on(eventName, wrapper);
    }

    /**
     * 取消订阅事件
     * @param {string} eventName 事件名称
     * @param {Function} callback 回调函数
     */
    off(eventName, callback) {
        if (!this.events[eventName]) return;

        if (!callback) {
            // 如果不传 callback，则清空该事件的所有订阅
            delete this.events[eventName];
            return;
        }

        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    /**
     * 触发事件
     * @param {string} eventName 事件名称
     * @param {any} payload 传递的数据
     */
    emit(eventName, payload) {
        if (!this.events[eventName]) return;

        // 避免在回调中修改数组导致的问题
        const callbacks = [...this.events[eventName]];
        callbacks.forEach(callback => {
            try {
                callback(payload);
            } catch (error) {
                console.error(`Error executing event handler for ${eventName}:`, error);
            }
        });
    }

    /**
     * 清空所有事件
     */
    clear() {
        this.events = {};
    }
}

// 导出一个单例模式的 EventBus
const globalEventBus = new EventBus();
export default globalEventBus;

// 预定义一些常用的核心事件类型，防止拼写错误
export const BattleEvents = {
    BATTLE_START: 'BATTLE_START',
    BATTLE_END: 'BATTLE_END',
    BATTLE_ERROR: 'BATTLE_ERROR',
    PLAYER_INFO_UPDATE: 'PLAYER_INFO_UPDATE',
    LOG_APPEND: 'LOG_APPEND',
    TURN_UPDATE: 'TURN_UPDATE',
    KEYFRAME: 'KEYFRAME', // 新增的用于记录关键帧的事件，可用于UI展示

    // 特定动作事件
    HERO_ATTACK: 'HERO_ATTACK',
    HERO_DODGE: 'HERO_DODGE',
    HERO_SKILL: 'HERO_SKILL',
    HERO_STATUS_CHANGE: 'HERO_STATUS_CHANGE',
    HERO_DEATH: 'HERO_DEATH'
};
