import Venue from "../models/Venue.js";

// POST - Add a new Venue
const addVenue = async (req, res) => {
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
};

const getVenue = async (req, res) => {
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
};

export { addVenue, getVenue };
