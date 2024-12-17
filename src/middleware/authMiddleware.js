const supabase = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No session token provided" });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res
        .status(401)
        .json({ error: "Invalid or expired session token" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = authMiddleware;
