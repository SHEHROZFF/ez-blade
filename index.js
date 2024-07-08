// const express = require("express");
// const SteamAuth = require("node-steam-openid");
// const dotenv = require("dotenv");
// const cors = require("cors");

// // Load environment variables from .env file
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// const steam = new SteamAuth({
//   realm: "https://ezskin.vercel.app/", // Replace with your actual frontend URL
//   returnUrl: "https://test123-six-kappa.vercel.app/auth/steam/authenticate", // Your return route
//   apiKey: process.env.STEAM_API_KEY,
// });

// app.use(cors());

// app.get('/', (req, res) => {
//   res.send('products api running new deploy');
// });

// // Redirect to Steam login
// app.get("/auth/steam", async (req, res) => {
//   try {
//     const redirectUrl = await steam.getRedirectUrl();
//     console.log("Redirecting to Steam login at:", redirectUrl); // Log redirect URL
//     return res.redirect(redirectUrl);
//   } catch (error) {
//     console.error("Error getting redirect URL:", error);
//     res.status(500).json({ error: "Failed to redirect to Steam login" });
//   }
// });

// // Steam authentication callback
// app.get("/auth/steam/authenticate", async (req, res) => {
//   try {
//     console.log("Received authentication callback with query:", req.query); // Log query params
//     const user = await steam.authenticate(req);
//     console.log("Authenticated user:", user);

//     const steamID64 = user._json.steamid;
//     const username = user._json.personaname;
//     const profile = user._json.profileurl;
//     const avatar = {
//       small: user._json.avatar,
//       medium: user._json.avatarmedium,
//       large: user._json.avatarfull,
//     };

//     // Redirect to frontend with user info
//     const redirectUrl = `https://ezskin.vercel.app/?page.tsx&steamID64=${steamID64}&username=${username}`;
//     console.log("Redirecting to frontend with user info:", redirectUrl); // Log redirect URL
//     res.redirect(redirectUrl);
//   } catch (error) {
//     console.error("Error authenticating with Steam:", error.message);
//     res.status(500).json({ error: "Failed to authenticate with Steam" });
//   }
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });
const express = require("express");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure Passport with Steam Strategy
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new SteamStrategy({
    returnURL: "https://test123-six-kappa.vercel.app/auth/steam/return",
    realm: "https://test123-six-kappa.vercel.app/",
    apiKey: process.env.STEAM_API_KEY
  },
  (identifier, profile, done) => {
    process.nextTick(() => {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

// Middleware setup
app.use(cors({
  origin: 'https://ezskin.vercel.app', // Allow requests from your frontend domain
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(session({ secret: "your_secret", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
  res.send('products api running new deploy');
});

// Redirect to Steam login
app.get("/auth/steam", passport.authenticate("steam"));

// Steam authentication callback
app.get("/auth/steam/return",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    const user = req.user;
    const steamID64 = user.id;
    const username = user.displayName;
    const profile = user.profileUrl;
    const avatar = {
      small: user.photos[0].value,
      medium: user.photos[1].value,
      large: user.photos[2].value,
    };

    // Redirect to frontend with user info
    const redirectUrl = `https://ezskin.vercel.app/?page.tsx&steamID64=${steamID64}&username=${username}`;
    res.redirect(redirectUrl);
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
