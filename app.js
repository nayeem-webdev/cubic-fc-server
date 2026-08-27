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
import Score from "./models/Score.js";

import { getUpcomingMatches } from "./controllers/matchController.js";
import { adminLogin } from "./controllers/authController.js";
import { adminAuth } from "./middleware/adminAuth.js";

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

app.post("/api/auth/login", adminLogin);

// POST - Add a new player
app.post("/api/players", adminAuth, async (req, res) => {
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

// UPDATE - Update Player
app.patch("/api/players/:id", adminAuth, async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

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
});

// POST - Add a new Schedule
app.post("/api/schedule", adminAuth, async (req, res) => {
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
app.post("/api/venues", adminAuth, async (req, res) => {
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
app.post("/api/teams", adminAuth, async (req, res) => {
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
app.post("/api/matches", adminAuth, async (req, res) => {
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

// POST - Save completed match score
app.post("/api/scores", adminAuth, async (req, res) => {
  try {
    const {
      match,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      timer,
      matchEvents,
      homeStartingPlayers,
      homeSubstitutes,
      awayStartingPlayers,
      awaySubstitutes,
    } = req.body;

    if (!match || !homeTeam || !awayTeam) {
      return res.status(400).json({
        message: "Match and teams are required",
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
      homeStartingPlayers,
      homeSubstitutes,
      awayStartingPlayers,
      awaySubstitutes,
      finishedAt: new Date(),
    });

    const savedScore = await score.save();

    res.status(201).json({
      message: "Match score saved successfully",
      score: savedScore,
    });
  } catch (error) {
    console.error("Error saving match score:", error);

    res.status(500).json({
      message: "Failed to save match score",
      error: error.message,
    });
  }
});

// GET - Get all saved match scores
app.get("/api/scores", async (req, res) => {
  try {
    const scores = await Score.find()
      .populate({
        path: "match",
        select: "_id matchSchedule matchType matchTime playersPerTeam",
        populate: {
          path: "matchSchedule",
          select: "date venue matchType",
          populate: {
            path: "venue",
            select: "venue",
          },
        },
      })
      .populate({
        path: "homeTeam",
        select: "_id name shortForm logoLow logoHigh",
      })
      .populate({
        path: "awayTeam",
        select: "_id name shortForm logoLow logoHigh",
      })
      .populate({
        path: "homeStartingPlayers",
        select: "_id name jerseyNumber photo position",
      })
      .populate({
        path: "homeSubstitutes",
        select: "_id name jerseyNumber photo position",
      })
      .populate({
        path: "awayStartingPlayers",
        select: "_id name jerseyNumber photo position",
      })
      .populate({
        path: "awaySubstitutes",
        select: "_id name jerseyNumber photo position",
      })
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
    });
  }
});

// GET - Match score summary
app.get("/api/scores/summary", async (req, res) => {
  try {
    const scores = await Score.find()
      .select("_id match homeTeam awayTeam homeScore awayScore finishedAt")
      .populate({
        path: "homeTeam",
        select: "_id name shortForm logoLow",
      })
      .populate({
        path: "awayTeam",
        select: "_id name shortForm logoLow",
      })
      .sort({ finishedAt: -1 });

    res.status(200).json({
      success: true,
      scores,
    });
  } catch (error) {
    console.error("Error fetching score summaries:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch match score summaries",
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
