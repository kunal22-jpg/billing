require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const dirs = [
    './.wwebjs_auth/wwebjs_temp_session_pune-metro-session/Default',
    './.wwebjs_auth/wwebjs_temp_session_pune-metro-session/Default/Cache',
];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ Connected to MongoDB Atlas');

    const store = new MongoStore({ mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            clientId: 'pune-metro-session',
            store: store,
            backupSyncIntervalMs: 300000,
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
            ]
        }
    });

    client.on('ready', () => {
        console.log('🚀 WhatsApp Client is Ready!');
    });

    client.on('authenticated', () => {
        console.log('🔐 Authenticated from MongoDB session!');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Auth failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.warn('⚠️ Disconnected:', reason);
    });

    client.initialize();

    app.get('/send-bill', async (req, res) => {
        try {
            const { phone, amount, ticketId, from, to } = req.query;
            if (!phone || !amount || !from || !to)
                return res.status(400).json({ error: 'Missing parameters' });

            const jid = `91${phone}@c.us`;
            const billMessage = [
                `🚆 *PUNE METRO E-TICKET* 🚆`,
                `---`,
                `🎫 Ticket ID: ${ticketId || 'N/A'}`,
                `💰 Amount: ₹${amount}`,
                `🚉 From: ${from}`,
                `🚉 To: ${to}`,
                `---`,
                `Thank you for traveling with Pune Metro! 🙏`
            ].join('\n');

            await client.sendMessage(jid, billMessage);
            res.json({ success: true, message: '✅ Bill sent!' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            whatsapp: client.info ? 'connected' : 'not ready',
            uptime: Math.floor(process.uptime()) + 's'
        });
    });

}).catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
