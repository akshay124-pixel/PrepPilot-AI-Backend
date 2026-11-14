const mongoose = require("mongoose");

const authSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);
const TokenBlacklist = mongoose.model("TokenBlacklist", authSchema);
module.exports = TokenBlacklist;
