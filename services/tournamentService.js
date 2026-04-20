import { tournamentStore } from '../store/TournamentStore.js';
import { TournamentGroup, TournamentMatch } from '../models/tournament.js';
import { BattleService } from './battleService.js';
import { generateAttributes } from '../models/player.js';
import { getPlayerConfig } from '../utils/storage.js';
import globalEventBus from '../utils/EventBus.js';

export function initTournament(participants) {
    if (!participants || participants.length < 2) return;

    // 1. Shuffle
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // 2. Split into two groups
    const half = Math.ceil(shuffled.length / 2);
    const groupAPlayers = shuffled.slice(0, half);
    const groupBPlayers = shuffled.slice(half);

    const groupA = new TournamentGroup('A');
    const groupB = new TournamentGroup('B');

    // Initialize standings
    const initStandings = (players) => players.map(id => ({
        id, points: 0, wins: 0, losses: 0, matchesPlayed: 0
    }));

    groupA.standings = initStandings(groupAPlayers);
    groupB.standings = initStandings(groupBPlayers);

    // 3. Generate Schedules
    groupA.schedule = generateRoundRobin(groupAPlayers, 'A');
    groupB.schedule = generateRoundRobin(groupBPlayers, 'B');

    tournamentStore.groups.A = groupA;
    tournamentStore.groups.B = groupB;
    tournamentStore.setPhase('group_stage');
}

export function getAllGroupMatches() {
    return [
        ...tournamentStore.groups.A.schedule,
        ...tournamentStore.groups.B.schedule
    ];
}

export async function simulateMatchFast(matchId) {
    const match = findMatchById(matchId);
    if (!match || match.p1 === 'BYE' || match.p2 === 'BYE' || match.state !== 'pending') return;

    match.state = 'active';

    const p1Conf = getPlayerConfig(match.p1) || undefined;
    const p2Conf = getPlayerConfig(match.p2) || undefined;
    const player1 = generateAttributes(match.p1, p1Conf);
    const player2 = generateAttributes(match.p2, p2Conf);

    const battleService = new BattleService();
    battleService.isSilent = true;
    battleService.isSkipping = true;
    battleService.setPlayers(player1, player2);

    await battleService.battle();

    const isP1Win = player1.health > player2.health;
    const winnerId = isP1Win ? match.p1 : match.p2;
    const loserId = isP1Win ? match.p2 : match.p1;

    match.complete(winnerId, loserId, Math.floor(player1.health), Math.floor(player2.health));

    if (tournamentStore.phase === 'group_stage') {
        updateGroupStandings(matchId);
    } else if (tournamentStore.phase === 'bracket_stage') {
        advanceBracketWinner(match);
        processBracketByes();
    }
    tournamentStore.notify();
}

export function watchMatch(matchId) {
    const match = findMatchById(matchId);
    if (!match || match.p1 === 'BYE' || match.p2 === 'BYE' || match.state !== 'pending') return;

    tournamentStore.currentMatch = matchId;
    match.state = 'active';

    // Switch to battle view
    const battleBtnTab = document.getElementById('view-button-battle');
    if (battleBtnTab) battleBtnTab.click();

    // Set inputs
    document.getElementById('player1').value = match.p1;
    document.getElementById('player2').value = match.p2;

    // Start battle automatically
    const startBtn = document.getElementById('battle-btn');
    if (startBtn) startBtn.click();
}

// Listen to global battle ends to capture watched tournament matches
globalEventBus.on('onBattleEnd', (payload) => {
    if (tournamentStore.currentMatch) {
        const matchId = tournamentStore.currentMatch;
        const match = findMatchById(matchId);
        if (match && match.state === 'active') {
            const isP1Win = payload.winner && payload.winner.name === match.p1;
            const winnerId = isP1Win ? match.p1 : match.p2;
            const loserId = isP1Win ? match.p2 : match.p1;

            match.complete(winnerId, loserId, Math.floor(payload.player1.health), Math.floor(payload.player2.health));

            if (tournamentStore.phase === 'group_stage') {
                updateGroupStandings(matchId);
            } else if (tournamentStore.phase === 'bracket_stage') {
                advanceBracketWinner(match);
                processBracketByes();
            }

            tournamentStore.currentMatch = null;
            tournamentStore.notify();
        }
    }
});

function findMatchById(matchId) {
    if (tournamentStore.groups.A) {
        let match = tournamentStore.groups.A.schedule.find(m => m.id === matchId);
        if (match) return match;
    }
    if (tournamentStore.groups.B) {
        let match = tournamentStore.groups.B.schedule.find(m => m.id === matchId);
        if (match) return match;
    }

    // Check bracket
    const { winners, losers, grandFinal, resetMatch } = tournamentStore.bracket;
    let match = winners.find(m => m.id === matchId);
    if (match) return match;

    match = losers.find(m => m.id === matchId);
    if (match) return match;

    if (grandFinal && grandFinal.id === matchId) return grandFinal;
    if (resetMatch && resetMatch.id === matchId) return resetMatch;

    return null;
}

function updateGroupStandings(matchId) {
    const match = findMatchById(matchId);
    if (!match || match.state !== 'completed') return;

    const group = matchId.startsWith('A-') ? tournamentStore.groups.A : tournamentStore.groups.B;

    const p1Record = group.standings.find(s => s.id === match.p1);
    const p2Record = group.standings.find(s => s.id === match.p2);

    if (match.winner === match.p1) {
        // e.g. 3 points for win
        p1Record.points += 3;
        p1Record.wins += 1;
        p2Record.losses += 1;
    } else {
        p2Record.points += 3;
        p2Record.wins += 1;
        p1Record.losses += 1;
    }

    p1Record.matchesPlayed += 1;
    p2Record.matchesPlayed += 1;

    // Sort standings: Points > Wins > matchesPlayed? 
    // Usually Points, then head-to-head. For simplicity Points -> Wins
    group.standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.wins - a.wins;
    });
}

// ... existing helper functions ...

export function transitionToBracket() {
    const groupA = tournamentStore.groups.A.standings;
    const groupB = tournamentStore.groups.B.standings;

    // We will use a standard 16-player Double Elimination Bracket.
    // Seeds 1-4 from A and B go to Winner's Bracket.
    // Seeds 5-8 from A and B go to Loser's Bracket R1.
    // Anyone below 8th is eliminated.
    // If a seed doesn't exist (e.g., group only has 6 players), it's a 'BYE'.

    const getSeed = (group, rank) => {
        if (group.length >= rank) return group[rank - 1].id;
        return 'BYE';
    };

    const wMatches = [];
    const lMatches = [];

    // Winner's Bracket Round 1 (W-R1)
    // W1: A1 vs B4
    wMatches.push(new TournamentMatch('W1', getSeed(groupA, 1), getSeed(groupB, 4), 'W-R1'));
    // W2: B2 vs A3
    wMatches.push(new TournamentMatch('W2', getSeed(groupB, 2), getSeed(groupA, 3), 'W-R1'));
    // W3: B1 vs A4
    wMatches.push(new TournamentMatch('W3', getSeed(groupB, 1), getSeed(groupA, 4), 'W-R1'));
    // W4: A2 vs B3
    wMatches.push(new TournamentMatch('W4', getSeed(groupA, 2), getSeed(groupB, 3), 'W-R1'));

    // Winner's subsequent rounds (placeholders)
    wMatches.push(new TournamentMatch('W5', null, null, 'W-R2'));
    wMatches.push(new TournamentMatch('W6', null, null, 'W-R2'));
    wMatches.push(new TournamentMatch('W7', null, null, 'W-R3'));

    // Loser's Bracket Round 1 (L-R1)
    // L1: A6 vs B7
    lMatches.push(new TournamentMatch('L1', getSeed(groupA, 6), getSeed(groupB, 7), 'L-R1'));
    // L2: B6 vs A7
    lMatches.push(new TournamentMatch('L2', getSeed(groupB, 6), getSeed(groupA, 7), 'L-R1'));

    // The rest of Loser's bracket is populated dynamically as matches finish.
    // We create placeholders for the structural nodes.
    // L-R2 (absorbs W1-W4 losers and A5, B5)
    lMatches.push(new TournamentMatch('L3', null, getSeed(groupB, 5), 'L-R2')); // W1 loser vs B5
    lMatches.push(new TournamentMatch('L4', null, null, 'L-R2')); // W2 loser vs L1 winner
    lMatches.push(new TournamentMatch('L5', null, getSeed(groupA, 5), 'L-R2')); // W3 loser vs A5
    lMatches.push(new TournamentMatch('L6', null, null, 'L-R2')); // W4 loser vs L2 winner

    // L-R3
    lMatches.push(new TournamentMatch('L7', null, null, 'L-R3')); // L3 win vs L4 win
    lMatches.push(new TournamentMatch('L8', null, null, 'L-R3')); // L5 win vs L6 win

    // L-R4 (absorbs W5-W6 losers)
    lMatches.push(new TournamentMatch('L9', null, null, 'L-R4')); // W6 loser vs L7 winner
    lMatches.push(new TournamentMatch('L10', null, null, 'L-R4')); // W5 loser vs L8 winner

    // L-R5
    lMatches.push(new TournamentMatch('L11', null, null, 'L-R5')); // L9 win vs L10 win

    // L-R6 (absorbs W7 loser)
    lMatches.push(new TournamentMatch('L12', null, null, 'L-R6')); // W7 loser vs L11 winner

    const grandFinal = new TournamentMatch('GF1', null, null, 'Grand-Final');
    const resetMatch = new TournamentMatch('GF2', null, null, 'Bracket-Reset');

    tournamentStore.bracket.winners = wMatches;
    tournamentStore.bracket.losers = lMatches;
    tournamentStore.bracket.grandFinal = grandFinal;
    tournamentStore.bracket.resetMatch = resetMatch;

    tournamentStore.setPhase('bracket_stage');

    // Auto-advance BYEs in bracket
    processBracketByes();
}

function processBracketByes() {
    const allMatches = [...tournamentStore.bracket.winners, ...tournamentStore.bracket.losers];
    let changed = false;

    for (const match of allMatches) {
        if (match.state === 'pending' && match.p1 !== null && match.p2 !== null) {
            if (match.p1 === 'BYE' || match.p2 === 'BYE') {
                const winner = match.p1 === 'BYE' ? match.p2 : match.p1;
                const loser = 'BYE';
                match.complete(winner, loser, 0, 0);
                changed = true;
                advanceBracketWinner(match);
            }
        }
    }

    if (changed) {
        processBracketByes(); // Recursively process new BYE matchups
    } else {
        tournamentStore.notify();
    }
}

function advanceBracketWinner(match) {
    const wBracket = tournamentStore.bracket.winners;
    const lBracket = tournamentStore.bracket.losers;
    const gf = tournamentStore.bracket.grandFinal;

    const setPlayer = (targetMatchId, isP1, player) => {
        const target = [...wBracket, ...lBracket, gf].find(m => m.id === targetMatchId);
        if (target) {
            if (isP1) target.p1 = player;
            else target.p2 = player;
        }
    };

    // Progression logic
    if (match.id === 'W1') { setPlayer('W5', true, match.winner); setPlayer('L3', true, match.loser); }
    if (match.id === 'W2') { setPlayer('W5', false, match.winner); setPlayer('L4', true, match.loser); }
    if (match.id === 'W3') { setPlayer('W6', true, match.winner); setPlayer('L5', true, match.loser); }
    if (match.id === 'W4') { setPlayer('W6', false, match.winner); setPlayer('L6', true, match.loser); }

    if (match.id === 'W5') { setPlayer('W7', true, match.winner); setPlayer('L10', true, match.loser); }
    if (match.id === 'W6') { setPlayer('W7', false, match.winner); setPlayer('L9', true, match.loser); }

    if (match.id === 'W7') { setPlayer('GF1', true, match.winner); setPlayer('L12', true, match.loser); }

    // Loser Bracket Progression
    if (match.id === 'L1') setPlayer('L4', false, match.winner);
    if (match.id === 'L2') setPlayer('L6', false, match.winner);

    if (match.id === 'L3') setPlayer('L7', true, match.winner);
    if (match.id === 'L4') setPlayer('L7', false, match.winner);
    if (match.id === 'L5') setPlayer('L8', true, match.winner);
    if (match.id === 'L6') setPlayer('L8', false, match.winner);

    if (match.id === 'L7') setPlayer('L9', false, match.winner); // bottom slot
    if (match.id === 'L8') setPlayer('L10', false, match.winner); // bottom slot

    if (match.id === 'L9') setPlayer('L11', true, match.winner);
    if (match.id === 'L10') setPlayer('L11', false, match.winner);

    if (match.id === 'L11') setPlayer('L12', false, match.winner);
    if (match.id === 'L12') setPlayer('GF1', false, match.winner);

    if (match.id === 'GF1') {
        const resetMatch = tournamentStore.bracket.resetMatch;
        // If Loser Bracket winner (which is p2 in GF1) wins GF1, trigger reset match
        if (match.winner === match.p2 && match.p2 !== 'BYE') {
            resetMatch.p1 = match.p1;
            resetMatch.p2 = match.p2;
        } else {
            // Tournament is over!
            tournamentStore.setPhase('finished');
        }
    }

    if (match.id === 'GF2') {
        tournamentStore.setPhase('finished');
    }
}

function generateRoundRobin(players, groupId) {
    const isOdd = players.length % 2 !== 0;
    const competitors = [...players];
    if (isOdd) competitors.push('BYE'); // 'BYE' indicates a dummy resting round player

    const numRounds = competitors.length - 1;
    const halfSize = competitors.length / 2;
    const schedule = [];
    let matchIdCounter = 1;

    for (let round = 1; round <= numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
            const p1 = competitors[i];
            const p2 = competitors[competitors.length - 1 - i];

            if (p1 !== 'BYE' && p2 !== 'BYE') {
                schedule.push(new TournamentMatch(
                    `${groupId}-${matchIdCounter++}`,
                    p1,
                    p2,
                    round
                ));
            }
        }

        // Rotate competitors for next round
        // Keep the first element fixed, rotate the rest clockwise
        competitors.splice(1, 0, competitors.pop());
    }

    return schedule;
}
