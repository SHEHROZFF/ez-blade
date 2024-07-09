const express = require("express");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
// ---------------------------------------steam------------------------------------------------
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
// -------------------------------------stripe-----------------------------------------
const calculateTotalOrderAmount = (items) => {
  if (!items || !items.length) {
    throw new Error("Invalid items array");
  }
  // Multiply by 100 to convert to cents if required by Stripe
  return items[0].amount * 100;
};

app.post("/create-payment-intent", async (req, res) => {
  try {
    console.log("Request received:", req.body); // Log the request body

    const { items } = req.body;

    if (!items || !items.length) {
      console.error("Invalid items array");
      return res.status(400).json({ error: "Invalid items array" });
    }

    console.log("Calculating total order amount...");
    const amountInCents = calculateTotalOrderAmount(items);
    console.log("Total order amount:", amountInCents);

    console.log("Creating payment intent...");
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      description: "Payment for Gaming Levels",
    });

    console.log("Payment intent created:", paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ error: error.message });
  }
});
// -------------------------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
