const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/verify", authController.verifyEmail);
router.get("/me", authController.getMe);
router.get("/users", authMiddleware, authController.getAllUsers);
router.get("/google", authController.googleAuth);
router.get("/callback", authController.handleOAuthCallback);
router.post("/callback", authController.handleToken);

module.exports = router;
