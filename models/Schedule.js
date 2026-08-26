import { Schema, model } from "mongoose";

const scheduleSchema = new Schema(
  {
    venue: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },

    date: {
      type: String,
      required: true,
      trim: true,
    },

    time: {
      type: String,
      required: true,
      trim: true,
    },

    matchFormat: {
      type: String,
      required: true,
      trim: true,
    },

    matchType: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Schedule = model("Schedule", scheduleSchema);

export default Schedule;
