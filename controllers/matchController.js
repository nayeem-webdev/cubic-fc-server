import Schedule from "../models/Schedule.js";
import Match from "../models/Match.js";

const getUpcomingMatches = async (req, res) => {
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date());
    // Get today's and future schedules
    const schedules = await Schedule.find({
      date: { $gte: today },
    }).select("_id venue date time");

    const scheduleIds = schedules.map((schedule) => schedule._id);

    // Get matches belonging to those schedules
    const matches = await Match.find({
      matchSchedule: { $in: scheduleIds },
    })
      .populate({
        path: "homeTeam",
        select: "_id name logoLow",
      })
      .populate({
        path: "awayTeam",
        select: "_id name logoLow",
      })
      .populate({
        path: "matchSchedule",
        select: "_id venue date time",
      })
      .populate({
        path: "homeStartingPlayers",
        select: "_id name jerseyNumber position",
      })
      .populate({
        path: "homeSubstitutes",
        select: "_id name jerseyNumber position",
      })
      .populate({
        path: "awayStartingPlayers",
        select: "_id name jerseyNumber position",
      })
      .populate({
        path: "awaySubstitutes",
        select: "_id name jerseyNumber position",
      });

    res.status(200).json({
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
