import Match from "../models/Match.js";

const getUpcomingMatches = async (req, res) => {
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date());

    // Get IDs of today's and upcoming schedules
    const scheduleIds = await Match.db
      .model("Schedule")
      .find({ date: { $gte: today } })
      .distinct("_id");

    // Get today's and upcoming matches
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
      .populate("awaySubstitutes", "_id name photo jerseyNumber position")
      .sort({ matchSchedule: 1 });

    res.json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming matches",
      error: error.message,
    });
  }
};

export { getUpcomingMatches };
