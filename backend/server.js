// backend/server.js — MAIN BACKEND

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Models
const User = require("./models/User");
const Theme = require("./models/Theme");
const Question = require("./models/Question");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== MongoDB connection =====
const MONGO_URI =
  "mongodb+srv://punith:Punith123@cluster0.ad4kmh1.mongodb.net/brain_db?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ DB error:", err));

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

// Add theme
app.post("/api/themes/add", async (req, res) => {
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
});

// List themes
app.get("/api/themes/list", async (req, res) => {
  try {
    const list = await Theme.find().sort({ createdAt: 1 });
    return res.json(list);
  } catch (err) {
    console.error("Theme list error:", err);
    return res.status(500).json({ message: "Error while fetching themes" });
  }
});

// Delete theme (and its questions)
app.delete("/api/themes/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Theme.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Theme not found" });
    }

    // also delete questions of this theme
    await Question.deleteMany({ themeId: id });

    return res.json({ message: "Theme deleted successfully" });
  } catch (err) {
    console.error("Theme delete error:", err);
    return res.status(500).json({ message: "Failed to delete theme" });
  }
});

// =====================================================
// ================= QUESTION ROUTES ===================
// =====================================================

// Add question
app.post("/api/question/add", async (req, res) => {
  try {
    const { themeId, questionText, options, correctIndex } = req.body;

    if (!themeId) {
      return res.status(400).json({ message: "themeId is required" });
    }
    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ message: "Question text is required" });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res
        .status(400)
        .json({ message: "At least 2 options are required" });
    }
    if (
      typeof correctIndex !== "number" ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      return res.status(400).json({ message: "Invalid correctIndex" });
    }

    const theme = await Theme.findById(themeId);
    if (!theme) {
      return res.status(404).json({ message: "Theme not found" });
    }

    const q = await Question.create({
      themeId,
      questionText: questionText.trim(),
      options,
      correctIndex,
      totalAttempts: 0,
      correctAttempts: 0,
    });

    return res
      .status(201)
      .json({ message: "Question added successfully", question: q });
  } catch (err) {
    console.error("Question add error:", err);
    return res.status(500).json({ message: "Failed to add question" });
  }
});

// Get questions by theme
app.get("/api/question/by-theme/:themeId", async (req, res) => {
  try {
    const { themeId } = req.params;

    const list = await Question.find({ themeId }).sort({ createdAt: 1 });

    const normalized = list.map((q) => ({
      _id: q._id,
      themeId: q.themeId,
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      totalAttempts: q.totalAttempts || 0,
      correctAttempts: q.correctAttempts || 0,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error("Question list error:", err);
    return res.status(500).json({ message: "Failed to fetch questions" });
  }
});

// Delete question
app.delete("/api/question/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Question.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.json({ message: "Question deleted successfully" });
  } catch (err) {
    console.error("Question delete error:", err);
    return res.status(500).json({ message: "Failed to delete question" });
  }
});

// =====================================================

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));
