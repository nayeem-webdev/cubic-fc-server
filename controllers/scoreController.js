import Score from "../models/Score.js";

const getScores = async (req, res) => {
  try {
    const scores = await Score.find()
      // Populate Match
      .populate({
        path: "match",
        select:
          "_id matchSchedule matchType matchTime playersPerTeam homeStartingPlayers homeSubstitutes awayStartingPlayers awaySubstitutes",

        populate: [
          // Populate Match Schedule
          {
            path: "matchSchedule",
            select: "date venue matchType",
            populate: {
              path: "venue",
              select: "venue",
            },
          },

          // Populate Home Starting Players
          {
            path: "homeStartingPlayers",
            select: "_id name jerseyNumber photo position",
          },

          // Populate Home Substitutes
          {
            path: "homeSubstitutes",
            select: "_id name jerseyNumber photo position",
          },

          // Populate Away Starting Players
          {
            path: "awayStartingPlayers",
            select: "_id name jerseyNumber photo position",
          },

          // Populate Away Substitutes
          {
            path: "awaySubstitutes",
            select: "_id name jerseyNumber photo position",
          },
        ],
      })

      // Populate Home Team
      .populate({
        path: "homeTeam",
        select: "_id name shortForm logoLow logoHigh",
      })

      // Populate Away Team
      .populate({
        path: "awayTeam",
        select: "_id name shortForm logoLow logoHigh",
      })

      // Latest finished match first
      .sort({ finishedAt: -1 });

    res.status(200).json({
      success: true,
      scores,
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

export { getScores };
