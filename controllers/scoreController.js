import Score from "../models/Score.js";

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

export { getScores, postScore };
