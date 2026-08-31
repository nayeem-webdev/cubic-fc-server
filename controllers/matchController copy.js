import Match from "../models/Match.js";

const getUpcomingMatches = async (req, res) => {
  try {
    const matches = await Match.find({})
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
      .lean();

    // Sort by schedule date and time
    matches.sort((a, b) => {
      const dateA = `${a.matchSchedule?.date || ""} ${a.matchSchedule?.time || ""}`;
      const dateB = `${b.matchSchedule?.date || ""} ${b.matchSchedule?.time || ""}`;

      return dateA.localeCompare(dateB);
    });

    res.json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
      error: error.message,
    });
  }
};

export { getUpcomingMatches };
