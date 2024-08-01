require('dotenv').config(); // Ensure this is at the top
const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_API_SECRET_KEY); // Correctly initialize Stripe

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Configure Passport with Steam Strategy
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new SteamStrategy({
    returnURL: 'http://localhost:5000/auth/steam/return',
    realm: 'http://localhost:5000/',
    apiKey: process.env.STEAM_API_KEY
  },
  (identifier, profile, done) => {
    process.nextTick(() => {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

// Function to get inventory
const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
  if (typeof appid !== 'number') appid = 730;
  if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
  if (typeof tradeable !== 'boolean') tradeable = false;
  if (!steamid) {
      throw new Error('SteamID is required');
  }

  try {
      const response = await axios.get(`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`);
      const body = response.data;

      let items = body.descriptions;
      let assets = body.assets;
      let marketnames = [];
      let assetids = [];
      let data = {
          raw: body,
          items: items.map(item => ({
              market_hash_name: item.market_hash_name,
              icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`
          })),
          marketnames: marketnames,
          assets: assets,
          assetids: assetids
      };

      if (items) {
          for (let i = 0; i < items.length; i++) {
              marketnames.push(items[i].market_hash_name);
              assetids.push(assets[i].assetid);
          }
      } else {
          throw new Error('No items found in the inventory.');
      }

      if (tradeable) {
          data.items = data.items.filter(x => x.tradable === 1);
      }

      return data;
  } catch (error) {
      console.error('Inventory Error:', error.response ? error.response.data : error.message);
      throw error;
  }
};

// Inventory Route
app.get('/api/inventory', async (req, res) => {
  try {
    const steamID64 = req.query.steamID64;
    const appId = parseInt(req.query.appId, 10) ||252490 ;
    const contextId = parseInt(req.query.contextId, 10) || 2;
    
    if (!steamID64) {
      return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
    }

    const inventory = await getInventory(appId, steamID64, contextId);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Payment Intent Route


// Routes
app.get('/', (req, res) => {
  res.send('API running');
});

// Redirect to Steam login
app.get('/auth/steam', passport.authenticate('steam'));

// Steam authentication callback
app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/' }),
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
    const redirectUrl = `http://localhost:3000/?steamID64=${steamID64}&username=${username}&avatar=${JSON.stringify(avatar)}`;
    res.redirect(redirectUrl);
  }
);

// Route to redirect user to Steam Trade Offer URL page
app.get('/trade-url', (req, res) => {
  try {
    const steamID64 = req.user?.id;
    if (!steamID64) {
      return res.status(401).json({ error: 'Unauthorized: No Steam ID found.' });
    }
    const tradeUrl = `https://steamcommunity.com/profiles/${steamID64}/tradeoffers/privacy#trade_offer_access_url`;
    res.redirect(tradeUrl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    req.session.destroy(err => {
      if (err) {
        return next(err);
      }
      res.redirect('http://localhost:3000/'); // Redirect to your frontend after logout
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
