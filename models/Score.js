import { Schema, model } from "mongoose";

const scoreSchema = new Schema(
  {
    match: {
      type: Schema.Types.ObjectId,
      ref: "Match",
      required: true,
    },

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

    homeScore: {
      type: Number,
      required: true,
      default: 0,
    },

    awayScore: {
      type: Number,
      required: true,
      default: 0,
    },

    timer: {
      elapsed: {
        type: Number,
        default: 0,
      },

      extraTime: {
        type: Boolean,
        default: false,
      },

      finished: {
        type: Boolean,
        default: true,
      },
    },

    matchEvents: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    finishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const Score = model("Score", scoreSchema);

export default Score;
