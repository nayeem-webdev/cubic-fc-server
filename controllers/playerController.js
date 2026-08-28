import Player from "../models/Player.js";
import Score from "../models/Score.js";
import Team from "../models/Team.js";

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

const getPlayers = async (req, res) => {
  // GET - Get All Players with Team + Statistics
  try {
    // --------------------------------------------------
    // 1. GET PLAYERS
    // --------------------------------------------------

    const players = await Player.find().sort({ createdAt: -1 }).lean();

    // --------------------------------------------------
    // 2. GET TEAMS
    // --------------------------------------------------

    const teams = await Team.find().select("_id name logoLow").lean();

    // Create quick team lookup
    const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));

    // --------------------------------------------------
    // 3. GET SCORES / MATCHES
    // --------------------------------------------------

    const scores = await Score.find()
      .select(
        "homeTeam " +
          "awayTeam " +
          "homeStartingPlayers " +
          "homeSubstitutes " +
          "awayStartingPlayers " +
          "awaySubstitutes " +
          "matchEvents",
      )
      .lean();

    // --------------------------------------------------
    // 4. INITIALIZE PLAYER STATISTICS
    // --------------------------------------------------

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

        playerRating: 0,
      });
    });

    // --------------------------------------------------
    // 5. PROCESS EVERY MATCH
    // --------------------------------------------------

    scores.forEach((score) => {
      // ------------------------------------------------
      // ALL PLAYERS WHO WERE LISTED FOR THE MATCH
      // ------------------------------------------------
      //
      // Starting players + substitutes
      //
      // Everyone listed gets:
      // +1 appearance
      // +0.5 rating
      //
      // We intentionally DO NOT check whether a
      // substitute actually entered the match.
      // ------------------------------------------------

      const matchPlayers = [
        ...(score.homeStartingPlayers || []),
        ...(score.homeSubstitutes || []),
        ...(score.awayStartingPlayers || []),
        ...(score.awaySubstitutes || []),
      ];

      // Prevent duplicate appearance if a player
      // somehow appears twice in the same match.
      const uniqueMatchPlayers = new Set();

      matchPlayers.forEach((player) => {
        const playerId = player?._id?.toString();

        if (!playerId) {
          return;
        }

        if (!playerStats.has(playerId)) {
          return;
        }

        // Don't count the same player twice
        // in the same match.
        if (uniqueMatchPlayers.has(playerId)) {
          return;
        }

        uniqueMatchPlayers.add(playerId);

        const stats = playerStats.get(playerId);

        stats.appearances += 1;
      });

      // ------------------------------------------------
      // MATCH EVENTS
      // ------------------------------------------------

      (score.matchEvents || []).forEach((event) => {
        const scorerId = event.scorer?.toString();
        const assisterId = event.assister?.toString();
        const playerId = event.player?.toString();

        // ==============================================
        // REGULAR GOAL
        // ==============================================

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

        // ==============================================
        // PENALTY GOAL
        // ==============================================

        if (event.type === "penalty") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.penaltyGoals += 1;
          }

          // No assist is counted for penalty goals
          // because your event structure doesn't provide
          // an assister for penalties.
        }

        // ==============================================
        // OWN GOAL
        // ==============================================

        if (event.type === "ownGoal") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.ownGoals += 1;
          }

          // IMPORTANT:
          //
          // Own goal does NOT increase:
          // - goals
          // - regularGoals
          // - penaltyGoals
          // - rating
        }

        // ==============================================
        // CARD
        // ==============================================

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

    // --------------------------------------------------
    // 6. BUILD FINAL PLAYER RESPONSE
    // --------------------------------------------------

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
        playerRating: 0,
      };

      // ------------------------------------------------
      // CALCULATE PLAYER RATING
      // ------------------------------------------------
      //
      // Starting/substitute appearance = +0.5
      // Regular goal = +2
      // Penalty goal = +1
      // Assist = +1
      // Own goal = +0
      //
      // ------------------------------------------------

      stats.playerRating =
        stats.regularGoals * 2 +
        stats.penaltyGoals * 1 +
        stats.assists * 1 +
        stats.appearances * 0.5;

      // ------------------------------------------------
      // GET PLAYER'S TEAM
      // ------------------------------------------------

      const team = player.playsFor
        ? teamMap.get(player.playsFor.toString())
        : null;

      // ------------------------------------------------
      // RETURN PLAYER
      // ------------------------------------------------

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

          playerRating: stats.playerRating,
        },
      };
    });

    // --------------------------------------------------
    // 7. SEND RESPONSE
    // --------------------------------------------------

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
