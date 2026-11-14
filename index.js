const express = require("express");
const dotenv = require("dotenv"); // Ye line missing thi
dotenv.config();

const connectDB = require("./src/config/dbconnect");
const authRoutes = require("./src/router/routes");
const reportRoutes = require("./src/router/ai.routes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 5051;
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use("/api/report", reportRoutes);
app.use("/api/auth", authRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
