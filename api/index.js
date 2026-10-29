const express = require('express');
const webpush = require('web-push');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    publicVapidKey,
    privateVapidKey
);

// Persistent Database connection for Vercel/Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    prepareThreshold: 0
});

// Ensure table exists on startup
pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).catch(err => console.error("DB init error:", err));

// 1. Subscribe endpoint (Saves to Supabase instead of memory)
app.post('/api/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        await pool.query('DELETE FROM subscriptions'); // keep only active device
        await pool.query('INSERT INTO subscriptions (data) VALUES ($1)', [subscription]);
        res.status(201).json({});
        console.log("Target browser successfully registered in database!");
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ error: 'Failed to save subscription' });
    }
});

// 2. Send notification endpoint (Reads from Supabase)
app.post('/api/send-notification', async (req, res) => {
    const { title, message, secretKey } = req.body;

    if (secretKey !== process.env.SECRET_KEY && secretKey !== 'YOUR_SUPER_SECRET_KEY') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const result = await pool.query('SELECT data FROM subscriptions ORDER BY id DESC LIMIT 1');
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'No target browser connected in database.' });
        }

        const savedSubscription = result.rows[0].data;
        const payload = JSON.stringify({ title, body: message });

        await webpush.sendNotification(savedSubscription, payload);
        res.status(200).json({ status: 'Notification sent successfully!' });
    } catch (error) {
        console.error('Error sending push:', error);
        res.status(500).json({ error: 'Failed to push notification' });
    }
});

// EXPORT FOR VERCEL (No app.listen!)
module.exports = app;
