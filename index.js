// const express = require("express");
// const SteamAuth = require("node-steam-openid");
// const axios = require("axios");

// const app = express();
// const PORT = process.env.PORT || 5000 ;
// console.log(process.env.PORT);
// const steam = new SteamAuth({
//   realm: "http://localhost:5000", // Replace with your actual frontend URL
//   returnUrl: "http://localhost:5000/auth/steam/authenticate", // Your return route
//   apiKey: "1E0DDC6BB18FAAAE89D3D06505AC82A1", // Steam API key
// });
const express = require("express");
const SteamAuth = require("node-steam-openid");
const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();


const app = express();
// const PORT = process.env.PORT || 5000;
const PORT = process.env.PORT || 5000;
// const apiKey = process.env.STEAM_API_KEY;
// console.log(apiKey);
const steam = new SteamAuth({
  realm: "https://ezskin.vercel.app", // Replace with your actual frontend URL
  returnUrl: "https://test123-six-kappa.vercel.app/auth/steam/authenticate", // Your return route
  apiKey: process.env.STEAM_API_KEY,
});
app.get('/', (req, res) => {
  res.send('products api running new deploy');
});
// Redirect to Steam login
app.get("/auth/steam", async (req, res) => {
  try {
    const redirectUrl = await steam.getRedirectUrl();
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error getting redirect URL:", error);
    res.status(500).json({ error: "Failed to redirect to Steam login" });
  }
});

// Steam authentication callback
app.get("/auth/steam/authenticate", async (req, res) => {
  try {
    const user = await steam.authenticate(req);
    // Log the authenticated user data
    console.log("Authenticated user:", user);

    // Handle user data from Steam API response
    const steamID64 = user._json.steamid;
    const username = user._json.personaname;
    const profile = user._json.profileurl;
    const avatar = {
      small: user._json.avatar,
      medium: user._json.avatarmedium,
      large: user._json.avatarfull,
    };

    // Redirect to frontend with user info
    res.redirect(
      `https://www.youtube.com/`,
    );
  } catch (error) {
    console.error("Error authenticating with Steam:", error.message);
    res.status(500).json({ error: "Failed to authenticate with Steam" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
