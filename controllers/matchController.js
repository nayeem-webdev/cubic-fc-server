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

// get All Upcoming & Recent Matches (Yesterday and later)
const getUpcomingMatches = async (req, res) => {
  try {
    const now = new Date();

    // Calculate yesterday's date in Asia/Dhaka time zone (YYYY-MM-DD)
    const yesterday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // Get Schedule IDs from yesterday onwards
    const scheduleIds = await Match.db
      .model("Schedule")
      .find({
        date: {
          $gte: yesterday, // Greater than or equal to yesterday
        },
      })
      .distinct("_id");

    // Get matches matching those schedules
    const matches = await Match.find({
      matchSchedule: { $in: scheduleIds },
    })
      .populate("homeTeam", "_id name logoLow")
      .populate("awayTeam", "_id name logoLow")
      .populate({
        path: "matchSchedule",
        select: "_id venue date time matchFormat matchType",
        populate: {
          path: "venue",
          select: "_id venue",
        },
      })
      .populate("homeStartingPlayers", "_id name photo jerseyNumber position")
      .populate("homeSubstitutes", "_id name photo jerseyNumber position")
      .populate("awayStartingPlayers", "_id name photo jerseyNumber position")
      .populate("awaySubstitutes", "_id name photo jerseyNumber position");

    // Sort in memory by date and time (ascending) since populated fields can't be sorted directly in MongoDB `.sort()`
    matches.sort((a, b) => {
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
      count: matches.length,
      matches,
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
    const match = await Match.findById(req.params.id)
      .populate("homeTeam")
      .populate("awayTeam")
      .populate({
        path: "matchSchedule",
        populate: { path: "venue" },
      })
      .populate("homeStartingPlayers")
      .populate("homeSubstitutes")
      .populate("awayStartingPlayers")
      .populate("awaySubstitutes");

    if (!match) {
      return res.status(404).json({
        message: "Match not found",
      });
    }

    res.status(200).json({
      success: true,
      match,
    });
  } catch (error) {
    console.error("Error fetching match:", error.message);

    res.status(500).json({
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
