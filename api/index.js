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

// Ensure table and unique index exist on startup
pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_endpoint_idx 
    ON subscriptions ((data->>'endpoint'));
`).catch(err => console.error("DB init error:", err));;

app.post('/api/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        
        await pool.query(`
            INSERT INTO subscriptions (data) 
            VALUES ($1) 
            ON CONFLICT ((data->>'endpoint')) 
            DO UPDATE SET data = EXCLUDED.data, created_at = CURRENT_TIMESTAMP
        `, [subscription]);

        res.status(201).json({});
        console.log("Device successfully registered or updated in database!");
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ error: 'Failed to save subscription' });
    }
});

// 2. Send notification endpoint (Broadcasts to ALL devices in Supabase)
app.post('/api/send-notification', async (req, res) => {
    const { title, message, secretKey } = req.body;

    if (secretKey !== process.env.SECRET_KEY && secretKey !== 'YOUR_SUPER_SECRET_KEY') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const result = await pool.query('SELECT id, data FROM subscriptions');
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'No target browsers connected in database.' });
        }

        const payload = JSON.stringify({ title, body: message });
        
        // Map all push requests into parallel promises
        const pushPromises = result.rows.map(async (row) => {
            try {
                await webpush.sendNotification(row.data, payload);
            } catch (error) {
                // If a subscription has expired or the user revoked permissions (404/410), clean it up
                if (error.statusCode === 404 || error.statusCode === 410) {
                    console.log(`Removing expired subscription ID: ${row.id}`);
                    await pool.query('DELETE FROM subscriptions WHERE id = $1', [row.id]);
                } else {
                    console.error(`Failed to send to subscription ${row.id}:`, error);
                }
            }
        });

        await Promise.all(pushPromises);

        res.status(200).json({ status: `Notification broadcasted to ${result.rows.length} device(s) successfully!` });
    } catch (error) {
        console.error('Error broadcasting push:', error);
        res.status(500).json({ error: 'Failed to broadcast push notification' });
    }
});
// EXPORT FOR VERCEL (No app.listen!)
module.exports = app;
