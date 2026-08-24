/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Player from "./models/Player.js";
import Schedule from "./models/Schedule.js";
import Team from "./models/Team.js";
import Match from "./models/Match.js";
import Venue from "./models/Venue.js";

import { getUpcomingMatches } from "./controllers/matchController.js";

const app = express();

app.use(cors());
app.use(express.json());

// Test API
app.get("/", (req, res) => {
  res.json({
    message: "CUBIC FC API is running!",
  });
});

// ===============================
// PLAYER API
// ===============================

// POST - Add a new player
app.post("/api/players", async (req, res) => {
  try {
    const player = new Player(req.body);

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
});

// GET - Get All Players
app.get("/api/players", async (req, res) => {
  try {
    const players = await Player.find().sort({ createdAt: -1 });

    res.status(200).json(players);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get players",
      error: error.message,
    });
  }
});

// POST - Add a new Schedule
app.post("/api/schedule", async (req, res) => {
  try {
    const schedule = new Schedule(req.body);

    const savedSchedule = await schedule.save();

    res.status(201).json({
      message: "Schedule added successfully",
      schedule: savedSchedule,
    });
  } catch (error) {
    console.error("Error adding schedule:", error.message);

    res.status(400).json({
      message: "Failed to add schedule",
      error: error.message,
    });
  }
});

// GET - Get All Schedules
app.get("/api/schedules", async (req, res) => {
  try {
    const schedules = await Schedule.find().populate("venue").sort({ date: 1 });

    const todayBD = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const filteredSchedules = schedules.filter((schedule) => {
      return schedule.date >= todayBD;
    });

    res.status(200).json(filteredSchedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);

    res.status(500).json({
      message: "Failed to fetch schedules",
      error: error.message,
    });
  }
});

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

// POST - Register Team
app.post("/api/teams", async (req, res) => {
  try {
    const team = new Team(req.body);

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
});

// GET - Get All Teams
app.get("/api/teams", async (req, res) => {
  try {
    const teams = await Team.find()
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
});

// POST - Add a new Match
app.post("/api/matches", async (req, res) => {
  try {
    const match = new Match(req.body);

    const savedMatch = await match.save();

    res.status(201).json({
      message: "Match created successfully",
      match: savedMatch,
    });
  } catch (error) {
    console.error("Error creating match:", error.message);

    res.status(400).json({
      message: "Failed to create match",
      error: error.message,
    });
  }
});

// GET - All Upcoming Matches
app.get("/api/matches", getUpcomingMatches);

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
