const express = require('express');
const router = express.Router();
const jackpotController = require('../controllers/jackpotController');

// Route to join the jackpot
router.post('/join', jackpotController.joinJackpot);

// Route to get the current jackpot status
router.get('/status', jackpotController.getJackpotStatus);

module.exports = router;
