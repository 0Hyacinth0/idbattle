import globalEventBus, { BattleEvents } from '../utils/EventBus.js';

class BattleStore {
    constructor() {
        this.state = {
            player1: null,
            player2: null,
            apState: { p1: 0, p2: 0 },
            logs: [],
            currentRound: 0,
            isBattling: false,
            battleResult: null
        };
        this.listeners = new Set();
        this.initSubscriptions();
    }

    getState() {
        return this.state;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener); // Unsubscribe function
    }

    notify(changedKeys = []) {
        for (const listener of this.listeners) {
            listener(this.state, changedKeys);
        }
    }

    initSubscriptions() {
        globalEventBus.on('onBattleStart', ({ player1, player2 }) => {
            this.state.isBattling = true;
            this.state.logs = [];
            this.state.currentRound = 0;
            this.state.apState = { p1: 0, p2: 0 };
            this.state.player1 = player1;
            this.state.player2 = player2;
            this.state.battleResult = null;
            this.notify(['isBattling', 'logs', 'currentRound', 'apState', 'player1', 'player2', 'battleResult']);
        });

        globalEventBus.on('onRoundStart', ({ round }) => {
            this.state.currentRound = round;
            this.notify(['currentRound']);
        });

        globalEventBus.on(BattleEvents.PLAYER_INFO_UPDATE, ({ player1, player2 }) => {
            this.state.player1 = player1;
            this.state.player2 = player2;
            this.notify(['player1', 'player2']);
        });

        globalEventBus.on(BattleEvents.LOG_APPEND, (payload) => {
            this.state.logs.push(payload);
            this.notify(['logs']);
        });

        globalEventBus.on(BattleEvents.TURN_UPDATE, ({ apState }) => {
            if (apState) {
                this.state.apState = apState;
                this.notify(['apState']);
            }
        });

        globalEventBus.on('onBattleEnd', (payload) => {
            this.state.isBattling = false;
            this.state.battleResult = payload;
            this.notify(['isBattling', 'battleResult']);
        });
    }
}

export const battleStore = new BattleStore();
