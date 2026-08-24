import { Schema, model } from "mongoose";

const venueSchema = new Schema(
  {
    venue: {
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

export default model("Venue", venueSchema);
