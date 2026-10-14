import OpponentTeam from "../models/OpponentTeam.js";
import OpponentPlayer from "../models/OpponentPlayer.js";
import Score from "../models/Score.js";

// ADD OPPONENT TEAM
const addOpponentTeams = async (req, res) => {
  try {
    const team = new OpponentTeam(req.body);

    const savedTeam = await team.save();

    res.status(201).json({
      message: "Team registered successfully",
      team: savedTeam,
    });
  } catch (error) {
    console.error("Error registering team:", error.message);

    res.status(400).json({
      message: "Failed to register team",
      error: error.message,
    });
  }
};
// GET OPPONENT TEAMS
const getOpponentTeams = async (req, res) => {
  try {
    const teams = await OpponentTeam.find()
      .populate("captain", "name position jerseyNumber photo")
      .sort({ createdAt: -1 });

    res.status(200).json(teams);
  } catch (error) {
    console.error("Error getting teams:", error.message);

    res.status(500).json({
      message: "Failed to get teams",
      error: error.message,
    });
  }
};

// GET OPPONENT TEAM DETAILS
const getOpponentTeamsDetails = async (req, res) => {
  try {
    const teams = await OpponentTeam.find({})
      .populate("captain", "_id name photo jerseyNumber position")
      .lean();

    const teamsWithStats = await Promise.all(
      teams.map(async (team) => {
        // Get all players belonging to this team
        const players = await OpponentPlayer.find({
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

// ADD OPPONENT PLAYER
const addOpponentPlayer = async (req, res) => {
  try {
    const player = new OpponentPlayer(req.body);

    const savedPlayer = await player.save();

    res.status(201).json({
      message: "Player added successfully",
      player: savedPlayer,
    });
  } catch (error) {
    console.error("Error adding player:", error.message);

    res.status(400).json({
      message: "Failed to add player",
      error: error.message,
    });
  }
};

// UPDATE OPPONENT PLAYER
const updateOpponentPlayer = async (req, res) => {
  try {
    const player = await OpponentPlayer.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!player) {
      return res.status(404).json({
        message: "Player not found",
      });
    }

    res.status(200).json(player);
  } catch (error) {
    console.error("Error updating player:", error);

    res.status(500).json({
      message: "Failed to update player",
      error: error.message,
    });
  }
};

// GET ALL PLAYERS WITH TEAM
const getOpponentPlayers = async (req, res) => {
  try {
    const players = await OpponentPlayer.find()
      .populate("playsFor", "_id name logoLow")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(players);
  } catch (error) {
    console.error("Get opponent players error:", error);

    return res.status(500).json({
      message: "Failed to get opponent players",
      error: error.message,
    });
  }
};

// DELETE PLAYERS

const deleteOpponentPlayer = async (req, res) => {
  try {
    const player = await OpponentPlayer.findByIdAndDelete(req.params.id);

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    return res.status(200).json({ message: "Player deleted successfully" });
  } catch (error) {
    console.error("Error deleting player:", error);
    return res.status(500).json({ message: "Server error deleting player" });
  }
};

export {
  getOpponentTeams,
  addOpponentTeams,
  getOpponentTeamsDetails,
  addOpponentPlayer,
  updateOpponentPlayer,
  getOpponentPlayers,
  deleteOpponentPlayer,
};
