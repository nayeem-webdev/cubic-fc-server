import Player from "../models/Player.js";
import Score from "../models/Score.js";
import Team from "../models/Team.js";
import Match from "../models/Match.js";

// ============================================================
// UPDATE PLAYER
// ============================================================

const updatePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!player) {
      return res.status(404).json({
        message: "Player not found",
      });
    }

    res.status(200).json(player);
  } catch (error) {
    console.error("Error updating player:", error);

    res.status(500).json({
      message: "Failed to update player",
      error: error.message,
    });
  }
};

// ============================================================
// DEFENSIVE POINT CALCULATORS
// ============================================================

// GK - Maximum 8 points
const getGKPoints = (goalsConceded) => {
  if (goalsConceded <= 0) return 8;
  if (goalsConceded <= 2) return 6;
  if (goalsConceded <= 4) return 4;
  if (goalsConceded <= 6) return 2;
  return 0;
};

// DF - Maximum 5 points
const getDefenderPoints = (goalsConceded) => {
  if (goalsConceded <= 0) return 5;
  if (goalsConceded <= 2) return 4;
  if (goalsConceded <= 4) return 2.5;
  if (goalsConceded <= 6) return 1.5;

  return 0;
};

// ============================================================
// GET ALL PLAYERS WITH TEAM + STATISTICS
// ============================================================

const getPlayers = async (req, res) => {
  try {
    // --------------------------------------------------------
    // 1. GET PLAYERS
    // --------------------------------------------------------

    const players = await Player.find().sort({ createdAt: -1 }).lean();

    // --------------------------------------------------------
    // 2. GET TEAMS
    // --------------------------------------------------------

    const teams = await Team.find().select("_id name logoLow").lean();

    const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));

    // --------------------------------------------------------
    // 3. GET MATCHES
    //
    // matchSchedule is included so we can calculate
    // the player's LAST 5 matches correctly.
    // --------------------------------------------------------

    const matches = await Match.find()
      .select(
        "_id " +
          "homeTeam " +
          "awayTeam " +
          "matchSchedule " +
          "homeStartingPlayers " +
          "homeSubstitutes " +
          "awayStartingPlayers " +
          "awaySubstitutes",
      )
      .sort({ matchSchedule: 1 })
      .lean();

    // Quick Match lookup
    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match]),
    );

    // --------------------------------------------------------
    // 4. GET SCORES
    // --------------------------------------------------------

    const scores = await Score.find()
      .select(
        "match " +
          "homeTeam " +
          "awayTeam " +
          "homeScore " +
          "awayScore " +
          "matchEvents",
      )
      .lean();

    // --------------------------------------------------------
    // 5. INITIALIZE PLAYER STATISTICS
    // --------------------------------------------------------

    const playerStats = new Map();

    players.forEach((player) => {
      playerStats.set(player._id.toString(), {
        appearances: 0,

        goals: 0,
        regularGoals: 0,
        penaltyGoals: 0,

        assists: 0,

        ownGoals: 0,

        yellowCards: 0,
        redCards: 0,

        // Defensive points accumulated
        defensivePoints: 0,

        // Winning points
        winPoints: 0,

        // Match results for this player
        matchResults: [],

        // Final total points
        playerScore: 0,
      });
    });

    // --------------------------------------------------------
    // 6. PROCESS EVERY SCORE / MATCH
    // --------------------------------------------------------

    scores.forEach((score) => {
      const matchId = score.match?.toString();

      if (!matchId) {
        return;
      }

      const match = matchMap.get(matchId);

      // Score exists but corresponding Match does not
      if (!match) {
        return;
      }

      // ------------------------------------------------------
      // TEAM IDS
      // ------------------------------------------------------
      /*
      const homeTeamId = match.homeTeam?.toString();
      const awayTeamId = match.awayTeam?.toString();
      */
      // ------------------------------------------------------
      // SCORES
      // ------------------------------------------------------

      const homeScore = Number(score.homeScore || 0);
      const awayScore = Number(score.awayScore || 0);

      // ------------------------------------------------------
      // DETERMINE MATCH RESULT
      // ------------------------------------------------------

      let homeResult = "D";
      let awayResult = "D";

      if (homeScore > awayScore) {
        homeResult = "W";
        awayResult = "L";
      }

      if (homeScore < awayScore) {
        homeResult = "L";
        awayResult = "W";
      }

      // ------------------------------------------------------
      // PLAYERS
      // ------------------------------------------------------

      const homePlayers = [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
      ];

      const awayPlayers = [
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ];

      // ======================================================
      // HOME TEAM PLAYERS
      // ======================================================

      const homeUniquePlayers = new Set();

      homePlayers.forEach((playerId) => {
        const id = playerId?._id
          ? playerId._id.toString()
          : playerId?.toString();

        if (!id) {
          return;
        }

        if (!playerStats.has(id)) {
          return;
        }

        if (homeUniquePlayers.has(id)) {
          return;
        }

        homeUniquePlayers.add(id);

        const stats = playerStats.get(id);

        // ----------------------------------------------------
        // APPEARANCE
        // ----------------------------------------------------

        stats.appearances += 1;

        // ----------------------------------------------------
        // MATCH RESULT
        // ----------------------------------------------------

        stats.matchResults.push({
          matchId,
          date: match.matchSchedule || null,
          result: homeResult,
        });

        // ----------------------------------------------------
        // WIN POINTS
        // ----------------------------------------------------

        if (homeResult === "W") {
          stats.winPoints += 2;
        }

        // ----------------------------------------------------
        // DEFENSIVE POINTS
        // ----------------------------------------------------

        const player = players.find((p) => p._id.toString() === id);

        if (!player) {
          return;
        }

        const goalsConceded = awayScore;

        if (player.position === "GK") {
          stats.defensivePoints += getGKPoints(goalsConceded);
        }

        if (player.position === "DF") {
          stats.defensivePoints += getDefenderPoints(goalsConceded);
        }
      });

      // ======================================================
      // AWAY TEAM PLAYERS
      // ======================================================

      const awayUniquePlayers = new Set();

      awayPlayers.forEach((playerId) => {
        const id = playerId?._id
          ? playerId._id.toString()
          : playerId?.toString();

        if (!id) {
          return;
        }

        if (!playerStats.has(id)) {
          return;
        }

        if (awayUniquePlayers.has(id)) {
          return;
        }

        awayUniquePlayers.add(id);

        const stats = playerStats.get(id);

        // ----------------------------------------------------
        // APPEARANCE
        // ----------------------------------------------------

        stats.appearances += 1;

        // ----------------------------------------------------
        // MATCH RESULT
        // ----------------------------------------------------

        stats.matchResults.push({
          matchId,
          date: match.matchSchedule || null,
          result: awayResult,
        });

        // ----------------------------------------------------
        // WIN POINTS
        // ----------------------------------------------------

        if (awayResult === "W") {
          stats.winPoints += 2;
        }

        // ----------------------------------------------------
        // DEFENSIVE POINTS
        // ----------------------------------------------------

        const player = players.find((p) => p._id.toString() === id);

        if (!player) {
          return;
        }

        const goalsConceded = homeScore;

        if (player.position === "GK") {
          stats.defensivePoints += getGKPoints(goalsConceded);
        }

        if (player.position === "DF") {
          stats.defensivePoints += getDefenderPoints(goalsConceded);
        }
      });

      // ======================================================
      // PROCESS MATCH EVENTS
      // ======================================================

      (score.matchEvents || []).forEach((event) => {
        const scorerId = event.scorer?.toString();
        const assisterId = event.assister?.toString();
        const playerId = event.player?.toString();

        // ----------------------------------------------------
        // REGULAR GOAL
        // ----------------------------------------------------

        if (event.type === "goal") {
          // Goal scorer
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.regularGoals += 1;
          }

          // Assist
          if (assisterId && playerStats.has(assisterId)) {
            const stats = playerStats.get(assisterId);

            stats.assists += 1;
          }
        }

        // ----------------------------------------------------
        // PENALTY GOAL
        // ----------------------------------------------------

        if (event.type === "penalty") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.penaltyGoals += 1;
          }

          // No assist for penalty
        }

        // ----------------------------------------------------
        // OWN GOAL
        // ----------------------------------------------------

        if (event.type === "ownGoal") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.ownGoals += 1;
          }
        }

        // ----------------------------------------------------
        // CARD
        //
        // Yellow = -1
        // Red = -2
        // ----------------------------------------------------

        if (event.type === "card") {
          if (playerId && playerStats.has(playerId)) {
            const stats = playerStats.get(playerId);

            if (event.card === "yellow") {
              stats.yellowCards += 1;
            }

            if (event.card === "red") {
              stats.redCards += 1;
            }
          }
        }
      });
    });

    // --------------------------------------------------------
    // 7. BUILD FINAL PLAYER RESPONSE
    // --------------------------------------------------------

    const result = players.map((player) => {
      const playerId = player._id.toString();

      const stats = playerStats.get(playerId) || {
        appearances: 0,

        goals: 0,
        regularGoals: 0,
        penaltyGoals: 0,

        assists: 0,

        ownGoals: 0,

        yellowCards: 0,
        redCards: 0,

        defensivePoints: 0,

        winPoints: 0,

        matchResults: [],

        playerScore: 0,
      };

      // ======================================================
      // SORT PLAYER MATCHES
      //
      // Oldest -> newest
      // ======================================================

      stats.matchResults.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;

        const dateB = b.date ? new Date(b.date).getTime() : 0;

        return dateA - dateB;
      });

      // ======================================================
      // LAST 5 MATCHES
      //
      // Latest 5 matches only
      // ======================================================

      const last5Matches = stats.matchResults.slice(-5);

      // ======================================================
      // LAST 5 RESULTS
      // ======================================================

      const last5 = last5Matches.map((match) => match.result);

      // ======================================================
      // LAST 5 WINS
      // ======================================================

      const winsLast5 = last5Matches.filter(
        (match) => match.result === "W",
      ).length;

      // ======================================================
      // TOTAL WINS / DRAWS / LOSSES
      // ======================================================

      const wins = stats.matchResults.filter(
        (match) => match.result === "W",
      ).length;

      const draws = stats.matchResults.filter(
        (match) => match.result === "D",
      ).length;

      const losses = stats.matchResults.filter(
        (match) => match.result === "L",
      ).length;

      // ======================================================
      // WIN RATE
      // ======================================================

      const winRate =
        stats.appearances > 0
          ? Number(((wins / stats.appearances) * 100).toFixed(1))
          : 0;

      // ======================================================
      // CURRENT WINNING STREAK
      //
      // Start from latest match and count backwards
      // until a draw/loss appears.
      // ======================================================

      let currentWinStreak = 0;

      for (let i = stats.matchResults.length - 1; i >= 0; i--) {
        if (stats.matchResults[i].result === "W") {
          currentWinStreak += 1;
        } else {
          break;
        }
      }

      // ======================================================
      // CALCULATE TOTAL PLAYER POINTS
      // ======================================================
      //
      // Appearance     = +0.5
      // Win            = +2
      // Regular goal   = +2
      // Penalty goal   = +1
      // Assist         = +1
      // Own goal       = -1
      // Yellow card    = -1
      // Red card       = -2
      //
      // GK:
      // Defensive points up to 8 per match
      //
      // DF:
      // Defensive points up to 5 per match
      //
      // MF / ST / FW:
      // No defensive points
      // ======================================================

      stats.playerScore =
        stats.appearances * 0.5 +
        stats.winPoints +
        stats.regularGoals * 2 +
        stats.penaltyGoals * 1 +
        stats.assists * 1 +
        stats.ownGoals * -1 +
        stats.yellowCards * -1 +
        stats.redCards * -2 +
        stats.defensivePoints;

      // ======================================================
      // GET PLAYER TEAM
      // ======================================================

      const team = player.playsFor
        ? teamMap.get(player.playsFor.toString())
        : null;

      // ======================================================
      // RETURN PLAYER
      // ======================================================

      return {
        ...player,

        playsFor: team
          ? {
              _id: team._id,
              name: team.name,
              logoLow: team.logoLow,
            }
          : null,

        stats: {
          // --------------------------------------------------
          // MATCH RECORD
          // --------------------------------------------------

          appearances: stats.appearances,

          wins,
          draws,
          losses,

          winRate,

          last5,
          winsLast5,
          currentWinStreak,

          // --------------------------------------------------
          // SCORING
          // --------------------------------------------------

          goals: stats.goals,
          regularGoals: stats.regularGoals,
          penaltyGoals: stats.penaltyGoals,

          assists: stats.assists,

          ownGoals: stats.ownGoals,

          yellowCards: stats.yellowCards,
          redCards: stats.redCards,

          // --------------------------------------------------
          // POINTS
          // --------------------------------------------------

          winPoints: stats.winPoints,
          defensivePoints: stats.defensivePoints,

          playerScore: stats.playerScore,
        },
      };
    });

    // --------------------------------------------------------
    // 8. SEND RESPONSE
    // --------------------------------------------------------

    res.status(200).json(result);
  } catch (error) {
    console.error("Get players error:", error);

    res.status(500).json({
      message: "Failed to get players",
      error: error.message,
    });
  }
};

export { updatePlayer, getPlayers };
