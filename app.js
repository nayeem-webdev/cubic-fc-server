/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { adminLogin } from "./controllers/authController.js";
import {
  addMatch,
  deleteMatch,
  getAllMatches,
  getSingleMatch,
  getUpcomingMatches,
  patchMatch,
} from "./controllers/matchController.js";
import {
  addPlayer,
  getPlayers,
  getDetailedPlayers,
  updatePlayer,
  deletePlayer,
  bulkUpdatePlayers,
} from "./controllers/playerController.js";
import {
  getOpponentTeams,
  addOpponentTeams,
  getOpponentTeamsDetails,
  addOpponentPlayer,
  updateOpponentPlayer,
  getOpponentPlayers,
  deleteOpponentPlayer,
} from "./controllers/opponentController.js";
import {
  getScoreDetails,
  getScoreById,
  getScores,
  getScoreSummary,
  getSimpleScores,
  postScore,
  updateScore,
} from "./controllers/scoreController.js";
import {
  addTeams,
  getTeams,
  getTeamsDetails,
} from "./controllers/teamController.js";
import {
  createSchedule,
  getSchedules,
  deleteSchedule,
  updateSchedule,
} from "./controllers/scheduleController.js";
import { addVenue, getVenue } from "./controllers/venueController.js";

const app = express();

app.use(cors());
app.use(express.json());

// Test API
app.get("/", (req, res) => {
  res.json({
    message: "CUBIC FC API is running!",
  });
});

// Auth API
app.post("/api/auth/login", adminLogin);

// ===============================
// PLAYER API
// ===============================

// POST - Add a new player
app.post("/api/players", addPlayer);

// GET - Get All Players
app.get("/api/players", getPlayers);

// GET - Get All Players with Details
app.get("/api/player-details", getDetailedPlayers);

// UPDATE - Update Bulk Player
app.patch("/api/players/bulk-update", bulkUpdatePlayers);

// UPDATE - Update Player
app.patch("/api/players/:id", updatePlayer);

// DELETE - Delete Player
app.delete("/api/players/:id", deletePlayer);

// ===============================
// TEAMS API
// ===============================

// POST - Register Team
app.post("/api/teams", addTeams);

// GET - Get All Teams
app.get("/api/teams", getTeams);

// GET - Teams, stats
app.get("/api/teams-details", getTeamsDetails);

// ===============================
// OPPONENT PLAYER API
// ===============================

// POST - Add a new player
app.post("/api/opponent-players", addOpponentPlayer);

// GET - Get All Players
app.get("/api/opponent-players", getOpponentPlayers);

// UPDATE - Update Player
app.patch("/api/opponent-players/:id", updateOpponentPlayer);

// POST - Register Opponent
app.post("/api/opponent-teams", addOpponentTeams);

// GET - Get All Opponent
app.get("/api/opponent-teams", getOpponentTeams);

// DELETE - Delete Player
app.delete("/api/opponent-players/:id", deleteOpponentPlayer);

// GET - Opponent, stats
app.get("/api/opponent-teams-details", getOpponentTeamsDetails);

// ===============================
// SCHEDULE API
// ===============================

// POST - Add a new Schedule
app.post("/api/schedule", createSchedule);

// GET - Get All Schedules
app.get("/api/schedules", getSchedules);

// DELETE - Delete Schedules
app.delete("/api/schedules/:id", deleteSchedule);

// UPDATE - Update Schedules
app.patch("/api/schedules/:id", updateSchedule);

// ===============================
// VENUE API
// ===============================

// POST - Add a new Venue
app.post("/api/venues", addVenue);

// GET - Get All Venue
app.get("/api/venues", getVenue);

// ===============================
// MATCH API
// ===============================

// POST - Add a new Match
app.post("/api/matches", addMatch);

// GET - All Upcoming Matches
app.get("/api/matches", getUpcomingMatches);

// GET - All Upcoming Matches
app.get("/api/all-matches", getAllMatches);

// DELETE - Delete a Matches
app.delete("/api/matches/:id", deleteMatch);

// GET - Single Matches With ID
app.get("/api/matches/:id", getSingleMatch);

// PATCH - Update an existing Match
app.patch("/api/matches/:id", patchMatch);

// ===============================
// SCORE API
// ===============================

// POST - Save completed match score
app.post("/api/scores", postScore);

// GET - Get all saved match scores
app.get("/api/scores", getScores);

// GET - Get all saved match scores
app.get("/api/simple-scores", getSimpleScores);

// GET - Get All saved match Summerized scores
app.get("/api/scores/summary", getScoreSummary);

// GET - Get all IDd saved match scores
app.get("/api/scores/:id", getScoreById);

// GET - Get all IDd saved match scores
app.get("/api/scores/detailed/:id", getScoreDetails);

// UPDATE - UPDATE all saved match scores
app.patch("/api/scores/:id", updateScore);

// ===============================
// CONNECT TO MONGODB
// ===============================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongo Connected");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
