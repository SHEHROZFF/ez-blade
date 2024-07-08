const express = require("express");
const SteamAuth = require("node-steam-openid");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const steam = new SteamAuth({
  realm: "https://ezskin.vercel.app/", // Replace with your actual frontend URL
  returnUrl: "https://test123-six-kappa.vercel.app/auth/steam/authenticate", // Your return route
  apiKey: process.env.STEAM_API_KEY,
});

app.use(cors());

app.get('/', (req, res) => {
  res.send('products api running new deploy');
});

// Redirect to Steam login
app.get("/auth/steam", async (req, res) => {
  try {
    const redirectUrl = await steam.getRedirectUrl();
    console.log("Redirecting to Steam login at:", redirectUrl); // Log redirect URL
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error getting redirect URL:", error);
    res.status(500).json({ error: "Failed to redirect to Steam login" });
  }
});

// Steam authentication callback
app.get("/auth/steam/authenticate", async (req, res) => {
  try {
    console.log("Received authentication callback with query:", req.query); // Log query params
    const user = await steam.authenticate(req);
    console.log("Authenticated user:", user);

    const steamID64 = user._json.steamid;
    const username = user._json.personaname;
    const profile = user._json.profileurl;
    const avatar = {
      small: user._json.avatar,
      medium: user._json.avatarmedium,
      large: user._json.avatarfull,
    };

    // Redirect to frontend with user info
    const redirectUrl = `https://ezskin.vercel.app/?page.tsx&steamID64=${steamID64}&username=${username}`;
    console.log("Redirecting to frontend with user info:", redirectUrl); // Log redirect URL
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error authenticating with Steam:", error.message);
    res.status(500).json({ error: "Failed to authenticate with Steam" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
