const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theme",
      required: true
    },

    questionText: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },

    // allow fallback themeId
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theme",
      required: false
    },

    totalAttempts: { type: Number, default: 0 },
    correctAttempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// *** FIXED MIDDLEWARE ***
// Must include `next` and must call it
QuestionSchema.pre("validate", function (next) {
  if (!this.theme && this.themeId) {
    this.theme = this.themeId;
  }
  return next();
});

module.exports = mongoose.model("Question", QuestionSchema);
