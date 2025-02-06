require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const socketIo = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://lkrm1585:lkrm1585@cluster0.vvphl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Middleware
app.use(express.static("views"));
app.use(express.json());
app.use(cors());

// Database Connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Models
const User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  password: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
}));

const GroupMessage = mongoose.model("GroupMessage", new mongoose.Schema({
  from_user: { type: String, required: true },
  room: { type: String, required: true },
  message: { type: String, required: true },
  date_sent: { type: Date, default: Date.now },
}));

const PrivateMessage = mongoose.model("PrivateMessage", new mongoose.Schema({
  from_user: { type: String, required: true },
  to_user: { type: String, required: true },
  message: { type: String, required: true },
  date_sent: { type: Date, default: Date.now },
}));

// Routes
app.post("/signup", async (req, res) => {
  try {
    const { username, firstname, lastname, password } = req.body;
    if (!username || !firstname || !lastname || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, firstname, lastname, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || "secretkey", { expiresIn: "1h" });
    res.json({ token, username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Server and Socket.io Setup
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const io = socketIo(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("User connected");
  
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("chatMessage", async ({ from_user, room, message }) => {
    try {
      const msg = new GroupMessage({ from_user, room, message });
      await msg.save();
      io.to(room).emit("message", msg);
    } catch (err) {
      console.error("Chat message error:", err);
    }
  });
  
  socket.on("typing", (room) => {
    socket.to(room).emit("typing", "User is typing...");
  });
  
  socket.on("disconnect", () => console.log("User disconnected"));
});