const supabase = require("../config/supabase");

const authController = {
  async signup(req, res) {
    try {
      const { email, password, username, firstname, lastname } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({
          error: "Email, password, and username are required",
        });
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([
          {
            username,
            email,
            firstname: firstname || null,
            lastname: lastname || null,
          },
        ])
        .select()
        .single();

      if (userError) {
        return res.status(400).json({ error: userError.message });
      }

      res.status(201).json({
        message: "User created successfully",
        user: userData,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      res.cookie("session", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600 * 1000,
      });

      res.status(200).json({
        message: "Login successful",
        user: data.user,
        token: data.session.access_token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getMe(req, res) {
    try {
      console.log("getMe");
      console.log("req.cookies: ", req.cookies);

      const token = req.cookies.session;

      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user) {
        console.error("Auth error:", userError);
        return res.status(401).json({ error: "Authentication failed" });
      }

      const { data: additionalUserData, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single();

      if (additionalUserData && !dbError) {
        return res.json({
          ...additionalUserData,
          emailConfirmed: user.email_confirmed_at !== null,
          role: user.role,
        });
      }

      return res.json({
        id: user.id,
        email: user.email,
        emailConfirmed: user.email_confirmed_at !== null,
        role: user.role,
      });
    } catch (error) {
      console.error("ME endpoint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async logout(req, res) {
    res.clearCookie("session");
    await supabase.auth.signOut();
    res.json({ message: "Logged out successfully" });
  },

  async verifyEmail(req, res) {
    try {
      const { token_hash, type } = req.query;

      if (!token_hash || type !== "signup") {
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?error=invalid_verification`
        );
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: "signup",
      });

      if (error) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?error=${encodeURIComponent(
            error.message
          )}`
        );
      }

      const queryParams = new URLSearchParams({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        type: "signup",
      });

      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?${queryParams.toString()}`
      );
    } catch (error) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?error=server_error`
      );
    }
  },
  async getAllUsers(req, res) {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("username, email, firstname, lastname")
        .order("username", { ascending: true });

      if (error) {
        console.error("Error fetching users:", error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json(users);
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = authController;
