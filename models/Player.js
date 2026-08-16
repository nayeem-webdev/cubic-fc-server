import { Schema, model } from "mongoose";

const playerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    position: {
      type: String,
      required: true,
      enum: ["GK", "DF", "MF", "FW", "ST"],
    },

    jerseyNumber: {
      type: Number,
      required: true,
    },

    photo: {
      type: String,
      default: "",
    },

    foot: {
      type: String,
      enum: ["Right", "Left", "Both"],
      default: "Right",
    },

    playsFor: {
      type: String,
      required: true,
    },

    clubLogo: {
      type: String,
      default: "",
    },

    dateOfBirth: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const Player = model("Player", playerSchema);

export default Player;
