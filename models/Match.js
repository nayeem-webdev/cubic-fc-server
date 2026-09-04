import { Schema, model } from "mongoose";

const matchSchema = new Schema(
  {
    homeTeam: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    awayTeam: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    matchTime: {
      type: String,
      required: true,
      trim: true,
    },

    matchSchedule: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },

    homeStartingPlayers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Player",
      },
    ],

    homeSubstitutes: [
      {
        type: Schema.Types.ObjectId,
        ref: "Player",
      },
    ],

    awayStartingPlayers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Player",
      },
    ],

    awaySubstitutes: [
      {
        type: Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Match = model("Match", matchSchema);

export default Match;
