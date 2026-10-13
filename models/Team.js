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
      ref: "Player",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Team", teamSchema);
