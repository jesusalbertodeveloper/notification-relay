const express = require('express');
const webpush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate these once locally using `npx web-push generate-vapid-keys` and paste them here:
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    publicVapidKey,
    privateVapidKey
);

let savedSubscription = null;

// Target browser registers its push subscription here
app.post('/subscribe', (req, res) => {
    savedSubscription = req.body;
    res.status(201).json({});
    console.log("Target browser successfully registered!");
});

// Your app sends notifications to this endpoint
app.post('/send-notification', async (req, res) => {
    const { title, message, secretKey } = req.body;

    if (secretKey !== 'YOUR_SUPER_SECRET_KEY') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!savedSubscription) {
        return res.status(400).json({ error: 'No target browser connected.' });
    }

    const payload = JSON.stringify({ title, body: message });

    try {
        await webpush.sendNotification(savedSubscription, payload);
        res.status(200).json({ status: 'Notification sent successfully!' });
    } catch (error) {
        console.error('Error sending push:', error);
        res.status(500).json({ error: 'Failed to push notification' });
    }
});

// Render assigns a dynamic port via process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
