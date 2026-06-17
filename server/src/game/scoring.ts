import { GameState, Player, RoundResult } from '../../../shared/types';

/**
 * Score a completed round.
 *
 * Points awarded:
 *   - Makers win 3–4 tricks: 1 point to maker team
 *   - Makers win all 5 tricks (no alone): 2 points to maker team
 *   - Euchred (makers win < 3 tricks): 2 points to defending team
 *   - Going alone, win all 5: 4 points to maker team
 *   - Going alone, win 3–4: 1 point to maker team
 *   - Going alone, euchred: 2 points to defending team
 */
export function scoreRound(state: GameState): RoundResult {
  if (state.trump === null) throw new Error('Trump not set');
  if (state.maker === null) throw new Error('Maker not set');

  const makerPlayer = state.players.find((p) => p.id === state.maker);
  if (!makerPlayer) throw new Error('Maker player not found');

  const makerTeam = makerPlayer.teamId;
  const defenderTeam: 0 | 1 = makerTeam === 0 ? 1 : 0;

  const makerTeamTricks = state.roundTricks[makerTeam];
  const defenderTeamTricks = state.roundTricks[defenderTeam];

  const wentAlone = state.goingAlone;
  const wasEuchre = makerTeamTricks < 3;
  const wonAllFive = makerTeamTricks === 5;

  let pointsScored: number;
  let scoringTeam: 0 | 1;

  if (wasEuchre) {
    pointsScored = 2;
    scoringTeam = defenderTeam;
  } else if (wentAlone && wonAllFive) {
    pointsScored = 4;
    scoringTeam = makerTeam;
  } else if (wonAllFive) {
    pointsScored = 2;
    scoringTeam = makerTeam;
  } else {
    // Makers took 3 or 4 tricks
    pointsScored = 1;
    scoringTeam = makerTeam;
  }

  return {
    makerTeam,
    makerTeamTricks,
    defenderTeamTricks,
    pointsScored,
    scoringTeam,
    wasEuchre,
    wentAlone,
    wonAllFive,
  };
}

/**
 * Apply a round result to the current scores.
 * Returns updated scores [team0, team1].
 */
export function applyRoundScore(
  currentScores: [number, number],
  result: RoundResult
): [number, number] {
  const updated: [number, number] = [...currentScores] as [number, number];
  updated[result.scoringTeam] += result.pointsScored;
  return updated;
}

/**
 * Returns true if either team has reached 10 points.
 */
export function isGameOver(scores: [number, number]): boolean {
  return scores[0] >= 10 || scores[1] >= 10;
}

/**
 * Returns the winning team index, or null if game is not over.
 */
export function getWinner(scores: [number, number]): 0 | 1 | null {
  if (scores[0] >= 10) return 0;
  if (scores[1] >= 10) return 1;
  return null;
}
