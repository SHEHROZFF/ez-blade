const Jackpot = require('../models/jackpotSchema');
const Item = require('../models/itemSchema');
const User = require('../models/userSchema');

const joinJackpot = async (req, res) => {
  try {
    const { userId, itemIds } = req.body; // Assume itemIds is an array of selected item IDs

    // Find or create the current jackpot
    let jackpot = await Jackpot.findOne({ status: 'in_progress' });
    if (!jackpot) {
      jackpot = new Jackpot();
    }

    // Add the user and items to the jackpot
    const user = await User.findById(userId);
    const items = await Item.find({ _id: { $in: itemIds } });

    jackpot.participants.push(user._id);
    jackpot.items.push(...items.map(item => item._id));

    // Calculate the total value of the jackpot
    const totalValue = items.reduce((acc, item) => acc + item.value, 0);
    jackpot.totalValue += totalValue;

    // Save the jackpot
    await jackpot.save();

    // Start the countdown if there are at least two participants
    if (jackpot.participants.length >= 2 && jackpot.status === 'waiting') {
      jackpot.status = 'in_progress';
      setTimeout(async () => {
        await this.completeJackpot(jackpot._id);
      }, jackpot.countdown * 1000);
    }

    res.json({ success: true, jackpot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getJackpotStatus = async (req, res) => {
    try {
      const jackpot = await Jackpot.findOne({ status: 'in_progress' }).populate('items').populate('participants');
      if (!jackpot) {
        return res.status(404).json({ error: 'No active jackpot found.' });
      }
      res.json(jackpot);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  


const completeJackpot = async (jackpotId) => {
    try {
      const jackpot = await Jackpot.findById(jackpotId).populate('items').populate('participants');
      if (!jackpot || jackpot.status !== 'in_progress') {
        return;
      }
  
      // Calculate odds for each participant
      const totalValue = jackpot.totalValue;
      let winner = null;
      const participantsWithOdds = jackpot.participants.map(participant => {
        const participantItems = jackpot.items.filter(item => item.owner.equals(participant._id));
        const participantValue = participantItems.reduce((acc, item) => acc + item.value, 0);
        const odds = participantValue / totalValue;
        return { participant, odds };
      });
  
      // Select a winner based on odds
      const randomValue = Math.random();
      let cumulativeOdds = 0;
      for (const { participant, odds } of participantsWithOdds) {
        cumulativeOdds += odds;
        if (randomValue <= cumulativeOdds) {
          winner = participant;
          break;
        }
      }
  
      if (winner) {
        // Calculate commission and transfer items
        const commissionValue = (jackpot.totalValue * jackpot.commissionPercentage) / 100;
        const winnings = jackpot.totalValue - commissionValue;
  
        // Trade the items to the winner
        // (Implement trade logic here using the Steam API)
        await transferWinningsToWinner(winner, jackpot.items, winnings);
  
        // Mark the jackpot as completed
        jackpot.status = 'completed';
        jackpot.winner = winner._id;
        await jackpot.save();
      }
    } catch (error) {
      console.error('Error completing jackpot:', error);
    }
  };
  

  module.exports = {
    getJackpotStatus,
    joinJackpot,
    completeJackpot
  }