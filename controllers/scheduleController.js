import Schedule from "../models/Schedule.js";

// @desc    Get all schedules
// @route   GET /api/schedules
export const getSchedules = async (req, res) => {
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
};

// @desc    Get single schedule by ID
// @route   GET /api/schedules/:id
export const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    return res.status(200).json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return res.status(500).json({ message: "Server error fetching schedule" });
  }
};

// @desc    Update a schedule
// @route   PUT /api/schedules/:id
export const updateSchedule = async (req, res) => {
  try {
    const { matchType, matchFormat, date, time, venue } = req.body;

    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Update simple fields
    if (matchType) schedule.matchType = matchType;
    if (matchFormat) schedule.matchFormat = matchFormat;
    if (date) schedule.date = date;
    if (time) schedule.time = time;

    // Safely update venue depending on structure
    if (venue) {
      if (typeof venue === "string") {
        // If venue is a Schema ObjectId reference ID
        schedule.venue = venue;
      } else if (typeof venue === "object") {
        // If venue is an embedded object
        schedule.venue = {
          venue: venue.venue || schedule.venue?.venue || "",
          address: venue.address || schedule.venue?.address || "",
        };
      }
    }

    let updatedSchedule = await schedule.save();

    // Re-populate venue before returning if venue is an ObjectId reference
    if (schedule.schema.path("venue")?.options?.ref) {
      updatedSchedule = await updatedSchedule.populate("venue");
    }

    return res.status(200).json(updatedSchedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({
      message: "Server error updating schedule",
      error: error.message,
    });
  }
};

// @desc    Create a schedule
// @route   POST /api/schedules
export const createSchedule = async (req, res) => {
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
};

// @desc    Delete a schedule
// @route   DELETE /api/schedules/:id
export const deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    return res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({ message: "Server error deleting schedule" });
  }
};
