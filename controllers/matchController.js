import Match from "../models/Match.js";

const addMatch = async (req, res) => {
  // POST - Add a new Match
  try {
    const match = new Match(req.body);

    const savedMatch = await match.save();

    res.status(201).json({
      message: "Match created successfully",
      match: savedMatch,
    });
  } catch (error) {
    console.error("Error creating match:", error.message);

    res.status(400).json({
      message: "Failed to create match",
      error: error.message,
    });
  }
};

const getUpcomingMatches = async (req, res) => {
  try {
    const now = new Date();

    // Calculate yesterday's date in Asia/Dhaka time zone
    const yesterday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Models
    const Schedule = Match.db.model("Schedule");
    const Team = Match.db.model("Team");
    const Player = Match.db.model("Player");
    const OpponentTeam = Match.db.model("OpponentTeam");
    const OpponentPlayer = Match.db.model("OpponentPlayer");

    // Get schedules from yesterday onwards
    const scheduleIds = await Schedule.find({
      date: {
        $gte: yesterday,
      },
    }).distinct("_id");

    // Get matches
    const matches = await Match.find({
      matchSchedule: {
        $in: scheduleIds,
      },
    }).lean();

    // Get all IDs used by matches
    const teamIds = [];

    const playerIds = [];

    matches.forEach((match) => {
      if (match.homeTeam) teamIds.push(match.homeTeam);
      if (match.awayTeam) teamIds.push(match.awayTeam);

      [
        ...(match.homeStartingPlayers || []),
        ...(match.homeSubstitutes || []),
        ...(match.awayStartingPlayers || []),
        ...(match.awaySubstitutes || []),
      ].forEach((id) => {
        if (id) playerIds.push(id);
      });
    });

    // Remove duplicate IDs
    const uniqueTeamIds = [...new Set(teamIds.map((id) => id.toString()))];

    const uniquePlayerIds = [...new Set(playerIds.map((id) => id.toString()))];

    // Fetch teams from BOTH collections
    const [teams, opponentTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: uniqueTeamIds,
        },
      }).select("_id name logoLow"),

      OpponentTeam.find({
        _id: {
          $in: uniqueTeamIds,
        },
      }).select("_id name logoLow"),
    ]);

    // Fetch players from BOTH collections
    const [players, opponentPlayers] = await Promise.all([
      Player.find({
        _id: {
          $in: uniquePlayerIds,
        },
      }).select("_id name photo jerseyNumber position"),

      OpponentPlayer.find({
        _id: {
          $in: uniquePlayerIds,
        },
      }).select("_id name photo jerseyNumber position"),
    ]);

    // Combine them
    const allTeams = [...teams, ...opponentTeams];
    const allPlayers = [...players, ...opponentPlayers];

    // Create quick lookup maps
    const teamMap = new Map(
      allTeams.map((team) => [team._id.toString(), team]),
    );

    const playerMap = new Map(
      allPlayers.map((player) => [player._id.toString(), player]),
    );

    // Populate schedule information
    const populatedMatches = await Match.populate(matches, {
      path: "matchSchedule",
      select: "_id venue date time matchFormat matchType",
      populate: {
        path: "venue",
        select: "_id venue",
      },
    });

    // Manually populate teams and players
    populatedMatches.forEach((match) => {
      // Teams
      match.homeTeam = teamMap.get(match.homeTeam?.toString()) || null;

      match.awayTeam = teamMap.get(match.awayTeam?.toString()) || null;

      // Players
      match.homeStartingPlayers = (match.homeStartingPlayers || [])
        .map((id) => playerMap.get(id.toString()))
        .filter(Boolean);

      match.homeSubstitutes = (match.homeSubstitutes || [])
        .map((id) => playerMap.get(id.toString()))
        .filter(Boolean);

      match.awayStartingPlayers = (match.awayStartingPlayers || [])
        .map((id) => playerMap.get(id.toString()))
        .filter(Boolean);

      match.awaySubstitutes = (match.awaySubstitutes || [])
        .map((id) => playerMap.get(id.toString()))
        .filter(Boolean);
    });

    // Sort by schedule date/time
    populatedMatches.sort((a, b) => {
      const dateA = new Date(
        `${a.matchSchedule?.date}T${a.matchSchedule?.time || "00:00"}`,
      );

      const dateB = new Date(
        `${b.matchSchedule?.date}T${b.matchSchedule?.time || "00:00"}`,
      );

      return dateA - dateB;
    });

    res.json({
      success: true,
      count: populatedMatches.length,
      matches: populatedMatches,
    });
  } catch (error) {
    console.error("Error fetching matches from yesterday onwards:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
      error: error.message,
    });
  }
};

// GET - Get one match by ID with populated teams, schedule and players

const getSingleMatch = async (req, res) => {
  try {
    // Get models
    const Team = Match.db.model("Team");
    const OpponentTeam = Match.db.model("OpponentTeam");
    const Player = Match.db.model("Player");
    const OpponentPlayer = Match.db.model("OpponentPlayer");

    const Schedule = Match.db.model("Schedule");
    const Venue = Match.db.model("Venue");

    // Fetch match without populating teams or players
    const match = await Match.findById(req.params.id).lean();

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    // Collect team IDs
    const teamIds = [match.homeTeam, match.awayTeam]
      .filter(Boolean)
      .map((id) => id.toString());

    // Collect player IDs
    const playerIds = [
      ...(match.homeStartingPlayers || []),
      ...(match.homeSubstitutes || []),
      ...(match.awayStartingPlayers || []),
      ...(match.awaySubstitutes || []),
    ]
      .filter(Boolean)
      .map((id) => id.toString());

    // Fetch club and opponent teams
    const [clubTeams, opponentTeams] = await Promise.all([
      Team.find({ _id: { $in: teamIds } })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),

      OpponentTeam.find({ _id: { $in: teamIds } })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),
    ]);

    // Fetch club and opponent players
    const [clubPlayers, opponentPlayers] = await Promise.all([
      Player.find({ _id: { $in: playerIds } })
        .select("_id name jerseyNumber photo position foot playsFor")
        .lean(),

      OpponentPlayer.find({ _id: { $in: playerIds } })
        .select("_id name jerseyNumber photo position playsFor")
        .lean(),
    ]);

    // Create lookup maps
    const teamMap = new Map(
      [...clubTeams, ...opponentTeams].map((team) => [
        team._id.toString(),
        team,
      ]),
    );

    const playerMap = new Map(
      [...clubPlayers, ...opponentPlayers].map((player) => [
        player._id.toString(),
        player,
      ]),
    );

    // Populate schedule and venue
    let populatedSchedule = null;

    if (match.matchSchedule) {
      populatedSchedule = await Schedule.findById(match.matchSchedule)
        .populate({
          path: "venue",
          select: "_id venue",
        })
        .lean();
    }

    // Return populated match
    const populatedMatch = {
      ...match,

      homeTeam: match.homeTeam
        ? teamMap.get(match.homeTeam.toString()) || null
        : null,

      awayTeam: match.awayTeam
        ? teamMap.get(match.awayTeam.toString()) || null
        : null,

      matchSchedule: populatedSchedule,

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

    return res.status(200).json({
      success: true,
      match: populatedMatch,
    });
  } catch (error) {
    console.error("Error fetching match:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch match",
      error: error.message,
    });
  }
};

const deleteMatch = async (req, res) => {
  // DELETE - Delete a Match
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.id);

    if (!deletedMatch) {
      return res.status(404).json({
        message: "Match not found",
      });
    }

    res.status(200).json({
      message: "Match deleted successfully",
      match: deletedMatch,
    });
  } catch (error) {
    console.error("Error deleting match:", error.message);

    res.status(500).json({
      message: "Failed to delete match",
      error: error.message,
    });
  }
};

const patchMatch = async (req, res) => {
  try {
    const {
      homeTeam,
      awayTeam,
      matchTime,
      matchSchedule,
      homeStartingPlayers,
      homeSubstitutes,
      awayStartingPlayers,
      awaySubstitutes,
    } = req.body;

    // Find existing match
    const existingMatch = await Match.findById(req.params.id);

    if (!existingMatch) {
      return res.status(404).json({
        message: "Match not found",
      });
    }

    // Basic validation
    if (homeTeam && awayTeam && homeTeam === awayTeam) {
      return res.status(400).json({
        message: "Home team and away team cannot be the same",
      });
    }

    // Helper to remove empty values and duplicate IDs
    const cleanPlayerIds = (players) => {
      if (!Array.isArray(players)) return undefined;

      return [...new Set(players.filter(Boolean).map(String))];
    };

    const updateData = {};

    if (homeTeam !== undefined) updateData.homeTeam = homeTeam;
    if (awayTeam !== undefined) updateData.awayTeam = awayTeam;
    if (matchTime !== undefined) updateData.matchTime = matchTime;
    if (matchSchedule !== undefined) {
      updateData.matchSchedule = matchSchedule;
    }

    if (homeStartingPlayers !== undefined) {
      updateData.homeStartingPlayers = cleanPlayerIds(homeStartingPlayers);
    }

    if (homeSubstitutes !== undefined) {
      updateData.homeSubstitutes = cleanPlayerIds(homeSubstitutes);
    }

    if (awayStartingPlayers !== undefined) {
      updateData.awayStartingPlayers = cleanPlayerIds(awayStartingPlayers);
    }

    if (awaySubstitutes !== undefined) {
      updateData.awaySubstitutes = cleanPlayerIds(awaySubstitutes);
    }

    // Prevent the same player from appearing in both starting and substitutes
    const validateSquad = (starting, substitutes, teamName) => {
      if (!starting || !substitutes) return null;

      const overlap = starting.filter((id) => substitutes.includes(id));

      if (overlap.length > 0) {
        return `${teamName}: A player cannot be both a starting player and substitute`;
      }

      return null;
    };

    const homeStarting =
      updateData.homeStartingPlayers ??
      existingMatch.homeStartingPlayers.map(String);

    const homeSubs =
      updateData.homeSubstitutes ?? existingMatch.homeSubstitutes.map(String);

    const awayStarting =
      updateData.awayStartingPlayers ??
      existingMatch.awayStartingPlayers.map(String);

    const awaySubs =
      updateData.awaySubstitutes ?? existingMatch.awaySubstitutes.map(String);

    const homeError = validateSquad(homeStarting, homeSubs, "Home team");

    if (homeError) {
      return res.status(400).json({
        message: homeError,
      });
    }

    const awayError = validateSquad(awayStarting, awaySubs, "Away team");

    if (awayError) {
      return res.status(400).json({
        message: awayError,
      });
    }

    const updatedMatch = await Match.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("homeTeam")
      .populate("awayTeam")
      .populate("matchSchedule")
      .populate("homeStartingPlayers")
      .populate("homeSubstitutes")
      .populate("awayStartingPlayers")
      .populate("awaySubstitutes");

    res.status(200).json({
      message: "Match updated successfully",
      match: updatedMatch,
    });
  } catch (error) {
    console.error("Error updating match:", error.message);

    res.status(400).json({
      message: "Failed to update match",
      error: error.message,
    });
  }
};

export {
  addMatch,
  getUpcomingMatches,
  getSingleMatch,
  patchMatch,
  deleteMatch,
};
