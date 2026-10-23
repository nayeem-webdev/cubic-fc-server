import Player from "../models/Player.js";
import Score from "../models/Score.js";
import Team from "../models/Team.js";
import Match from "../models/Match.js";

// ============================================================
// DEFENSIVE POINT CALCULATORS
// ============================================================

const getGKPoints = (goalsConceded) => {
  if (goalsConceded <= 0) return 8;
  if (goalsConceded <= 2) return 6;
  if (goalsConceded <= 4) return 4;
  if (goalsConceded <= 6) return 2;
  return 0;
};

const getDefenderPoints = (goalsConceded) => {
  if (goalsConceded <= 0) return 5;
  if (goalsConceded <= 2) return 4;
  if (goalsConceded <= 4) return 2.5;
  if (goalsConceded <= 6) return 1.5;
  return 0;
};

// ADD  PLAYERS
const addPlayer = async (req, res) => {
  try {
    const player = new Player(req.body);

    const savedPlayer = await player.save();

    res.status(201).json({
      message: "Player added successfully",
      player: savedPlayer,
    });
  } catch (error) {
    console.error("Error adding player:", error.message);

    res.status(400).json({
      message: "Failed to add player",
      error: error.message,
    });
  }
};

// GET ALL PLAYERS WITH TEAM
// GET PLAYERS WITH APPEARANCES & LAST 5 MATCHES (Safe for players with 0 matches)
const getPlayers = async (req, res) => {
  try {
    const [players, matches, scores] = await Promise.all([
      Player.find()
        .populate("playsFor", "_id name logoLow")
        .sort({ createdAt: -1 })
        .lean(),

      Match.find()
        .select(
          "_id homeTeam awayTeam matchSchedule " +
            "homeStartingPlayers homeSubstitutes " +
            "awayStartingPlayers awaySubstitutes createdAt",
        )
        .populate("matchSchedule", "date time")
        .sort({ createdAt: 1 })
        .lean(),

      Score.find().select("match homeScore awayScore").lean(),
    ]);

    const matchMap = new Map(matches.map((m) => [m._id.toString(), m]));

    const getPlayerId = (player) => {
      if (!player) return null;
      return player._id ? player._id.toString() : player.toString();
    };

    // Initialize stats map for ALL players
    const playerStats = new Map(
      players.map((p) => [
        p._id.toString(),
        {
          appearances: 0,
          participatedMatches: [],
          matchResults: [],
        },
      ]),
    );

    scores.forEach((score) => {
      const matchId = score.match?.toString();
      if (!matchId) return;

      const match = matchMap.get(matchId);
      if (!match) return;

      const matchDate = match.createdAt || null;
      const homeScore = Number(score.homeScore || 0);
      const awayScore = Number(score.awayScore || 0);

      let homeResult = "D";
      let awayResult = "D";
      if (homeScore > awayScore) {
        homeResult = "W";
        awayResult = "L";
      } else if (homeScore < awayScore) {
        homeResult = "L";
        awayResult = "W";
      }

      const processTeam = (starting = [], subs = [], result) => {
        const uniquePlayers = new Set([
          ...starting.map(getPlayerId),
          ...subs.map(getPlayerId),
        ]);

        uniquePlayers.forEach((playerId) => {
          if (!playerId || !playerStats.has(playerId)) return;

          const stats = playerStats.get(playerId);
          stats.appearances += 1;
          stats.participatedMatches.push(matchId);
          stats.matchResults.push({
            matchId,
            date: matchDate,
            result,
          });
        });
      };

      processTeam(match.homeStartingPlayers, match.homeSubstitutes, homeResult);
      processTeam(match.awayStartingPlayers, match.awaySubstitutes, awayResult);
    });

    const completedMatches = [...matchMap.values()].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    );

    const result = players.map((player) => {
      const playerId = player._id.toString();
      // Fallback object if player has no recorded matches
      const stats = playerStats.get(playerId) || {
        appearances: 0,
        participatedMatches: [],
        matchResults: [],
      };

      stats.matchResults.sort(
        (a, b) => new Date(a.date || 0) - new Date(b.date || 0),
      );

      const participatedLast5 = completedMatches.slice(-5).map((match) => {
        return stats.participatedMatches.includes(match._id.toString())
          ? "P"
          : "A";
      });

      return {
        ...player,
        stats: {
          appearances: stats.appearances,
          participatedLast5,
        },
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get opponent players error:", error);

    return res.status(500).json({
      message: "Failed to get opponent players",
      error: error.message,
    });
  }
};

// GET ALL PLAYERS WITH TEAM + STATISTICS
const getDetailedPlayers = async (req, res) => {
  try {
    // -------------------------------------------------------
    // 1. FETCH DATA
    // -------------------------------------------------------

    const [players, teams, matches, scores] = await Promise.all([
      Player.find().sort({ createdAt: -1 }).lean(),

      Team.find().select("_id name logoLow").lean(),

      Match.find()
        .select(
          "_id homeTeam awayTeam matchSchedule " +
            "homeStartingPlayers homeSubstitutes " +
            "awayStartingPlayers awaySubstitutes createdAt",
        )
        .lean(),

      // IMPORTANT:
      // We use Score.createdAt as the actual match completion/order date.
      Score.find()
        .select(
          "match homeTeam awayTeam homeScore awayScore matchEvents createdAt",
        )
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    // -------------------------------------------------------
    // 2. LOOKUP MAPS
    // -------------------------------------------------------

    const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));

    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match]),
    );

    const playerMap = new Map(
      players.map((player) => [player._id.toString(), player]),
    );

    // -------------------------------------------------------
    // 3. INITIALIZE PLAYER STATS
    // -------------------------------------------------------

    const createPlayerStats = () => ({
      appearances: 0,

      participatedMatches: [],

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
      playedMatchIds: new Set(),

      playerScore: 0,
    });

    const playerStats = new Map(
      players.map((player) => [player._id.toString(), createPlayerStats()]),
    );

    // -------------------------------------------------------
    // 4. HELPER - GET ID STRING
    // -------------------------------------------------------

    const getPlayerId = (player) => {
      if (!player) return null;

      return player._id ? player._id.toString() : player.toString();
    };

    // -------------------------------------------------------
    // 5. PROCESS SCORES
    // -------------------------------------------------------

    scores.forEach((score) => {
      const matchId = score.match?.toString();

      if (!matchId) return;

      const match = matchMap.get(matchId);

      if (!match) return;

      // -----------------------------------------------------
      // IMPORTANT
      //
      // Use Score.createdAt instead of:
      // - Match.createdAt
      // - Schedule.date
      //
      // This represents when the result was actually recorded.
      // -----------------------------------------------------

      const matchDate = score.createdAt || null;

      // -----------------------------------------------------
      // SCORE
      // -----------------------------------------------------

      const homeScore = Number(score.homeScore || 0);
      const awayScore = Number(score.awayScore || 0);

      let homeResult = "D";
      let awayResult = "D";

      if (homeScore > awayScore) {
        homeResult = "W";
        awayResult = "L";
      } else if (homeScore < awayScore) {
        homeResult = "L";
        awayResult = "W";
      }

      // -----------------------------------------------------
      // PROCESS TEAM PLAYERS
      // -----------------------------------------------------

      const processTeamPlayers = ({
        startingPlayers = [],
        substitutes = [],
        result,
        opponentScore,
      }) => {
        const uniquePlayers = new Set([
          ...startingPlayers.map(getPlayerId),
          ...substitutes.map(getPlayerId),
        ]);

        uniquePlayers.forEach((playerId) => {
          if (!playerId || !playerStats.has(playerId)) {
            return;
          }

          const stats = playerStats.get(playerId);
          const player = playerMap.get(playerId);

          // -------------------------------------------------
          // PARTICIPATION
          // Starter OR substitute = P
          // -------------------------------------------------

          stats.participatedMatches.push(matchId);

          // -------------------------------------------------
          // APPEARANCE
          // -------------------------------------------------

          stats.appearances += 1;

          stats.playedMatchIds.add(matchId);

          // -------------------------------------------------
          // MATCH RESULT
          // -------------------------------------------------

          stats.matchResults.push({
            matchId,
            date: matchDate,
            result,
          });

          // -------------------------------------------------
          // WIN POINTS
          // -------------------------------------------------

          if (result === "W") {
            stats.winPoints += 2;
          }

          // -------------------------------------------------
          // DEFENSIVE POINTS
          // -------------------------------------------------

          if (player?.position === "GK") {
            stats.defensivePoints += getGKPoints(opponentScore);
          }

          if (player?.position === "DF") {
            stats.defensivePoints += getDefenderPoints(opponentScore);
          }
        });
      };

      // -------------------------------------------------------
      // HOME PLAYERS
      // -------------------------------------------------------

      processTeamPlayers({
        startingPlayers: match.homeStartingPlayers || [],
        substitutes: match.homeSubstitutes || [],
        result: homeResult,
        opponentScore: awayScore,
      });

      // -------------------------------------------------------
      // AWAY PLAYERS
      // -------------------------------------------------------

      processTeamPlayers({
        startingPlayers: match.awayStartingPlayers || [],
        substitutes: match.awaySubstitutes || [],
        result: awayResult,
        opponentScore: homeScore,
      });

      // -------------------------------------------------------
      // MATCH EVENTS
      // -------------------------------------------------------

      (score.matchEvents || []).forEach((event) => {
        const scorerId = getPlayerId(event.scorer);
        const assisterId = getPlayerId(event.assister);
        const playerId = getPlayerId(event.player);

        // ---------------------------------------------------
        // REGULAR GOAL
        // ---------------------------------------------------

        if (event.type === "goal") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.regularGoals += 1;
          }

          if (assisterId && playerStats.has(assisterId)) {
            playerStats.get(assisterId).assists += 1;
          }
        }

        // ---------------------------------------------------
        // PENALTY GOAL
        // ---------------------------------------------------

        if (event.type === "penalty") {
          if (scorerId && playerStats.has(scorerId)) {
            const stats = playerStats.get(scorerId);

            stats.goals += 1;
            stats.penaltyGoals += 1;
          }
        }

        // ---------------------------------------------------
        // OWN GOAL
        // ---------------------------------------------------

        if (event.type === "ownGoal") {
          if (scorerId && playerStats.has(scorerId)) {
            playerStats.get(scorerId).ownGoals += 1;
          }
        }

        // ---------------------------------------------------
        // CARDS
        // ---------------------------------------------------

        if (event.type === "card") {
          if (!playerId || !playerStats.has(playerId)) {
            return;
          }

          const stats = playerStats.get(playerId);

          if (event.card === "yellow") {
            stats.yellowCards += 1;
          }

          if (event.card === "red") {
            stats.redCards += 1;
          }
        }
      });
    });

    // -------------------------------------------------------
    // 6. BUILD PLAYER RESPONSE
    // -------------------------------------------------------

    const result = players.map((player) => {
      const playerId = player._id.toString();

      const stats = playerStats.get(playerId) || createPlayerStats();

      // -----------------------------------------------------
      // SORT MATCH RESULTS BY SCORE CREATED DATE
      // -----------------------------------------------------

      stats.matchResults.sort((a, b) => {
        return new Date(a.date || 0) - new Date(b.date || 0);
      });

      // -----------------------------------------------------
      // WINS / DRAWS / LOSSES
      // -----------------------------------------------------

      const wins = stats.matchResults.filter(
        (match) => match.result === "W",
      ).length;

      const draws = stats.matchResults.filter(
        (match) => match.result === "D",
      ).length;

      const losses = stats.matchResults.filter(
        (match) => match.result === "L",
      ).length;

      // -----------------------------------------------------
      // LAST 5 RESULTS
      // -----------------------------------------------------

      const last5 = stats.matchResults.slice(-5).map((match) => match.result);

      // -----------------------------------------------------
      // WIN RATE
      // -----------------------------------------------------

      const winRate =
        stats.appearances > 0
          ? Number(((wins / stats.appearances) * 100).toFixed(1))
          : 0;

      // -----------------------------------------------------
      // CURRENT WIN STREAK
      // -----------------------------------------------------

      let currentWinStreak = 0;

      for (let i = stats.matchResults.length - 1; i >= 0; i--) {
        if (stats.matchResults[i].result !== "W") {
          break;
        }

        currentWinStreak += 1;
      }

      // -----------------------------------------------------
      // PLAYER SCORE
      // -----------------------------------------------------

      stats.playerScore =
        stats.appearances * 0.5 +
        stats.winPoints +
        stats.regularGoals * 2 +
        stats.penaltyGoals +
        stats.assists +
        stats.ownGoals * -1 +
        stats.yellowCards * -1 +
        stats.redCards * -2 +
        stats.defensivePoints;

      // -----------------------------------------------------
      // AVERAGE SCORE
      // -----------------------------------------------------

      const averageScore =
        stats.appearances > 0
          ? Number((stats.playerScore / stats.appearances).toFixed(2))
          : 0;

      // -----------------------------------------------------
      // TEAM
      // -----------------------------------------------------

      const teamId = player.playsFor?.toString();

      const team = teamId ? teamMap.get(teamId) : null;

      // -----------------------------------------------------
      // RETURN PLAYER
      // -----------------------------------------------------

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

          wins,
          draws,
          losses,

          winRate,

          last5,
          currentWinStreak,

          goals: stats.goals,
          regularGoals: stats.regularGoals,
          penaltyGoals: stats.penaltyGoals,

          assists: stats.assists,

          ownGoals: stats.ownGoals,

          yellowCards: stats.yellowCards,
          redCards: stats.redCards,

          defensivePoints: stats.defensivePoints,

          playerScore: stats.playerScore,

          averageScore,
        },
      };
    });

    // -------------------------------------------------------
    // 7. RANK PLAYERS
    // -------------------------------------------------------

    result.sort((a, b) => {
      // First: average score
      const averageDifference =
        (b.stats.averageScore || 0) - (a.stats.averageScore || 0);

      if (averageDifference !== 0) {
        return averageDifference;
      }

      // Second: total player score
      const scoreDifference =
        (b.stats.playerScore || 0) - (a.stats.playerScore || 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      // Third: appearances
      return (b.stats.appearances || 0) - (a.stats.appearances || 0);
    });

    // -------------------------------------------------------
    // 8. RESPONSE
    // -------------------------------------------------------

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get players error:", error);

    return res.status(500).json({
      message: "Failed to get players",
      error: error.message,
    });
  }
};

// UPDATE PLAYER
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

const deletePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    return res.status(200).json({ message: "Player deleted successfully" });
  } catch (error) {
    console.error("Error deleting player:", error);
    return res.status(500).json({ message: "Server error deleting player" });
  }
};

export {
  updatePlayer,
  getDetailedPlayers,
  addPlayer,
  getPlayers,
  deletePlayer,
};
