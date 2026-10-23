import Match from "../models/Match.js";
import OpponentPlayer from "../models/OpponentPlayer.js";
import OpponentTeam from "../models/OpponentTeam.js";
import Player from "../models/Player.js";
import Schedule from "../models/Schedule.js";
import Score from "../models/Score.js";
import Team from "../models/Team.js";

const postScore = async (req, res) => {
  try {
    const {
      match,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      timer,
      matchEvents,
    } = req.body;

    if (!match || !homeTeam || !awayTeam) {
      return res.status(400).json({
        message: "Match and teams are required",
      });
    }

    const existingScore = await Score.findOne({ match });

    if (existingScore) {
      return res.status(409).json({
        message: "This match score has already been saved",
        scoreId: existingScore._id,
      });
    }

    const score = new Score({
      match,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      timer,
      matchEvents,
      finishedAt: new Date(),
    });

    const savedScore = await score.save();

    return res.status(201).json({
      message: "Match score saved successfully",
      score: savedScore,
    });
  } catch (error) {
    console.error("Error saving match score:", error);

    // MongoDB duplicate key protection
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This match score has already been saved",
      });
    }

    return res.status(500).json({
      message: "Failed to save match score",
      error: error.message,
    });
  }
};

const getScores = async (req, res) => {
  try {
    // ==========================================
    // 1. GET SCORES
    // ==========================================

    const scores = await Score.find().sort({ finishedAt: -1 }).lean();

    if (!scores.length) {
      return res.status(200).json({
        success: true,
        scores: [],
      });
    }

    // ==========================================
    // 2. GET MATCH IDS
    // ==========================================

    const matchIds = scores.map((score) => score.match).filter(Boolean);

    // Get matches WITHOUT populating players or teams
    const matches = await Match.find({
      _id: { $in: matchIds },
    })
      .select(
        "_id matchSchedule matchType matchTime playersPerTeam homeStartingPlayers homeSubstitutes awayStartingPlayers awaySubstitutes",
      )
      .lean();

    // ==========================================
    // 3. CREATE MATCH MAP
    // ==========================================

    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match]),
    );

    // ==========================================
    // 4. COLLECT TEAM IDS
    // ==========================================

    const teamIds = [];

    scores.forEach((score) => {
      if (score.homeTeam) {
        teamIds.push(score.homeTeam.toString());
      }

      if (score.awayTeam) {
        teamIds.push(score.awayTeam.toString());
      }
    });

    const uniqueTeamIds = [...new Set(teamIds)];

    // ==========================================
    // 5. COLLECT PLAYER IDS
    // ==========================================

    const playerIds = [];

    matches.forEach((match) => {
      [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ].forEach((playerId) => {
        if (playerId) {
          playerIds.push(playerId.toString());
        }
      });
    });

    const uniquePlayerIds = [...new Set(playerIds)];

    // ==========================================
    // 6. FIND TEAMS IN BOTH COLLECTIONS
    // ==========================================

    const [clubTeams, externalTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),

      OpponentTeam.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),
    ]);

    // ==========================================
    // 7. FIND PLAYERS IN BOTH COLLECTIONS
    // ==========================================

    const [clubPlayers, externalPlayers] = await Promise.all([
      Player.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),

      OpponentPlayer.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),
    ]);

    // ==========================================
    // 8. CREATE LOOKUP MAPS
    // ==========================================

    const allTeams = [...clubTeams, ...externalTeams];

    const allPlayers = [...clubPlayers, ...externalPlayers];

    const teamMap = new Map(
      allTeams.map((team) => [team._id.toString(), team]),
    );

    const playerMap = new Map(
      allPlayers.map((player) => [player._id.toString(), player]),
    );

    // ==========================================
    // 9. GET SCHEDULES
    // ==========================================

    const scheduleIds = matches
      .map((match) => match.matchSchedule)
      .filter(Boolean)
      .map((id) => id.toString());

    const uniqueScheduleIds = [...new Set(scheduleIds)];

    const schedules = await Schedule.find({
      _id: {
        $in: uniqueScheduleIds,
      },
    })
      .select("_id date venue matchType")
      .populate({
        path: "venue",
        select: "_id venue",
      })
      .lean();

    const scheduleMap = new Map(
      schedules.map((schedule) => [schedule._id.toString(), schedule]),
    );

    // ==========================================
    // 10. BUILD FINAL RESPONSE
    // ==========================================

    const finalScores = scores.map((score) => {
      const match = score.match ? matchMap.get(score.match.toString()) : null;

      // ------------------------------
      // TEAMS
      // ------------------------------

      const homeTeam = score.homeTeam
        ? teamMap.get(score.homeTeam.toString()) || null
        : null;

      const awayTeam = score.awayTeam
        ? teamMap.get(score.awayTeam.toString()) || null
        : null;

      // ------------------------------
      // MATCH PLAYERS
      // ------------------------------

      let populatedMatch = null;

      if (match) {
        populatedMatch = {
          ...match,

          matchSchedule: match.matchSchedule
            ? scheduleMap.get(match.matchSchedule.toString()) || null
            : null,

          homeStartingPlayers: (match.homeStartingPlayers || [])
            .map((id) => playerMap.get(id.toString()))
            .filter(Boolean),

          homeSubstitutes: (match.homeSubstitutes || [])
            .map((id) => playerMap.get(id.toString()))
            .filter(Boolean),

          awayStartingPlayers: (match.awayStartingPlayers || [])
            .map((id) => playerMap.get(id.toString()))
            .filter(Boolean),

          awaySubstitutes: (match.awaySubstitutes || [])
            .map((id) => playerMap.get(id.toString()))
            .filter(Boolean),
        };
      }

      return {
        ...score,

        homeTeam,

        awayTeam,

        match: populatedMatch,
      };
    });

    // ==========================================
    // 11. RESPONSE
    // ==========================================

    res.status(200).json({
      success: true,
      scores: finalScores,
    });
  } catch (error) {
    console.error("Error fetching scores:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch match scores",
      error: error.message,
    });
  }
};

const getScoreSummary = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 5;
    const skip = (page - 1) * limit;

    // ==========================================
    // 1. GET PAGINATED SCORES
    // ==========================================

    const [scores, totalScores] = await Promise.all([
      Score.find().sort({ finishedAt: -1 }).skip(skip).limit(limit).lean(),

      Score.countDocuments(),
    ]);

    if (!scores.length) {
      return res.status(200).json({
        success: true,
        scores: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: totalScores,
          hasNextPage: false,
          hasPreviousPage: page > 1,
        },
      });
    }

    // ==========================================
    // 2. GET MATCH IDS
    // ==========================================

    const matchIds = scores.map((score) => score.match).filter(Boolean);

    const matches = await Match.find({
      _id: { $in: matchIds },
    })
      .select("_id matchSchedule matchType matchTime")
      .lean();

    const matchMap = new Map(
      matches.map((match) => [match._id.toString(), match]),
    );

    // ==========================================
    // 3. GET TEAM IDS
    // ==========================================

    const teamIds = [];

    scores.forEach((score) => {
      if (score.homeTeam) {
        teamIds.push(score.homeTeam.toString());
      }

      if (score.awayTeam) {
        teamIds.push(score.awayTeam.toString());
      }
    });

    const uniqueTeamIds = [...new Set(teamIds)];

    // ==========================================
    // 4. GET TEAMS
    // ==========================================

    const [clubTeams, opponentTeams] = await Promise.all([
      Team.find({
        _id: { $in: uniqueTeamIds },
      })
        .select("_id name logoLow")
        .lean(),

      OpponentTeam.find({
        _id: { $in: uniqueTeamIds },
      })
        .select("_id name logoLow")
        .lean(),
    ]);

    const allTeams = [...clubTeams, ...opponentTeams];

    const teamMap = new Map(
      allTeams.map((team) => [team._id.toString(), team]),
    );

    // ==========================================
    // 5. GET SCHEDULES
    // ==========================================

    const scheduleIds = matches
      .map((match) => match.matchSchedule)
      .filter(Boolean)
      .map((id) => id.toString());

    const uniqueScheduleIds = [...new Set(scheduleIds)];

    const schedules = await Schedule.find({
      _id: { $in: uniqueScheduleIds },
    })
      .select("_id date venue matchType")
      .populate({
        path: "venue",
        select: "_id venue",
      })
      .lean();

    const scheduleMap = new Map(
      schedules.map((schedule) => [schedule._id.toString(), schedule]),
    );

    // ==========================================
    // 6. BUILD SUMMARY
    // ==========================================

    const finalScores = scores.map((score) => {
      const match = score.match ? matchMap.get(score.match.toString()) : null;

      const homeTeam = score.homeTeam
        ? teamMap.get(score.homeTeam.toString()) || null
        : null;

      const awayTeam = score.awayTeam
        ? teamMap.get(score.awayTeam.toString()) || null
        : null;

      const schedule = match?.matchSchedule
        ? scheduleMap.get(match.matchSchedule.toString()) || null
        : null;

      return {
        _id: score._id,

        matchType: match?.matchType || "training",
        matchTime: match?.matchTime || null,

        homeScore: score.homeScore,
        awayScore: score.awayScore,

        homeTeam: homeTeam
          ? {
              _id: homeTeam._id,
              name: homeTeam.name,
              logoLow: homeTeam.logoLow,
            }
          : null,

        awayTeam: awayTeam
          ? {
              _id: awayTeam._id,
              name: awayTeam.name,
              logoLow: awayTeam.logoLow,
            }
          : null,

        date: schedule?.date || null,

        venue: schedule?.venue
          ? {
              _id: schedule.venue._id,
              venue: schedule.venue.venue,
            }
          : null,
      };
    });

    // ==========================================
    // 7. RESPONSE
    // ==========================================

    const totalPages = Math.ceil(totalScores / limit);

    return res.status(200).json({
      success: true,

      scores: finalScores,

      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalScores,
        limit,

        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching score summary:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch score summary",
      error: error.message,
    });
  }
};

const getSimpleScores = async (req, res) => {
  try {
    const scores = await Score.find()
      .sort({ finishedAt: -1 })
      .populate({
        path: "match",
        select: "homeTeam awayTeam matchTime matchSchedule",
        populate: [
          {
            path: "homeTeam",
            select: "name",
          },
          {
            path: "awayTeam",
            select: "name",
          },
          {
            path: "matchSchedule",
          },
        ],
      })
      .lean();

    return res.status(200).json({
      success: true,
      scores,
    });
  } catch (error) {
    console.error("Failed to get scores:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get scores",
      error: error.message,
    });
  }
};

const getScoreById = async (req, res) => {
  try {
    // ==========================================
    // 1. GET SCORE BY ID
    // ==========================================

    const { id } = req.params;

    const score = await Score.findById(id).lean();

    if (!score) {
      return res.status(404).json({
        success: false,
        message: "Score not found",
      });
    }

    // ==========================================
    // 2. GET MATCH
    // ==========================================

    const match = score.match
      ? await Match.findById(score.match)
          .select(
            "_id matchSchedule matchType matchTime playersPerTeam homeStartingPlayers homeSubstitutes awayStartingPlayers awaySubstitutes",
          )
          .lean()
      : null;

    // ==========================================
    // 3. COLLECT TEAM IDS
    // ==========================================

    const teamIds = [];

    if (score.homeTeam) {
      teamIds.push(score.homeTeam.toString());
    }

    if (score.awayTeam) {
      teamIds.push(score.awayTeam.toString());
    }

    // ==========================================
    // 4. COLLECT PLAYER IDS
    // ==========================================

    const playerIds = [];

    if (match) {
      [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ].forEach((playerId) => {
        if (playerId) {
          playerIds.push(playerId.toString());
        }
      });
    }

    // ==========================================
    // 5. GET TEAMS
    // ==========================================

    const uniqueTeamIds = [...new Set(teamIds)];

    const [clubTeams, externalTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),

      OpponentTeam.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),
    ]);

    // ==========================================
    // 6. GET PLAYERS
    // ==========================================

    const uniquePlayerIds = [...new Set(playerIds)];

    const [clubPlayers, externalPlayers] = await Promise.all([
      Player.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),

      OpponentPlayer.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),
    ]);

    // ==========================================
    // 7. CREATE LOOKUP MAPS
    // ==========================================

    const allTeams = [...clubTeams, ...externalTeams];
    const allPlayers = [...clubPlayers, ...externalPlayers];

    const teamMap = new Map(
      allTeams.map((team) => [team._id.toString(), team]),
    );

    const playerMap = new Map(
      allPlayers.map((player) => [player._id.toString(), player]),
    );

    // ==========================================
    // 8. GET SCHEDULE
    // ==========================================

    let schedule = null;

    if (match?.matchSchedule) {
      schedule = await Schedule.findById(match.matchSchedule)
        .select("_id date venue matchType")
        .populate({
          path: "venue",
          select: "_id venue",
        })
        .lean();
    }

    // ==========================================
    // 9. POPULATE TEAMS
    // ==========================================

    const homeTeam = score.homeTeam
      ? teamMap.get(score.homeTeam.toString()) || null
      : null;

    const awayTeam = score.awayTeam
      ? teamMap.get(score.awayTeam.toString()) || null
      : null;

    // ==========================================
    // 10. POPULATE MATCH
    // ==========================================

    let populatedMatch = null;

    if (match) {
      populatedMatch = {
        ...match,

        matchSchedule: schedule,

        homeStartingPlayers: (match.homeStartingPlayers || [])
          .map((id) => playerMap.get(id.toString()))
          .filter(Boolean),

        homeSubstitutes: (match.homeSubstitutes || [])
          .map((id) => playerMap.get(id.toString()))
          .filter(Boolean),

        awayStartingPlayers: (match.awayStartingPlayers || [])
          .map((id) => playerMap.get(id.toString()))
          .filter(Boolean),

        awaySubstitutes: (match.awaySubstitutes || [])
          .map((id) => playerMap.get(id.toString()))
          .filter(Boolean),
      };
    }

    // ==========================================
    // 11. RESPONSE
    // ==========================================

    res.status(200).json({
      success: true,
      score: {
        ...score,
        homeTeam,
        awayTeam,
        match: populatedMatch,
      },
    });
  } catch (error) {
    console.error("Error fetching score:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch score",
      error: error.message,
    });
  }
};

const getScoreDetails = async (req, res) => {
  try {
    // ==========================================
    // 1. GET SCORE
    // ==========================================

    const { id } = req.params;

    const score = await Score.findById(id).lean();

    if (!score) {
      return res.status(404).json({
        success: false,
        message: "Score not found",
      });
    }

    // ==========================================
    // 2. GET MATCH
    // ==========================================

    const match = score.match
      ? await Match.findById(score.match)
          .select(
            "_id matchSchedule matchType matchTime playersPerTeam homeStartingPlayers homeSubstitutes awayStartingPlayers awaySubstitutes",
          )
          .lean()
      : null;

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    // ==========================================
    // 3. GET SCHEDULE
    // ==========================================

    let schedule = null;

    if (match.matchSchedule) {
      schedule = await Schedule.findById(match.matchSchedule)
        .select("_id date venue matchType")
        .populate({
          path: "venue",
          select: "_id venue",
        })
        .lean();
    }

    // ==========================================
    // 4. COLLECT PLAYER IDS
    // ==========================================

    const playerIds = [
      ...(match.homeStartingPlayers || []),
      ...(match.homeSubstitutes || []),
      ...(match.awayStartingPlayers || []),
      ...(match.awaySubstitutes || []),
    ]
      .map((player) => {
        // If it's already populated
        if (player && typeof player === "object" && player._id) {
          return player._id.toString();
        }

        // If it's an ObjectId/string
        if (player) {
          return player.toString();
        }

        return null;
      })
      .filter(Boolean);

    const uniquePlayerIds = [...new Set(playerIds)];

    // ==========================================
    // 5. FIND PLAYERS
    // ==========================================

    const [clubPlayers, externalPlayers] = await Promise.all([
      Player.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),

      OpponentPlayer.find({
        _id: {
          $in: uniquePlayerIds,
        },
      })
        .select("_id name jerseyNumber photo position")
        .lean(),
    ]);

    // ==========================================
    // 6. CREATE PLAYER MAP
    // ==========================================

    const allPlayers = [...clubPlayers, ...externalPlayers];

    const playerMap = new Map(
      allPlayers.map((player) => [player._id.toString(), player]),
    );

    // ==========================================
    // 7. POPULATE PLAYER ARRAY
    // ==========================================

    const populatePlayers = (players = []) => {
      return players
        .map((player) => {
          const playerId =
            player && typeof player === "object" && player._id
              ? player._id.toString()
              : player?.toString();

          return playerId ? playerMap.get(playerId) : null;
        })
        .filter(Boolean);
    };

    // ==========================================
    // 8. POPULATE MATCH
    // ==========================================

    const populatedMatch = {
      ...match,

      matchSchedule: schedule,

      homeStartingPlayers: populatePlayers(match.homeStartingPlayers),

      homeSubstitutes: populatePlayers(match.homeSubstitutes),

      awayStartingPlayers: populatePlayers(match.awayStartingPlayers),

      awaySubstitutes: populatePlayers(match.awaySubstitutes),
    };

    // ==========================================
    // 9. GET TEAMS
    // ==========================================

    const teamIds = [score.homeTeam, score.awayTeam]
      .filter(Boolean)
      .map((id) => id.toString());

    const uniqueTeamIds = [...new Set(teamIds)];

    const [clubTeams, externalTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),

      OpponentTeam.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),
    ]);

    // ==========================================
    // 10. CREATE TEAM MAP
    // ==========================================

    const allTeams = [...clubTeams, ...externalTeams];

    const teamMap = new Map(
      allTeams.map((team) => [team._id.toString(), team]),
    );

    const homeTeam = score.homeTeam
      ? teamMap.get(score.homeTeam.toString()) || null
      : null;

    const awayTeam = score.awayTeam
      ? teamMap.get(score.awayTeam.toString()) || null
      : null;

    // ==========================================
    // 11. FINAL SCORE
    // ==========================================

    const finalScore = {
      ...score,

      homeTeam,

      awayTeam,

      match: populatedMatch,
    };

    // ==========================================
    // 12. RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      score: finalScore,
    });
  } catch (error) {
    console.error("Error fetching score details:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch score details",
      error: error.message,
    });
  }
};

const updateScore = async (req, res) => {
  try {
    const { id } = req.params;

    const { homeTeam, awayTeam, homeScore, awayScore, timer, matchEvents } =
      req.body;

    const score = await Score.findById(id);

    if (!score) {
      return res.status(404).json({
        message: "Score not found",
      });
    }

    if (homeTeam !== undefined) score.homeTeam = homeTeam;
    if (awayTeam !== undefined) score.awayTeam = awayTeam;
    if (homeScore !== undefined) score.homeScore = homeScore;
    if (awayScore !== undefined) score.awayScore = awayScore;
    if (timer !== undefined) score.timer = timer;
    if (matchEvents !== undefined) score.matchEvents = matchEvents;

    const updatedScore = await score.save();

    return res.status(200).json({
      message: "Match score updated successfully",
      score: updatedScore,
    });
  } catch (error) {
    console.error("Error updating match score:", error);

    return res.status(500).json({
      message: "Failed to update match score",
      error: error.message,
    });
  }
};

export {
  getScores,
  getScoreById,
  postScore,
  getSimpleScores,
  getScoreSummary,
  updateScore,
  getScoreDetails,
};
