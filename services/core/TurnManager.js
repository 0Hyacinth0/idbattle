export class TurnManager {
    constructor(randomFn) {
        this.ap = { p1: 0, p2: 0 };
        this.actionCount = 0;
        this.round = 0;
        this.enrageMultiplier = 1.0;
        this.enrageHealPenalty = 1.0;
        this.randomFn = randomFn || Math.random;
    }

    reset() {
        this.ap = { p1: 0, p2: 0 };
        this.actionCount = 0;
        this.round = 0;
        this.enrageMultiplier = 1.0;
        this.enrageHealPenalty = 1.0;
    }

    advanceAction() {
        this.actionCount++;
        const newRound = Math.floor((this.actionCount - 1) / 2) + 1;
        let isNewRound = false;

        if (newRound > this.round) {
            this.round = newRound;
            this.updateEnrage();
            isNewRound = true;
        }

        return isNewRound;
    }

    updateEnrage() {
        if (this.round > 50) {
            const stacks = this.round - 50;
            this.enrageMultiplier = 1.0 + (stacks * 0.10);
            this.enrageHealPenalty = Math.max(0, 1.0 - (stacks * 0.05));
        }
    }

    getEnrageState() {
        return {
            multiplier: this.enrageMultiplier,
            healPenalty: this.enrageHealPenalty,
            stacks: Math.max(0, this.round - 50)
        };
    }

    getAttackerAndDefender(player1, player2) {
        let attacker = null;

        while (!attacker) {
            this.ap.p1 += player1.speed;
            this.ap.p2 += player2.speed;

            if (this.ap.p1 >= 1000 && this.ap.p2 >= 1000) {
                if (this.ap.p1 === this.ap.p2) {
                    attacker = this.randomFn() < 0.5 ? player1 : player2;
                } else {
                    attacker = this.ap.p1 > this.ap.p2 ? player1 : player2;
                }
            } else if (this.ap.p1 >= 1000) {
                attacker = player1;
            } else if (this.ap.p2 >= 1000) {
                attacker = player2;
            }
        }

        const defender = attacker === player1 ? player2 : player1;

        // Capture AP state before deduction for UI animation (cap at 1000 for display)
        const apState = {
            p1: Math.min(this.ap.p1, 1000),
            p2: Math.min(this.ap.p2, 1000)
        };

        if (attacker === player1) this.ap.p1 -= 1000;
        if (attacker === player2) this.ap.p2 -= 1000;

        return { attacker, defender, apState };
    }
}
