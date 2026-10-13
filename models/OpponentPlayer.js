import { Schema, model } from "mongoose";

const opponentPlayerSchema = new Schema(
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

    playsFor: {
      type: Schema.Types.ObjectId,
      ref: "OpponentTeam",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const OpponentPlayer = model("OpponentPlayer", opponentPlayerSchema);

export default OpponentPlayer;
