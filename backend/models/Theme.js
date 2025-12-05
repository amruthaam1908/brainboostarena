// backend/models/Theme.js
const mongoose = require("mongoose");

const ThemeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// 👇 IMPORTANT: export the model directly
const Theme = mongoose.model("Theme", ThemeSchema);
module.exports = Theme;
