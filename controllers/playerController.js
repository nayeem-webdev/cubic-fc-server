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

// ============================================================
// GET ALL PLAYERS WITH TEAM + STATISTICS
// ============================================================

const getPlayers = async (req, res) => {
  try {
    // 1. GET PLAYERS
    const players = await Player.find().sort({ createdAt: -1 }).lean();

    // 2. GET TEAMS
    const teams = await Team.find().select("_id name logoLow").lean();

    const teamMap = new Map(
      teams.map((team) => [team._id.toString(), team])
    );

    // 3. GET MATCHES
    const matches = await Match.find()
      .select(
        "_id homeTeam awayTeam matchSchedule homeStartingPlayers homeSubstitutes awayStartingPlayers awaySubstitutes"
      )
      .sort({ matchSchedule: 1 })
      .lean();

    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match])
    );

    // 4. GET SCORES
    const scores = await Score.find()
      .select("match homeTeam awayTeam homeScore awayScore matchEvents")
      .lean();

    // 5. INITIALIZE MAPS & PLAYER STATS
    const teamMatchesMap = new Map();
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
        defensivePoints: 0,
        winPoints: 0,
        matchResults: [],
        playedMatchIds: new Set(),
        playerScore: 0,
      });
    });

    // 6. PROCESS SCORES
    scores.forEach((score) => {
      const matchId = score.match?.toString();

      if (!matchId) return;

      const match = matchMap.get(matchId);

      if (!match) return;

      const matchDate = match.matchSchedule || score.createdAt || null;

      // Extract Team IDs from Score/Match
      const homeTeamId =
        (
          score.homeTeam?._id ||
          score.homeTeam ||
          match.homeTeam
        )?._id?.toString() ||
        (
          score.homeTeam?._id ||
          score.homeTeam ||
          match.homeTeam
        )?.toString();

      const awayTeamId =
        (
          score.awayTeam?._id ||
          score.awayTeam ||
          match.awayTeam
        )?._id?.toString() ||
        (
          score.awayTeam?._id ||
          score.awayTeam ||
          match.awayTeam
        )?.toString();

      // Collect team matches
      if (homeTeamId) {
        if (!teamMatchesMap.has(homeTeamId)) {
          teamMatchesMap.set(homeTeamId, []);
        }

        teamMatchesMap.get(homeTeamId).push({
          matchId,
          date: matchDate,
        });
      }

      if (awayTeamId) {
        if (!teamMatchesMap.has(awayTeamId)) {
          teamMatchesMap.set(awayTeamId, []);
        }

        teamMatchesMap.get(awayTeamId).push({
          matchId,
          date: matchDate,
        });
      }

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

      // HOME PLAYERS
      const homePlayers = [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
      ];

      const homeUniquePlayers = new Set();

      homePlayers.forEach((playerId) => {
        const id = playerId?._id
          ? playerId._id.toString()
          : playerId?.toString();

        if (
          !id ||
          !playerStats.has(id) ||
          homeUniquePlayers.has(id)
        ) {
          return;
        }

        homeUniquePlayers.add(id);

        const stats = playerStats.get(id);

        stats.appearances += 1;

        // Important:
        // This records participation regardless of team.
        stats.playedMatchIds.add(matchId);

        stats.matchResults.push({
          matchId,
          date: matchDate,
          result: homeResult,
        });

        if (homeResult === "W") {
          stats.winPoints += 2;
        }

        const player = players.find(
          (p) => p._id.toString() === id
        );

        if (player) {
          if (player.position === "GK") {
            stats.defensivePoints += getGKPoints(awayScore);
          }

          if (player.position === "DF") {
            stats.defensivePoints += getDefenderPoints(awayScore);
          }
        }
      });

      // AWAY PLAYERS
      const awayPlayers = [
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ];

      const awayUniquePlayers = new Set();

      awayPlayers.forEach((playerId) => {
        const id = playerId?._id
          ? playerId._id.toString()
          : playerId?.toString();

        if (
          !id ||
          !playerStats.has(id) ||
          awayUniquePlayers.has(id)
        ) {
          return;
        }

        awayUniquePlayers.add(id);

        const stats = playerStats.get(id);

        stats.appearances += 1;

        // Important:
        // This records participation regardless of team.
        stats.playedMatchIds.add(matchId);

        stats.matchResults.push({
          matchId,
          date: matchDate,
          result: awayResult,
        });

        if (awayResult === "W") {
          stats.winPoints += 2;
        }

        const player = players.find(
          (p) => p._id.toString() === id
        );

        if (player) {
          if (player.position === "GK") {
            stats.defensivePoints += getGKPoints(homeScore);
          }

          if (player.position === "DF") {
            stats.defensivePoints += getDefenderPoints(homeScore);
          }
        }
      });

      // MATCH EVENTS
      (score.matchEvents || []).forEach((event) => {
        const scorerId = event.scorer?.toString();
        const assisterId = event.assister?.toString();
        const playerId = event.player?.toString();

        // REGULAR GOAL
        if (event.type === "goal") {
          if (scorerId && playerStats.has(scorerId)) {
            playerStats.get(scorerId).goals += 1;
            playerStats.get(scorerId).regularGoals += 1;
          }

          if (assisterId && playerStats.has(assisterId)) {
            playerStats.get(assisterId).assists += 1;
          }
        }

        // PENALTY GOAL
        if (event.type === "penalty") {
          if (scorerId && playerStats.has(scorerId)) {
            playerStats.get(scorerId).goals += 1;
            playerStats.get(scorerId).penaltyGoals += 1;
          }
        }

        // OWN GOAL
        if (event.type === "ownGoal") {
          if (scorerId && playerStats.has(scorerId)) {
            playerStats.get(scorerId).ownGoals += 1;
          }
        }

        // CARDS
        if (event.type === "card") {
          if (playerId && playerStats.has(playerId)) {
            if (event.card === "yellow") {
              playerStats.get(playerId).yellowCards += 1;
            }

            if (event.card === "red") {
              playerStats.get(playerId).redCards += 1;
            }
          }
        }
      });
    });

    // =========================================================
    // COMPLETED MATCHES
    // A match is completed when it has a saved Score.
    // =========================================================

    const completedMatchIds = new Set(
      scores
        .map((score) => score.match?.toString())
        .filter(Boolean)
    );

    const allCompletedMatches = [...matchMap.values()]
      .filter((match) =>
        completedMatchIds.has(match._id.toString())
      )
      .sort((a, b) => {
        const dateA = a.matchSchedule
          ? new Date(a.matchSchedule).getTime()
          : 0;

        const dateB = b.matchSchedule
          ? new Date(b.matchSchedule).getTime()
          : 0;

        return dateA - dateB;
      });

    // =========================================================
    // GLOBAL LAST 5 MATCHES
    // Team does NOT matter.
    // =========================================================

    const last5GlobalMatches = allCompletedMatches.slice(-5);

    // =========================================================
    // GLOBAL LAST 4 MATCHES
    // Used only for ACTIVE / INACTIVE status.
    // =========================================================

    const last4GlobalMatches = allCompletedMatches.slice(-4);

    // 7. BUILD FINAL RESPONSE
    const result = players.map((player) => {
      const playerId = player._id.toString();

      const playerTeamId = player.playsFor
        ? player.playsFor.toString()
        : null;

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
        playedMatchIds: new Set(),
        playerScore: 0,
      };

      // =======================================================
      // SORT PLAYER MATCH RESULTS CHRONOLOGICALLY
      // =======================================================

      stats.matchResults.sort((a, b) => {
        const dateA = a.date
          ? new Date(a.date).getTime()
          : 0;

        const dateB = b.date
          ? new Date(b.date).getTime()
          : 0;

        return dateA - dateB;
      });

      // =======================================================
      // PLAYER'S LAST 5 RESULTS
      // W / D / L
      //
      // This remains based on matches the player actually played.
      // =======================================================

      const last5Matches = stats.matchResults.slice(-5);

      const last5 = last5Matches.map(
        (match) => match.result
      );

      // =======================================================
      // GLOBAL LAST 5 ATTENDANCE
      //
      // P = Played
      // A = Absent
      //
      // Team does NOT matter.
      // =======================================================

      const participatedLast5 = last5GlobalMatches.map(
        (match) =>
          stats.playedMatchIds.has(match._id.toString())
            ? "P"
            : "A"
      );

      // =======================================================
      // ACTIVE / INACTIVE
      //
      // If player missed all of the last 4 completed matches:
      // inactive
      //
      // If player played at least 1 of the last 4:
      // active
      //
      // Team does NOT matter.
      // =======================================================

      const participatedLast4 = last4GlobalMatches.map(
        (match) =>
          stats.playedMatchIds.has(match._id.toString())
            ? "P"
            : "A"
      );

      const status =
        last4GlobalMatches.length === 0
          ? "active"
          : participatedLast4.length === 4 &&
            participatedLast4.every(
              (item) => item === "A"
            )
          ? "inactive"
          : "active";

      // =======================================================
      // WINS / DRAWS / LOSSES
      // =======================================================

      const wins = stats.matchResults.filter(
        (m) => m.result === "W"
      ).length;

      const draws = stats.matchResults.filter(
        (m) => m.result === "D"
      ).length;

      const losses = stats.matchResults.filter(
        (m) => m.result === "L"
      ).length;

      const winsLast5 = last5Matches.filter(
        (m) => m.result === "W"
      ).length;

      // =======================================================
      // WIN RATE
      // =======================================================

      const winRate =
        stats.appearances > 0
          ? Number(
              (
                (wins / stats.appearances) *
                100
              ).toFixed(1)
            )
          : 0;

      // =======================================================
      // CURRENT WIN STREAK
      // =======================================================

      let currentWinStreak = 0;

      for (
        let i = stats.matchResults.length - 1;
        i >= 0;
        i--
      ) {
        if (stats.matchResults[i].result === "W") {
          currentWinStreak += 1;
        } else {
          break;
        }
      }

      // =======================================================
      // PLAYER SCORE
      //
      // KEEPING YOUR EXISTING FORMULA UNCHANGED
      // =======================================================

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

      // =======================================================
      // AVERAGE SCORE
      // =======================================================

      const averageScore =
        stats.appearances > 0
          ? Number(
              (
                stats.playerScore /
                stats.appearances
              ).toFixed(2)
            )
          : 0;

      // =======================================================
      // TEAM
      // =======================================================

      const team = playerTeamId
        ? teamMap.get(playerTeamId)
        : null;

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

          // Player's last 5 played-match results
          last5,

          // Global last 5 matches attendance
          participatedLast5,

          // Global last 4 matches attendance
          participatedLast4,

          // active / inactive
          status,

          winsLast5,

          currentWinStreak,

          goals: stats.goals,
          regularGoals: stats.regularGoals,
          penaltyGoals: stats.penaltyGoals,

          assists: stats.assists,

          ownGoals: stats.ownGoals,

          yellowCards: stats.yellowCards,
          redCards: stats.redCards,

          winPoints: stats.winPoints,
          defensivePoints: stats.defensivePoints,

          playerScore: stats.playerScore,

          averageScore,
        },
      };
    });

    // =========================================================
    // RANKING
    // Highest average score = Rank 1
    // Players with 0 appearances go to the bottom.
    // =========================================================

    result.sort((a, b) => {
      const avgA = a.stats.averageScore || 0;
      const avgB = b.stats.averageScore || 0;

      if (avgA !== avgB) {
        return avgB - avgA;
      }

      const scoreA = a.stats.playerScore || 0;
      const scoreB = b.stats.playerScore || 0;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      return (
        (b.stats.appearances || 0) -
        (a.stats.appearances || 0)
      );
    });

    // Add ranking after sorting
    result.forEach((player, index) => {
      player.stats.ranking =
        player.stats.appearances > 0
          ? index + 1
          : null;
    });

    // =========================================================
    // RESPONSE
    // =========================================================

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
