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

// GK - Maximum 10 points
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
  if (goalsConceded === 1) return 4.5;
  if (goalsConceded === 2) return 4;
  if (goalsConceded === 3) return 3.5;
  if (goalsConceded === 4) return 3;
  if (goalsConceded === 5) return 2.5;
  if (goalsConceded === 6) return 2;
  if (goalsConceded === 7) return 1.5;
  if (goalsConceded === 8) return 1;
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
    // Starting players and substitutes now come from MATCH,
    // not SCORE.
    // --------------------------------------------------------

    const matches = await Match.find()
      .select(
        "_id " +
          "homeTeam " +
          "awayTeam " +
          "homeStartingPlayers " +
          "homeSubstitutes " +
          "awayStartingPlayers " +
          "awaySubstitutes",
      )
      .lean();

    // Quick Match lookup
    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match]),
    );

    // --------------------------------------------------------
    // 4. GET SCORES
    //
    // Score contains:
    // - match
    // - homeScore
    // - awayScore
    // - matchEvents
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

        // Total defensive points accumulated
        // across all matches
        defensivePoints: 0,

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

      const homePlayers = [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
      ];

      const awayPlayers = [
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ];

      // ------------------------------------------------------
      // HOME TEAM PLAYERS
      // ------------------------------------------------------

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

        // Appearance
        stats.appearances += 1;

        // -----------------------------------------------
        // DEFENSIVE POINTS
        // -----------------------------------------------

        const player = players.find((p) => p._id.toString() === id);

        if (!player) {
          return;
        }

        const goalsConceded = Number(score.awayScore || 0);

        if (player.position === "GK") {
          stats.defensivePoints += getGKPoints(goalsConceded);
        }

        if (player.position === "DF") {
          stats.defensivePoints += getDefenderPoints(goalsConceded);
        }
      });

      // ------------------------------------------------------
      // AWAY TEAM PLAYERS
      // ------------------------------------------------------

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

        // Appearance
        stats.appearances += 1;

        // -----------------------------------------------
        // DEFENSIVE POINTS
        // -----------------------------------------------

        const player = players.find((p) => p._id.toString() === id);

        if (!player) {
          return;
        }

        const goalsConceded = Number(score.homeScore || 0);

        if (player.position === "GK") {
          stats.defensivePoints += getGKPoints(goalsConceded);
        }

        if (player.position === "DF") {
          stats.defensivePoints += getDefenderPoints(goalsConceded);
        }
      });

      // ------------------------------------------------------
      // 7. PROCESS MATCH EVENTS
      // ------------------------------------------------------

      (score.matchEvents || []).forEach((event) => {
        const scorerId = event.scorer?.toString();
        const assisterId = event.assister?.toString();
        const playerId = event.player?.toString();

        // ====================================================
        // REGULAR GOAL
        // ====================================================

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

        // ====================================================
        // PENALTY GOAL
        // ====================================================

        if (event.type === "penalty") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.penaltyGoals += 1;
          }

          // No assist for penalty
        }

        // ====================================================
        // OWN GOAL
        //
        // Own goal:
        // - +1 own goal statistic
        // - -1 point
        // ====================================================

        if (event.type === "ownGoal") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.ownGoals += 1;
          }
        }

        // ====================================================
        // CARD
        //
        // Yellow = -2
        // Red = -2
        // ====================================================

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
    // 8. BUILD FINAL PLAYER RESPONSE
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

        playerScore: 0,
      };

      // ------------------------------------------------------
      // CALCULATE TOTAL PLAYER POINTS
      // ------------------------------------------------------
      //
      // Appearance     = +0.5
      // Regular goal   = +2
      // Penalty goal   = +1
      // Assist         = +1
      // Own goal       = -1
      // Yellow card    = -2
      // Red card       = -2
      //
      // GK:
      // Defensive points up to 10 per match
      //
      // DF:
      // Defensive points up to 6 per match
      //
      // MF / ST / FW:
      // No defensive points
      // ------------------------------------------------------

      stats.playerScore =
        stats.appearances * 0.5 +
        stats.regularGoals * 2 +
        stats.penaltyGoals * 1 +
        stats.assists * 1 +
        stats.ownGoals * -1 +
        stats.yellowCards * -1 +
        stats.redCards * -2 +
        stats.defensivePoints;

      // ------------------------------------------------------
      // GET PLAYER TEAM
      // ------------------------------------------------------

      const team = player.playsFor
        ? teamMap.get(player.playsFor.toString())
        : null;

      // ------------------------------------------------------
      // RETURN PLAYER
      // ------------------------------------------------------

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
          appearances: stats.appearances,

          goals: stats.goals,
          regularGoals: stats.regularGoals,
          penaltyGoals: stats.penaltyGoals,

          assists: stats.assists,

          ownGoals: stats.ownGoals,

          yellowCards: stats.yellowCards,
          redCards: stats.redCards,

          defensivePoints: stats.defensivePoints,

          playerScore: stats.playerScore,
        },
      };
    });

    // --------------------------------------------------------
    // 9. SEND RESPONSE
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
