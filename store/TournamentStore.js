export class TournamentStore {
    constructor() {
        this.listeners = [];
        this.reset();
    }

    reset() {
        this.phase = 'registration'; // registration, group_stage, bracket_stage, finished
        this.participants = []; // array of player names/ids
        this.groups = {
            A: null, // TournamentGroup
            B: null
        };
        this.bracket = {
            winners: [], // 2D array: matches by round
            losers: [],  // 2D array: matches by round
            grandFinal: null,
            resetMatch: null // if losers bracket winner wins grand final
        };
        this.currentMatch = null;
        this.notify();
    }

    addParticipant(name) {
        if (!name || name.trim() === '') return false;
        if (!this.participants.includes(name)) {
            this.participants.push(name);
            this.notify();
            return true;
        }
        return false;
    }

    removeParticipant(name) {
        this.participants = this.participants.filter(p => p !== name);
        this.notify();
    }

    setPhase(phase) {
        this.phase = phase;
        this.notify();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }
}

export const tournamentStore = new TournamentStore();
