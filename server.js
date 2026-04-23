require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Pre-create session directories (Linux paths)
const sessionDirs = [
    './.wwebjs_auth/wwebjs_temp_session_pune-metro-session/Default',
    './.wwebjs_auth/wwebjs_temp_session_pune-metro-session/Default/Cache',
];
sessionDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created: ${dir}`);
    }
});

app.use(express.json());

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ Connected to MongoDB Atlas');

    const store = new MongoStore({ mongoose });

    // Wait for store to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    const client = new Client({
        authStrategy: new RemoteAuth({
            clientId: 'pune-metro-session',
            store: store,
            backupSyncIntervalMs: 300000,
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--hide-scrollbars',
                '--mute-audio',
                '--safebrowsing-disable-auto-update',
            ],
            timeout: 120000
        }
    });

    client.on('qr', (qr) => {
        console.log('\n📱 SCAN THIS QR CODE:');
        qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
        console.log('🔐 Authenticated!');
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to MongoDB!');
    });

    client.on('ready', () => {
        console.log('🚀 WhatsApp Client is Ready!');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Auth Failure:', msg);
    });

    client.on('disconnected', (reason) => {
        console.warn('⚠️ Disconnected:', reason);
        // Auto reconnect
        setTimeout(() => client.initialize(), 5000);
    });

    client.initialize();

    // Send bill endpoint
    app.get('/send-bill', async (req, res) => {
        try {
            const { phone, amount, ticketId, from, to } = req.query;

            if (!phone || !amount || !from || !to) {
                return res.status(400).json({ error: 'Missing required parameters: phone, amount, from, to' });
            }

            if (!client.info) {
                return res.status(503).json({ error: 'WhatsApp not ready yet. Try again in a moment.' });
            }

            const formattedNumber = `91${phone}@c.us`;
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

            await client.sendMessage(formattedNumber, billMessage);
            res.json({ success: true, message: '✅ Bill sent!', to: phone });

        } catch (error) {
            console.error('Send error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            whatsapp: client.info ? 'connected' : 'not ready',
            phone: client.info?.wid?.user || null,
            uptime: process.uptime()
        });
    });

}).catch((err) => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
