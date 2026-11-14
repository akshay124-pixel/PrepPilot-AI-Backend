const express = require("express");
const router = express.Router();
const Authmiddleware = require("../middleware/middleware");
const { signup, login, logout, getme } = require("../controller/Auth");
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", Authmiddleware, getme);

module.exports = router;