// Import required modules
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();

// Load environment variables
dotenv.config();

// Middleware
app.use(cors({
  origin: 'http://localhost', 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'htoomyat'
});

// Connect to the database
db.connect(err => {
  if (err) {
    console.error('Failed to connect to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database!');
});

// Register endpoint (UPDATED)
app.post('/register', (req, res) => {
  const { username, email, mobile, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  const query = 'INSERT INTO users (username, email, mobile, password, points) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [username, email, mobile, hashedPassword, 200], (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error registering user', error: err });
    }
    res.status(201).send({ message: 'User registered successfully' });
  });
});


// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Received login:', email, password);

  if (!email || !password) {
    return res.status(400).send({ message: 'Email and password are required' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error fetching user', error: err });
    }

    if (result.length === 0) {
      return res.status(404).send({ message: 'User not found' });
    }

    const user = result[0];
    if (!user.password) {
      return res.status(500).send({ message: 'Password is missing in DB' });
    }

    console.log('Comparing:', password, user.password.toString());
    const isPasswordValid = bcrypt.compareSync(password, user.password.toString());

    if (!isPasswordValid) {
      return res.status(401).send({ message: 'Invalid password' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' });

    res.status(200).send({ message: 'Login successful', token });
  });
});

// Fetch user points (and info) for dashboard
app.get('/dashboard', (req, res) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).send({ message: 'Token is required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Invalid or expired token' });
    }

    const query = 'SELECT username, email, mobile, points, lastLogin FROM users WHERE id = ?';
    db.query(query, [decoded.userId], (err, result) => {
      if (err) {
        return res.status(500).send({ message: 'Error fetching user data', error: err });
      }
      if (result.length === 0) {
        return res.status(404).send({ message: 'User not found' });
      }
      const user = result[0];
      res.status(200).send({
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        points: user.points,
        lastLogin: user.lastLogin
      });
    });
  });
});



// Admin: View users
app.get('/admin/users', (req, res) => {
  const query = 'SELECT id, email, points FROM users';
  db.query(query, (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error fetching users data', error: err });
    }
    res.status(200).send(result);
  });
});

// Admin: Adjust points
app.post('/admin/adjust-points', (req, res) => {
  const { userId, points } = req.body;

  const query = 'UPDATE users SET points = ? WHERE id = ?';
  db.query(query, [points, userId], (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error adjusting points', error: err });
    }
    res.status(200).send({ message: 'Points adjusted successfully' });
  });
});

// Admin: Add points to current points
app.post('/admin/add-points', (req, res) => {
  const { userId, pointsToAdd } = req.body;

  const query = 'UPDATE users SET points = points + ? WHERE id = ?';
  db.query(query, [pointsToAdd, userId], (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error adding points', error: err });
    }
    res.status(200).send({ message: 'Points added successfully' });
  });
});

// Admin: View redemption requests
app.get('/admin/redemptions', (req, res) => {
  const query = 'SELECT * FROM redemptions';
  db.query(query, (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error fetching redemption requests', error: err });
    }
    res.status(200).send(result);
  });
});

// Admin: Approve redemption with points deduction
app.post('/admin/approve-redemption', (req, res) => {
  console.log("🔥 Redemption Approval API Hit");

  const { redemptionId, pointsToDeduct } = req.body;
  console.log("👉 Data Received:", redemptionId, pointsToDeduct);

  if (!pointsToDeduct || isNaN(pointsToDeduct)) {
    console.log("⚠️ Invalid points");
    return res.status(400).send({ message: 'Points to deduct must be a valid number' });
  }

  // Fetch redemption
  db.query('SELECT * FROM redemptions WHERE id = ?', [redemptionId], (err, redemptionResult) => {
    if (err || redemptionResult.length === 0) {
      console.log("❌ Redemption fetch failed");
      return res.status(500).send({ message: 'Error fetching redemption', error: err });
    }

    const redemption = redemptionResult[0];
    const userEmail = redemption.email.trim().toLowerCase();
    console.log("📧 Email from redemption:", userEmail);

    // Deduct points
    const deductQuery = 'UPDATE users SET points = points - ? WHERE LOWER(email) = ?';
    db.query(deductQuery, [pointsToDeduct, userEmail], (err, updateResult) => {
      if (err) {
        console.log("❌ Error deducting points:", err);
        return res.status(500).send({ message: 'Error deducting points', error: err });
      }

      if (updateResult.affectedRows === 0) {
        console.log("⚠️ No user updated. Possibly email mismatch.");
        return res.status(400).send({ message: 'User not found or insufficient points' });
      }

      // Update redemption status
      db.query('UPDATE redemptions SET status = "approved" WHERE id = ?', [redemptionId], (err) => {
        if (err) {
          console.log("❌ Error updating redemption status:", err);
          return res.status(500).send({ message: 'Error updating redemption status', error: err });
        }

        console.log(`✅ Redemption approved. ${pointsToDeduct} points deducted.`);
        return res.status(200).send({ message: `Redemption approved. ${pointsToDeduct} points deducted.` });
      });
    });
  });
});

// Admin: Reject redemption
app.post('/admin/reject-redemption', (req, res) => {
  const { redemptionId } = req.body;

  const query = 'UPDATE redemptions SET status = "rejected" WHERE id = ?';
  db.query(query, [redemptionId], (err, result) => {
    if (err) {
      return res.status(500).send({ message: 'Error rejecting redemption', error: err });
    }
    res.status(200).send({ message: 'Redemption rejected' });
  });
});

// User: Submit redemption request
app.post('/redeem', (req, res) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).send({ message: 'Authorization header required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Invalid or expired token' });
    }

    const userId = decoded.userId;
    const { option } = req.body;
    if (!option) {
      return res.status(400).send({ message: 'Redemption option is required' });
    }

    // 🧮 Define redemption costs
    const OPTION_COSTS = {
      'Option A': 100,
      'Option B': 200,
      'Option C': 300
    };

    const cost = OPTION_COSTS[option];
    if (!cost) {
      return res.status(400).send({ message: 'Invalid redemption option selected.' });
    }

    // 🔍 Get user info and check point balance
    db.query('SELECT email, points FROM users WHERE id = ?', [userId], (err, rows) => {
      if (err || !rows.length) {
        return res.status(500).send({ message: 'Error fetching user info', error: err });
      }

      const { email, points } = rows[0];

      if (points < cost) {
        return res.status(400).send({ message: `Not enough points. You need ${cost} points for ${option}, but you only have ${points}.` });
      }

      // 📝 Create redemption request
      const sql = 'INSERT INTO redemptions (email, `OPTION`, status) VALUES (?, ?, "pending")';
      db.query(sql, [email, option], err => {
        if (err) {
          return res.status(500).send({ message: 'Error creating redemption', error: err });
        }
        res.status(201).send({ message: `Redemption request for ${option} submitted!` });
      });
    });
  });
});

// Admin Login endpoint
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  // Hardcoded admin credentials for now (you can improve later)
  const adminEmail = 'admin@htoomyat.com';
  const adminPassword = 'admin123'; // You can use bcrypt here too if you want

  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '2h' });
    res.status(200).send({ message: 'Admin login successful', token });
  } else {
    res.status(401).send({ message: 'Invalid admin credentials' });
  }
});
  //recent redemptions
  app.get('/user/redemptions', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send({ message: 'Token required' });
  
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
      if (err) return res.status(403).send({ message: 'Invalid token' });
  
      const query = 'SELECT OPTION, requested_at, status FROM redemptions WHERE email = (SELECT email FROM users WHERE id = ?) ORDER BY requested_at DESC LIMIT 5';
      db.query(query, [decoded.userId], (err, results) => {
        if (err) return res.status(500).send({ message: 'Error fetching redemptions', error: err });
        res.send(results);
      });
    });
  });
  


// Start the server
const port = 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
