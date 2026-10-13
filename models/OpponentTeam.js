import { Schema, model } from "mongoose";

const opponentTeamSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    logoHigh: {
      type: String,
      required: true,
    },

    logoLow: {
      type: String,
      required: true,
    },

    shortForm: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
    },

    captain: {
      type: Schema.Types.ObjectId,
      ref: "OpponentPlayer",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const OpponentTeam = model(
  "OpponentTeam",
  opponentTeamSchema
);

export default OpponentTeam;
