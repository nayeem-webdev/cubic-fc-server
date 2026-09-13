import Team from "../models/Team.js";
import Player from "../models/Player.js";
import Score from "../models/Score.js";

const getTeams = async (req, res) => {
  try {
    const teams = await Team.find({})
      .populate("captain", "_id name photo jerseyNumber position")
      .lean();

    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        // Get all players belonging to this team
        const players = await Player.find({
          playsFor: team._id,
        })
          .select(
            "_id name photo jerseyNumber position foot dateOfBirth playsFor",
          )
          .sort({ jerseyNumber: 1 })
          .lean();

        // Get all completed scores involving this team
        const scores = await Score.find({
          $and: [
            {
              $or: [{ homeTeam: team._id }, { awayTeam: team._id }],
            },
            { "timer.finished": true },
          ],
        })
          .select("homeTeam awayTeam homeScore awayScore timer finishedAt")
          .lean();

        let won = 0;
        let draw = 0;
        let lost = 0;

        scores.forEach((score) => {
          const isHome = score.homeTeam.toString() === team._id.toString();

          const teamScore = isHome ? score.homeScore : score.awayScore;

          const opponentScore = isHome ? score.awayScore : score.homeScore;

          if (teamScore > opponentScore) {
            won++;
          } else if (teamScore === opponentScore) {
            draw++;
          } else {
            lost++;
          }
        });

        return {
          ...team,
          players,
          statistics: {
            played: scores.length,
            won,
            draw,
            lost,
          },
        };
      }),
    );

    res.json({
      success: true,
      count: teamsWithStats.length,
      teams: teamsWithStats,
    });
  } catch (error) {
    console.error("Error fetching teams:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch teams",
      error: error.message,
    });
  }
};

export { getTeams };
