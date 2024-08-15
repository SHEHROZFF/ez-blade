require('dotenv').config(); // Ensure this is at the top
const express = require('express');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const session = require('express-session');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('./models/userSchema');
const Item = require('./models/itemSchema')
const { getInventory } = require('./utils/getInventory')
const jackpotRoutes = require('./routes/jackpotRoutes');

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'https://ezskin.vercel.app/',
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
    returnURL: 'https://test123-six-kappa.vercel.app/auth/steam/return',
    realm: 'https://test123-six-kappa.vercel.app/',
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

app.get('/',()=>{
  res.json("allisWELL")
})
// Inventory Route
app.get('/api/inventory', async (req, res) => {
  try {
    const steamID64 = req.query.steamID64;
    const appId = parseInt(req.query.appId, 10) || 252490;
    const contextId = parseInt(req.query.contextId, 10) || 2;

    if (!steamID64) {
      return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
    }

    const inventory = await getInventory(appId, steamID64, contextId);

    // Find the user in the database
    const user = await User.findOne({ steamId: steamID64 });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    // Save each item in the inventory to the database
    const itemPromises = inventory.items.map(async (item) => {
      try {
        // Extract the numeric part from the price string and convert it to a number
        const priceString = item.price; 
        const priceMatch = priceString.match(/\d+(\.\d+)?/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

        // Check if any of the asset IDs already exists in the database
        const existingItem = await Item.findOne({
          owner: user._id,
          appId: appId,
          contextId: contextId,
          assetId: { $in: item.assetIds }
        });

        if (existingItem) {
          // Item already exists in the inventory, update if needed
          return existingItem;
        }

        // Create a new item entry for each asset ID
        const newItemPromises = item.assetIds.map(async (assetId) => {
          const newItem = new Item({
            name: item.market_hash_name,
            iconUrl: item.icon_url,
            price: `${price} USD`,  // Save the numeric value
            owner: user._id,
            assetId: assetId,
            appId: appId,
            contextId: contextId,
            // quantity: item.quantity
          });

          const savedItem = await newItem.save();
          user.inventory.push(savedItem._id); // Add item reference to user's inventory
          return savedItem;
        });

        return Promise.all(newItemPromises);

      } catch (itemError) {
        // Handle errors
        console.error(`Error processing item ${item.market_hash_name}`, itemError);
        throw itemError;
      }
    });

    // Wait for all items to be saved
    await Promise.all(itemPromises);

    // Save the updated user with inventory references
    await user.save();
    const userInventory = await User.findOne({steamId: steamID64}).populate('inventory')
    
    // console.log(userInventory.inventory.length);
    // console.log(typeof(userInventory.inventory), typeof(inventory));
    // console.log(typeof(userInventory.inventory[0].iconUrl),typeof(inventory.items[0].icon_url));
    

    res.json({items:userInventory.inventory, inv:inventory});

  } catch (error) {
    console.error("Error in /api/inventory:", error);
    res.status(500).json({ error: error.message });
  }
});



// Redirect to Steam login
app.get('/auth/steam', passport.authenticate('steam'));

// Steam authentication callback
app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/' }),
  async (req, res) => {
    const user = req.user;
    const steamID64 = user.id;
    const username = user.displayName;
    const profile = user.profileUrl;
    const avatar = {
      small: user.photos[0].value,
      medium: user.photos[1].value,
      large: user.photos[2].value,
    };

    try {
      // Check if user already exists
      let existingUser = await User.findOne({ steamId: steamID64 });

      if (!existingUser) {
        // If the user doesn't exist, create a new user
        const newUser = new User({
          steamId: steamID64,
          username: username,
          profileUrl: profile,
          avatar: avatar,
        });
        await newUser.save();
        console.log(`New user created: ${username}`);
      } else {
        console.log(`User already exists: ${username}`);
      }

      // Redirect to frontend with user info
      const redirectUrl = `https://ezskin.vercel.app/?steamID64=${steamID64}&username=${username}&avatar=${JSON.stringify(avatar)}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error saving user:', error);
      res.redirect('/');
    }
  }
);

app.use('/jackpotSystem',jackpotRoutes)

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
      res.redirect('https://ezskin.vercel.app/'); // Redirect to your frontend after logout
    });
  });
});

mongoose.connect('mongodb+srv://bilalshehroz420:00000@cluster0.wru7job.mongodb.net/ez_skin?retryWrites=true&w=majority')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('Database connection error:', err));




  
// app.get('/api/inventory', async (req, res) => {
//   try {
//     const steamID64 = req.query.steamID64;
//     const appId = parseInt(req.query.appId, 10) || 252490;
//     const contextId = parseInt(req.query.contextId, 10) || 2;

//     if (!steamID64) {
//       return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
//     }

//     const inventory = await getInventory(appId, steamID64, contextId);

//     // Find the user in the database
//     const user = await User.findOne({ steamId: steamID64 });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     console.log("check 1");

//     // Save each item in the inventory to the database
//     const itemPromises = inventory.items.map(async (item, index) => {
//       try {
//         console.log(`Processing item ${index + 1} / ${inventory.items.length}: ${item.market_hash_name}`);

//         // Extract the numeric part from the price string and convert it to a number
//         const priceString = item.price; 
//         const priceMatch = priceString.match(/\d+(\.\d+)?/);
//         const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

//         const newItem = new Item({
//           name: item.market_hash_name,
//           iconUrl: item.icon_url,
//           price: price,  // Save the numeric value
//           owner: user._id,
//           assetId: item.assetid,
//           appId: appId,
//           contextId: contextId,
//         });

//         const savedItem = await newItem.save();
//         console.log(`Item ${index + 1} saved: ${savedItem._id}`);
//         user.inventory.push(savedItem._id); // Add item reference to user's inventory
//         return savedItem;
//       } catch (itemError) {
//         console.error(`Error processing item ${index + 1}: ${item.market_hash_name}`, itemError);
//         throw itemError;
//       }
//     });

//     // Wait for all items to be saved
//     await Promise.all(itemPromises);
//     console.log("check 2");

//     // Save the updated user with inventory references
//     await user.save();
//     console.log('check 3');
//     console.log('inve', inventory.raw.descriptions[0]);
    
//     res.json(inventory);

//   } catch (error) {
//     console.error("Error in /api/inventory:", error);
//     res.status(500).json({ error: error.message });
//   }
// });










  // require('dotenv').config(); // Ensure this is at the top
// const express = require('express');
// const passport = require('passport');
// const SteamStrategy = require('passport-steam').Strategy;
// const session = require('express-session');
// const cors = require('cors');
// const axios = require('axios');
// const stripe = require('stripe')(process.env.STRIPE_API_SECRET_KEY); // Correctly initialize Stripe
// const fs = require('fs')
// const mongoose = require('mongoose')

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(express.json());
// app.use(cors({
//   origin:  'http://localhost:3000',
//   methods: ['GET', 'POST'],
//   credentials: true
// }));

// app.use(session({
//   secret: process.env.SESSION_SECRET || 'your_secret',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: false } // Set to true if using HTTPS
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// // Configure Passport with Steam Strategy
// passport.serializeUser((user, done) => {
//   done(null, user);
// });

// passport.deserializeUser((obj, done) => {
//   done(null, obj);
// });

// passport.use(new SteamStrategy({
//     returnURL: 'http://localhost:5000/auth/steam/return',
//     realm: 'http://localhost:5000/',
//     apiKey: process.env.STEAM_API_KEY
//   },
//   (identifier, profile, done) => {
//     process.nextTick(() => {
//       profile.identifier = identifier;
//       return done(null, profile);
//     });
//   }
// ));

// // Function to get inventory
// const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
//   if (typeof appid !== 'number') appid = 730;
//   if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
//   if (typeof tradeable !== 'boolean') tradeable = false;
//   if (!steamid) {
//     throw new Error('SteamID is required');
//   }

//   try {
//     const response = await axios.get(`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`);
//     const body = response.data;

//     let items = body.descriptions;
//     let assets = body.assets;
//     let marketnames = [];
//     let assetids = [];
//     let prices = [];

//     // Load rust_market_items.json file
//     const rustMarketItems = await JSON.parse(fs.readFileSync('rust_market_items.json', 'utf-8'));

//     let data = {
//       raw: body,
//       items: items.map(item => {
//         // Find the corresponding price for the item from rust_market_items.json
//         const marketItem = rustMarketItems.find(marketItem => marketItem.name === item.market_hash_name);
//         const price = marketItem ? marketItem.price : 'Price not found';

//         return {
//           market_hash_name: item.market_hash_name,
//           icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`,
//           price: price
//         };
//       }),
//       marketnames: marketnames,
//       assets: assets,
//       assetids: assetids
//     };
//     console.log(data);
    
//     if (items) {
//       for (let i = 0; i < items.length; i++) {
//         marketnames.push(items[i].market_hash_name);
//         assetids.push(assets[i].assetid);
//         const marketItem = rustMarketItems.find(marketItem => marketItem.name === items[i].market_hash_name);
//         const price = marketItem ? marketItem.price : 'Price not found';
//         prices.push(price);
//       }
//     } else {
//       throw new Error('No items found in the inventory.');
//     }

//     if (tradeable) {
//       data.items = data.items.filter(x => x.tradable === 1);
//     }

//     return data;
//   } catch (error) {
//     console.error('Inventory Error:', error.response ? error.response.data : error.message);
//     throw error;
//   }
// };



// // Inventory Route
// app.get('/api/inventory', async (req, res) => {
//   try {
//     const steamID64 = req.query.steamID64;
//     const appId = parseInt(req.query.appId, 10) ||252490 ;
//     const contextId = parseInt(req.query.contextId, 10) || 2;
    
//     if (!steamID64) {
//       return res.status(400).json({ error: 'Missing SteamID64 parameter.' });
//     }

//     const inventory = await getInventory(appId, steamID64, contextId);
//     res.json(inventory);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Create Payment Intent Route


// // // Routes
// // app.get('/', (req, res) => {
// //   res.send('API running');
// // });

// // Redirect to Steam login
// app.get('/auth/steam', passport.authenticate('steam'));

// // Steam authentication callback
// app.get('/auth/steam/return',
//   passport.authenticate('steam', { failureRedirect: '/' }),
//   (req, res) => {
//     const user = req.user;
//     const steamID64 = user.id;
//     const username = user.displayName;
//     const profile = user.profileUrl;
//     const avatar = {
//       small: user.photos[0].value,
//       medium: user.photos[1].value,
//       large: user.photos[2].value,
//     };

//     // Redirect to frontend with user info
//     const redirectUrl = `http://localhost:3000/?steamID64=${steamID64}&username=${username}&avatar=${JSON.stringify(avatar)}`;
//     res.redirect(redirectUrl);
//   }
// );

// // Route to redirect user to Steam Trade Offer URL page
// app.get('/trade-url', (req, res) => {
//   try {
//     const steamID64 = req.user?.id;
//     if (!steamID64) {
//       return res.status(401).json({ error: 'Unauthorized: No Steam ID found.' });
//     }
//     const tradeUrl = `https://steamcommunity.com/profiles/${steamID64}/tradeoffers/privacy#trade_offer_access_url`;
//     res.redirect(tradeUrl);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Logout route
// app.get('/logout', (req, res) => {
//   req.logout(err => {
//     if (err) {
//       return next(err);
//     }
//     req.session.destroy(err => {
//       if (err) {
//         return next(err);
//       }
//       res.redirect('http://localhost:3000/'); // Redirect to your frontend after logout
//     });
//   });
// });

// // app.listen(PORT, () => {
// //   console.log(`Server is running on http://localhost:${PORT}`);
// // });
