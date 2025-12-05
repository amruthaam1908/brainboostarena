// backend/test-backend.js — MAIN BACKEND (raw questions collection, with attempt API)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Theme = require("./models/Theme");
// IMPORTANT: we are NOT using Question model anywhere here
// const Question = require("./models/Question");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== MongoDB connection =====
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB error:", err));

// raw collection helper (for questions)
const getQuestionsCollection = () =>
  mongoose.connection.collection("questions");
const ObjectId = mongoose.Types.ObjectId;

// ===== Test route =====
app.get("/", (req, res) => {
  res.send("BrainBoostArena backend is running 🚀");
});

// =====================================================
// =============== AUTH ROUTES (existing) ==============
// =====================================================

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Already registered" });
    }

    const newUser = await User.create({ name, email, password, role });

    res
      .status(201)
      .json({ message: "Registered successfully", user: newUser });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.password !== password)
      return res.status(401).json({ message: "Incorrect password" });

    if (user.role !== role)
      return res.status(403).json({ message: "Invalid role selected" });

    res.json({
      message: "Login successful",
      role: user.role,
      name: user.name,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// RESET PASSWORD
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// =====================================================
// ================== THEME ROUTES =====================
// =====================================================

// shared handlers so both /api/theme/* and /api/themes/* work

// Add theme handler
const addThemeHandler = async (req, res) => {
  try {
    const { name } = req.body;
    const trimmed = (name || "").trim();

    if (!trimmed) {
      return res.status(400).json({ message: "Theme name is required" });
    }

    const exists = await Theme.findOne({ name: trimmed });
    if (exists) {
      return res.status(400).json({ message: "Theme already exists" });
    }

    const theme = await Theme.create({ name: trimmed });
    return res
      .status(201)
      .json({ message: "Theme added successfully", theme });
  } catch (err) {
    console.error("Theme add error:", err);
    return res.status(500).json({ message: "Error while adding theme" });
  }
};

// List themes handler
const listThemesHandler = async (req, res) => {
  try {
    const list = await Theme.find().sort({ createdAt: 1 });
    return res.json(list);
  } catch (err) {
    console.error("Theme list error:", err);
    return res.status(500).json({ message: "Error while fetching themes" });
  }
};

// Delete theme handler
const deleteThemeHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Theme.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Theme not found" });
    }

    // also delete questions of this theme from raw collection
    await getQuestionsCollection().deleteMany({
      themeId: new ObjectId(id),
    });

    return res.json({ message: "Theme deleted successfully" });
  } catch (err) {
    console.error("Theme delete error:", err);
    return res.status(500).json({ message: "Failed to delete theme" });
  }
};

// Register routes with BOTH singular and plural paths

// Add theme
app.post("/api/themes/add", addThemeHandler);
app.post("/api/theme/add", addThemeHandler); // alias

// List themes
app.get("/api/themes/list", listThemesHandler);
app.get("/api/theme/list", listThemesHandler); // alias

// Delete theme
app.delete("/api/themes/:id", deleteThemeHandler);
app.delete("/api/theme/:id", deleteThemeHandler); // alias

// =====================================================
// ================= QUESTION ROUTES ===================
// =====================================================

// ADD QUESTION — RAW COLLECTION, NO MONGOOSE MODEL
app.post("/api/question/add", async (req, res) => {
  try {
    let { themeId, questionText, options, correctIndex } = req.body;

    console.log("Request body:", req.body);

    // --- BASIC VALIDATION ---
    if (!themeId) {
      return res.status(400).json({ message: "themeId is required" });
    }
    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ message: "Question text is required" });
    }

    if (!Array.isArray(options)) {
      options = [];
    }
    options = options.map((o) => String(o || "").trim()).filter((o) => o);
    if (options.length < 2) {
      return res
        .status(400)
        .json({ message: "At least 2 options are required" });
    }

    const idx = Number(correctIndex);
    if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
      return res.status(400).json({ message: "Invalid correctIndex" });
    }

    // make sure theme exists
    const theme = await Theme.findById(themeId);
    if (!theme) {
      return res.status(404).json({ message: "Theme not found" });
    }

    const now = new Date();
    const themeObjectId = new ObjectId(themeId);

    const payload = {
      themeId: themeObjectId,
      theme: themeObjectId, // extra field, in case old data used this
      questionText: questionText.trim(),
      text: questionText.trim(),
      options,
      correctIndex: idx,
      correctOption: idx,
      answerIndex: idx,
      totalAttempts: 0,
      correctAttempts: 0,
      attempts: 0,
      correct: 0,
      wrong: 0,
      createdAt: now,
      updatedAt: now,
    };

    const collection = getQuestionsCollection();
    const result = await collection.insertOne(payload);

    const inserted = { _id: result.insertedId, ...payload };

    return res
      .status(201)
      .json({ message: "Question added successfully", question: inserted });
  } catch (err) {
    console.error("Question add error:", err);
    return res
      .status(500)
      .json({ message: "Failed to add question", error: err.message });
  }
});

// GET QUESTIONS BY THEME — RAW COLLECTION
app.get("/api/question/by-theme/:themeId", async (req, res) => {
  try {
    const { themeId } = req.params;

    const collection = getQuestionsCollection();

    let docs = [];
    try {
      docs = await collection
        .find({ themeId: new ObjectId(themeId) })
        .sort({ createdAt: 1 })
        .toArray();
    } catch (e) {
      // if themeId not valid ObjectId, return empty list
      return res.json([]);
    }

    const normalized = docs.map((q) => ({
      _id: q._id,
      themeId: q.themeId,
      questionText: q.questionText || q.text,
      options: q.options || [],
      correctIndex:
        typeof q.correctIndex === "number"
          ? q.correctIndex
          : typeof q.correctOption === "number"
          ? q.correctOption
          : typeof q.answerIndex === "number"
          ? q.answerIndex
          : 0,
      totalAttempts: q.totalAttempts || q.attempts || 0,
      correctAttempts: q.correctAttempts || q.correct || 0,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error("Question list error:", err);
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
});

// DELETE QUESTION — RAW COLLECTION
app.delete("/api/question/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let _id;
    try {
      _id = new ObjectId(id);
    } catch (e) {
      return res.status(400).json({ message: "Invalid question id" });
    }

    const collection = getQuestionsCollection();
    const result = await collection.deleteOne({ _id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.json({ message: "Question deleted successfully" });
  } catch (err) {
    console.error("Question delete error:", err);
    return res.status(500).json({ message: "Failed to delete question" });
  }
});

// ============ NEW: RECORD AN ATTEMPT ON A QUESTION ============
app.post("/api/question/attempt", async (req, res) => {
  try {
    const { questionId, selectedIndex } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: "questionId is required" });
    }

    const idx = Number(selectedIndex);
    if (Number.isNaN(idx) || idx < 0) {
      return res.status(400).json({ message: "Invalid selectedIndex" });
    }

    // Make sure we can always convert whatever we receive into a valid ObjectId
    let _id;
    try {
      let idStr;
      if (typeof questionId === "string") {
        idStr = questionId;
      } else if (questionId && typeof questionId === "object") {
        // in case it comes like { $oid: "..." } or { _id: "..." }
        if (questionId.$oid) idStr = questionId.$oid;
        else if (questionId._id) idStr = questionId._id;
        else idStr = String(questionId);
      } else {
        idStr = String(questionId);
      }
      _id = new ObjectId(idStr);
    } catch (e) {
      return res.status(400).json({ message: "Invalid questionId" });
    }

    const collection = getQuestionsCollection();
    const q = await collection.findOne({ _id });

    if (!q) {
      return res.status(404).json({ message: "Question not found" });
    }

    const correctIndex =
      typeof q.correctIndex === "number"
        ? q.correctIndex
        : typeof q.correctOption === "number"
        ? q.correctOption
        : typeof q.answerIndex === "number"
        ? q.answerIndex
        : 0;

    const isCorrect = idx === correctIndex;

    const inc = isCorrect
      ? { totalAttempts: 1, attempts: 1, correctAttempts: 1, correct: 1 }
      : { totalAttempts: 1, attempts: 1, wrong: 1 };

    await collection.updateOne(
      { _id },
      { $inc: inc, $set: { updatedAt: new Date() } }
    );

    return res.json({
      message: isCorrect ? "Correct answer! 🎉" : "Wrong answer.",
      correct: isCorrect,
      correctIndex,
    });
  } catch (err) {
    console.error("Question attempt error:", err);
    return res
      .status(500)
      .json({ message: "Failed to record attempt", error: err.message });
  }
});

// =====================================================

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log("🚀 Backend running on " + PORT);
});
