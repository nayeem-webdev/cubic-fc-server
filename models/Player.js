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
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    dateOfBirth: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "retired"],
      default: "active",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Player = model("Player", playerSchema);

export default Player;
