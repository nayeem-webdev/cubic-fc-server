/* eslint-disable no-undef */
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Player from "./models/Player.js";
import Schedule from "./models/Schedule.js";

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedules = await Schedule.find({
      date: {
        $gte: today.toISOString().split("T")[0],
      },
    }).sort({ date: 1 });

    res.status(200).json(schedules);
  } catch (error) {
    console.error("Error getting schedules:", error.message);

    res.status(500).json({
      message: "Failed to get schedules",
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
    const teams = await Team.find().populate("captain").sort({ createdAt: -1 });

    res.status(200).json(teams);
  } catch (error) {
    console.error("Error getting teams:", error.message);

    res.status(500).json({
      message: "Failed to get teams",
      error: error.message,
    });
  }
});

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
