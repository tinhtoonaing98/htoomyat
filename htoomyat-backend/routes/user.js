// File: routes/user.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET total points by email
router.get('/user-points', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  db.query('SELECT points FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'User not found' });

    res.json({ points: results[0].points });
  });
});

// POST redeem request
router.post('/redeem', (req, res) => {
  const { email, option } = req.body;
  if (!email || !option) return res.status(400).json({ message: 'Email and option required' });

  // Log the redemption request
  db.query('INSERT INTO redemptions (email, option) VALUES (?, ?)', [email, option], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to log redemption', error: err });
    res.json({ message: 'Redemption request sent to admin' });
  });
});

module.exports = router;
