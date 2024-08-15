const mongoose = require('mongoose');

const jackpotSchema = new mongoose.Schema({
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }], // Array of item IDs
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of participant IDs
  totalValue: { type: Number, default: 0 }, // Total value of items in the jackpot
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Winner ID
  commissionPercentage: { type: Number, default: 10 }, // Commission percentage
  status: { type: String, enum: ['waiting', 'in_progress', 'completed'], default: 'waiting' }, // Status of the jackpot
  countdown: { type: Number, default: 120 }, // Countdown in seconds
  createdAt: { type: Date, default: Date.now }, // Timestamp for when the jackpot started
});

module.exports = mongoose.model('Jackpot', jackpotSchema);
