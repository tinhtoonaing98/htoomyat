const express = require('express');
const router = express.Router();
const db = require('../db'); // Import the database connection

// 1. Fetch Users and Their Points
router.get('/admin/users', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, email, points FROM users');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Error fetching users data' });
    }
});

// 2. Adjust User Points (Increase or Decrease)
router.post('/admin/adjust-points', async (req, res) => {
    const { userId, points } = req.body;
    if (!userId || !points) {
        return res.status(400).json({ success: false, message: 'User ID and points are required' });
    }

    try {
        const [user] = await db.execute('SELECT points FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const currentPoints = user[0].points;
        const newPoints = parseInt(currentPoints) - parseInt(points);

        if (newPoints < 0) {
            return res.status(400).json({ success: false, message: 'Insufficient points for adjustment' });
        }

        // Update the points in the database
        await db.execute('UPDATE users SET points = ? WHERE id = ?', [newPoints, userId]);

        res.status(200).json({ success: true, message: 'Points adjusted successfully' });
    } catch (error) {
        console.error('Error adjusting points:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 3. Add Points to User
router.post('/admin/add-points', async (req, res) => {
    const { userId, points } = req.body;
    if (!userId || !points) {
        return res.status(400).json({ success: false, message: 'User ID and points are required' });
    }

    try {
        const [user] = await db.execute('SELECT points FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const currentPoints = user[0].points;
        const newPoints = parseInt(currentPoints) + parseInt(points);

        // Update the points in the database
        await db.execute('UPDATE users SET points = ? WHERE id = ?', [newPoints, userId]);

        res.status(200).json({ success: true, message: 'Points added successfully' });
    } catch (error) {
        console.error('Error adding points:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 4. Fetch Redemption Requests
router.get('/admin/redemptions', async (req, res) => {
    try {
        const [redemptions] = await db.execute('SELECT * FROM redemptions');
        res.status(200).json(redemptions);
    } catch (error) {
        console.error('Error fetching redemptions:', error);
        res.status(500).json({ success: false, message: 'Error fetching redemptions' });
    }
});

// 5. Approve Redemption Request
router.post('/admin/approve-redemption', async (req, res) => {
    const { redemptionId } = req.body;
    if (!redemptionId) {
        return res.status(400).json({ success: false, message: 'Redemption ID is required' });
    }

    try {
        // Approve redemption by deleting it from the redemption table (or other business logic)
        await db.execute('DELETE FROM redemptions WHERE id = ?', [redemptionId]);

        res.status(200).json({ success: true, message: 'Redemption request approved' });
    } catch (error) {
        console.error('Error approving redemption:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
