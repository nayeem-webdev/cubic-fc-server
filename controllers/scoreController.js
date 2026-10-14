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

export { getScores, postScore };
