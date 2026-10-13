/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import Venue from "./models/Venue.js";

import {
  addMatch,
  deleteMatch,
  getSingleMatch,
  getUpcomingMatches,
  patchMatch,
} from "./controllers/matchController.js";
import { adminLogin } from "./controllers/authController.js";
import {
  addPlayer,
  getPlayers,
  getDetailedPlayers,
  updatePlayer,
} from "./controllers/playerController.js";
import {
  getOpponentTeams,
  addOpponentTeams,
  getOpponentTeamsDetails,
  addOpponentPlayer,
  updateOpponentPlayer,
  getOpponentPlayers,
} from "./controllers/opponentController.js";
import { getScores, postScore } from "./controllers/scoreController.js";
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

// UPDATE - Update Player
app.patch("/api/players/:id", updatePlayer);

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

// POST /api/venues
app.post("/api/venues", async (req, res) => {
  try {
    const { venue, direction } = req.body;

    if (!venue || !direction) {
      return res.status(400).json({
        message: "Venue and direction are required",
      });
    }

    const newVenue = new Venue({
      venue,
      direction,
    });

    const savedVenue = await newVenue.save();

    res.status(201).json({
      message: "Venue added successfully",
      venue: savedVenue,
    });
  } catch (error) {
    console.error("Error adding venue:", error);

    res.status(400).json({
      message: "Failed to add venue",
      error: error.message,
    });
  }
});

// GET /api/venues
app.get("/api/venues", async (req, res) => {
  try {
    const venues = await Venue.find().sort({ venue: 1 });

    res.status(200).json(venues);
  } catch (error) {
    console.error("Error fetching venues:", error);

    res.status(500).json({
      message: "Failed to fetch venues",
      error: error.message,
    });
  }
});

// ===============================
// MATCH API
// ===============================

// POST - Add a new Match
app.post("/api/matches", addMatch);

// GET - All Upcoming Matches
app.get("/api/matches", getUpcomingMatches);

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
