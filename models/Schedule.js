import { Schema, model } from "mongoose";

const scheduleSchema = new Schema(
  {
    venue: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      default: "",
    },

    time: {
      type: String,
      required: true,
      trim: true,
    },

    direction: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Schedule", scheduleSchema);
