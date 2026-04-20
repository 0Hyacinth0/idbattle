export class TournamentMatch {
    constructor(id, p1, p2, round) {
        this.id = id;
        this.p1 = p1; // player id/name or null if TBD
        this.p2 = p2; // player id/name or null if TBD
        this.round = round;
        this.winner = null;
        this.loser = null;
        this.state = 'pending'; // pending, mapping, active, completed
        // Additional info for rendering
        this.p1Score = 0;
        this.p2Score = 0;
    }

    complete(winnerId, loserId, p1Score = 0, p2Score = 0) {
        this.winner = winnerId;
        this.loser = loserId;
        this.p1Score = p1Score;
        this.p2Score = p2Score;
        this.state = 'completed';
    }
}

export class TournamentGroup {
    constructor(name) {
        this.name = name;
        this.standings = []; // Array of { id: string, points: number, wins: number, losses: number, matchesPlayed: number }
        this.schedule = []; // Array of TournamentMatch
    }
}
