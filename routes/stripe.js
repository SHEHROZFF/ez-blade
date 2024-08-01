require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_API_SRECRET_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://ezskin.vercel.app",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server started on PORT ${PORT}`);
});
