import { Schema, model } from "mongoose";

const teamSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    logoHigh: {
      type: String,
      default: "",
    },

    logoLow: {
      type: String,
      default: "",
    },

    shortForm: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    captain: {
      type: Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Team", teamSchema);
