import Match from "../models/Match.js";

const getUpcomingMatches = async (req, res) => {
  try {
    const now = new Date();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(now);

    const tomorrow = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    // Get ONLY today's schedules
    const scheduleIds = await Match.db
      .model("Schedule")
      .find({
        date: {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .distinct("_id");

    // Get ONLY today's matches
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
      .sort({ "matchSchedule.time": 1 });

    res.json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Error fetching today's matches:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch today's matches",
      error: error.message,
    });
  }
};

export { getUpcomingMatches };
