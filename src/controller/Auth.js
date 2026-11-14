const bcrypt = require("bcryptjs");
const User = require("../schema/authmodel");
const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../schema/blacklist");
const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    ...authCookieOptions(),
    maxAge: AUTH_TOKEN_TTL_MS,
  });
};

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    setAuthCookie(res, token);
    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },

      message: "User created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userExists = await User.findOne({ email });
    if (!userExists) {
      return res.status(400).json({ message: "User does not exist" });
    }
    const isPasswordValid = await bcrypt.compare(password, userExists.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: userExists._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    setAuthCookie(res, token);
    res.status(200).json({
      user: {
        id: userExists._id,
        name: userExists.name,
        email: userExists.email,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      await TokenBlacklist.create({ token });
    }
    res.clearCookie("token", authCookieOptions());
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const getme = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({ user:{
        id: user._id,
        name: user.name,
        email: user.email,
    } });
  } catch (error) {
    console.error("Getme error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
module.exports = { signup, login, logout, getme };
