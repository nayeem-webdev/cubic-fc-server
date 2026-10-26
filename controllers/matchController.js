import Match from "../models/Match.js";

// ============================================================
// ADD MATCH
// ============================================================

const addMatch = async (req, res) => {
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

// ============================================================
// GET UPCOMING MATCHES
// ============================================================

const getUpcomingMatches = async (req, res) => {
  try {
    const now = new Date();

    // Yesterday's date in Asia/Dhaka
    const yesterday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Models
    const Schedule = Match.db.model("Schedule");
    const Team = Match.db.model("Team");
    const Player = Match.db.model("Player");
    const OpponentTeam = Match.db.model("OpponentTeam");
    const OpponentPlayer = Match.db.model("OpponentPlayer");

    // ----------------------------------------------------------
    // Get schedules from yesterday onwards
    // ----------------------------------------------------------

    const scheduleIds = await Schedule.find({
      date: {
        $gte: yesterday,
      },
    }).distinct("_id");

    // ----------------------------------------------------------
    // Get matches
    // ----------------------------------------------------------

    const matches = await Match.find({
      matchSchedule: {
        $in: scheduleIds,
      },
    }).lean();

    // ----------------------------------------------------------
    // Collect IDs
    // ----------------------------------------------------------

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

    const uniqueTeamIds = [...new Set(teamIds.map((id) => id.toString()))];

    const uniquePlayerIds = [...new Set(playerIds.map((id) => id.toString()))];

    // ----------------------------------------------------------
    // Fetch teams
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Fetch players
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Create lookup maps
    // ----------------------------------------------------------

    const teamMap = new Map(
      [...teams, ...opponentTeams].map((team) => [team._id.toString(), team]),
    );

    const playerMap = new Map(
      [...players, ...opponentPlayers].map((player) => [
        player._id.toString(),
        player,
      ]),
    );

    // ----------------------------------------------------------
    // Populate schedules
    // ----------------------------------------------------------

    const populatedMatches = await Match.populate(matches, {
      path: "matchSchedule",
      select: "_id venue date time matchFormat matchType",
      populate: {
        path: "venue",
        select: "_id venue",
      },
    });

    // ----------------------------------------------------------
    // Populate teams and players
    // ----------------------------------------------------------

    populatedMatches.forEach((match) => {
      match.homeTeam = teamMap.get(match.homeTeam?.toString()) || null;

      match.awayTeam = teamMap.get(match.awayTeam?.toString()) || null;

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

    // ----------------------------------------------------------
    // Sort by date only
    // Oldest → latest
    // ----------------------------------------------------------

    populatedMatches.sort((a, b) => {
      return (a.matchSchedule?.date || "").localeCompare(
        b.matchSchedule?.date || "",
      );
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

// ============================================================
// GET ALL MATCHES - PAGINATED
// ============================================================

const getAllMatches = async (req, res) => {
  try {
    // ----------------------------------------------------------
    // Pagination
    // ----------------------------------------------------------

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const limit = 6;
    const skip = (page - 1) * limit;

    // ----------------------------------------------------------
    // Models
    // ----------------------------------------------------------

    const Schedule = Match.db.model("Schedule");
    const Team = Match.db.model("Team");
    const OpponentTeam = Match.db.model("OpponentTeam");

    // ----------------------------------------------------------
    // Get matches
    // No player/substitute data needed here
    // ----------------------------------------------------------

    const matches = await Match.find()
      .select(
        "_id homeTeam awayTeam matchTime matchSchedule createdAt updatedAt",
      )
      .lean();

    // ----------------------------------------------------------
    // No matches
    // ----------------------------------------------------------

    if (!matches.length) {
      return res.json({
        success: true,

        pagination: {
          page,
          limit,
          totalMatches: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },

        count: 0,
        matches: [],
      });
    }

    // ----------------------------------------------------------
    // Get schedule IDs
    // ----------------------------------------------------------

    const scheduleIds = [
      ...new Set(
        matches.map((match) => match.matchSchedule?.toString()).filter(Boolean),
      ),
    ];

    // ----------------------------------------------------------
    // Get schedules
    // ----------------------------------------------------------

    const schedules = await Schedule.find({
      _id: {
        $in: scheduleIds,
      },
    })
      .select("_id venue date time matchFormat matchType")
      .populate({
        path: "venue",
        select: "_id venue",
      })
      .lean();

    // ----------------------------------------------------------
    // Schedule lookup map
    // ----------------------------------------------------------

    const scheduleMap = new Map(
      schedules.map((schedule) => [schedule._id.toString(), schedule]),
    );

    // ----------------------------------------------------------
    // Get team IDs
    // ----------------------------------------------------------

    const teamIds = [];

    matches.forEach((match) => {
      if (match.homeTeam) {
        teamIds.push(match.homeTeam);
      }

      if (match.awayTeam) {
        teamIds.push(match.awayTeam);
      }
    });

    const uniqueTeamIds = [...new Set(teamIds.map((id) => id.toString()))];

    // ----------------------------------------------------------
    // Fetch teams from both collections
    // ----------------------------------------------------------

    const [teams, opponentTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name logoLow")
        .lean(),

      OpponentTeam.find({
        _id: {
          $in: uniqueTeamIds,
        },
      })
        .select("_id name logoLow")
        .lean(),
    ]);

    // ----------------------------------------------------------
    // Team lookup map
    // ----------------------------------------------------------

    const teamMap = new Map(
      [...teams, ...opponentTeams].map((team) => [team._id.toString(), team]),
    );

    // ----------------------------------------------------------
    // Attach schedule + teams
    // ----------------------------------------------------------

    const populatedMatches = matches.map((match) => ({
      ...match,

      matchSchedule: scheduleMap.get(match.matchSchedule?.toString()) || null,

      homeTeam: teamMap.get(match.homeTeam?.toString()) || null,

      awayTeam: teamMap.get(match.awayTeam?.toString()) || null,
    }));

    // ----------------------------------------------------------
    // Sort by DATE ONLY
    // Latest → oldest
    //
    // Time is completely ignored.
    // ----------------------------------------------------------

    populatedMatches.sort((a, b) => {
      return (b.matchSchedule?.date || "").localeCompare(
        a.matchSchedule?.date || "",
      );
    });

    // ----------------------------------------------------------
    // Pagination
    // ----------------------------------------------------------

    const totalMatches = populatedMatches.length;
    const totalPages = Math.ceil(totalMatches / limit);

    const paginatedMatches = populatedMatches.slice(skip, skip + limit);

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    return res.json({
      success: true,

      pagination: {
        page,
        limit,
        totalMatches,
        totalPages,

        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },

      count: paginatedMatches.length,
      matches: paginatedMatches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE MATCH
// ============================================================

const getSingleMatch = async (req, res) => {
  try {
    const Team = Match.db.model("Team");
    const OpponentTeam = Match.db.model("OpponentTeam");
    const Player = Match.db.model("Player");
    const OpponentPlayer = Match.db.model("OpponentPlayer");
    const Schedule = Match.db.model("Schedule");

    // ----------------------------------------------------------
    // Get match
    // ----------------------------------------------------------

    const match = await Match.findById(req.params.id).lean();

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    // ----------------------------------------------------------
    // Collect team IDs
    // ----------------------------------------------------------

    const teamIds = [match.homeTeam, match.awayTeam]
      .filter(Boolean)
      .map((id) => id.toString());

    // ----------------------------------------------------------
    // Collect player IDs
    // ----------------------------------------------------------

    const playerIds = [
      ...(match.homeStartingPlayers || []),
      ...(match.homeSubstitutes || []),
      ...(match.awayStartingPlayers || []),
      ...(match.awaySubstitutes || []),
    ]
      .filter(Boolean)
      .map((id) => id.toString());

    // ----------------------------------------------------------
    // Fetch teams
    // ----------------------------------------------------------

    const [clubTeams, opponentTeams] = await Promise.all([
      Team.find({
        _id: {
          $in: teamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),

      OpponentTeam.find({
        _id: {
          $in: teamIds,
        },
      })
        .select("_id name shortForm logoLow logoHigh")
        .lean(),
    ]);

    // ----------------------------------------------------------
    // Fetch players
    // ----------------------------------------------------------

    const [clubPlayers, opponentPlayers] = await Promise.all([
      Player.find({
        _id: {
          $in: playerIds,
        },
      })
        .select("_id name jerseyNumber photo position foot playsFor")
        .lean(),

      OpponentPlayer.find({
        _id: {
          $in: playerIds,
        },
      })
        .select("_id name jerseyNumber photo position playsFor")
        .lean(),
    ]);

    // ----------------------------------------------------------
    // Lookup maps
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Populate schedule
    // ----------------------------------------------------------

    let populatedSchedule = null;

    if (match.matchSchedule) {
      populatedSchedule = await Schedule.findById(match.matchSchedule)
        .populate({
          path: "venue",
          select: "_id venue",
        })
        .lean();
    }

    // ----------------------------------------------------------
    // Build response
    // ----------------------------------------------------------

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

// ============================================================
// DELETE MATCH
// ============================================================

const deleteMatch = async (req, res) => {
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

// ============================================================
// PATCH MATCH
// ============================================================

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

    // ----------------------------------------------------------
    // Find existing match
    // ----------------------------------------------------------

    const existingMatch = await Match.findById(req.params.id);

    if (!existingMatch) {
      return res.status(404).json({
        message: "Match not found",
      });
    }

    // ----------------------------------------------------------
    // Validate teams
    // ----------------------------------------------------------

    if (homeTeam && awayTeam && homeTeam === awayTeam) {
      return res.status(400).json({
        message: "Home team and away team cannot be the same",
      });
    }

    // ----------------------------------------------------------
    // Clean player IDs
    // ----------------------------------------------------------

    const cleanPlayerIds = (players) => {
      if (!Array.isArray(players)) return undefined;

      return [...new Set(players.filter(Boolean).map(String))];
    };

    // ----------------------------------------------------------
    // Build update data
    // ----------------------------------------------------------

    const updateData = {};

    if (homeTeam !== undefined) {
      updateData.homeTeam = homeTeam;
    }

    if (awayTeam !== undefined) {
      updateData.awayTeam = awayTeam;
    }

    if (matchTime !== undefined) {
      updateData.matchTime = matchTime;
    }

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

    // ----------------------------------------------------------
    // Validate squad overlap
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Update match
    // ----------------------------------------------------------

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

// ============================================================
// EXPORTS
// ============================================================

export {
  addMatch,
  getUpcomingMatches,
  getAllMatches,
  getSingleMatch,
  patchMatch,
  deleteMatch,
};
