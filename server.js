require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const fs = require('fs');
const { execSync } = require('child_process');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

let lastQR = null;

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
            executablePath: '/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
            ]
        }
    });

    client.on('qr', (qr) => {
        lastQR = qr;
        console.log('📱 QR ready - open /qr in browser to scan!');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        lastQR = null;
        console.log('🚀 WhatsApp Client is Ready!');
    });

    client.on('authenticated', () => {
        console.log('🔐 Authenticated!');
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to MongoDB!');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Auth failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.warn('⚠️ Disconnected:', reason);
    });

    client.initialize().catch(err => {
        console.error('❌ Initialize error:', err.message);
    });

    // QR CODE PAGE - open this in browser to scan
    app.get('/qr', async (req, res) => {
        if (!lastQR) {
            return res.send(`
                <html>
                <body style="font-family:sans-serif;text-align:center;padding:50px;background:#000;color:#fff">
                    <h2>⏳ QR Not Ready Yet</h2>
                    <p>WhatsApp is already connected OR QR hasn't generated yet.</p>
                    <p>Refresh this page in 10 seconds.</p>
                    <script>setTimeout(()=>location.reload(), 5000)</script>
                </body>
                </html>
            `);
        }

        const qrImage = await QRCode.toDataURL(lastQR);
        res.send(`
            <html>
            <body style="font-family:sans-serif;text-align:center;padding:50px;background:#000;color:#fff">
                <h2>📱 Scan with WhatsApp</h2>
                <p>Open WhatsApp → Linked Devices → Link a Device</p>
                <img src="${qrImage}" style="width:300px;height:300px;border:10px solid white;border-radius:10px"/>
                <p>QR expires in ~20 seconds. Page auto-refreshes.</p>
                <script>setTimeout(()=>location.reload(), 15000)</script>
            </body>
            </html>
        `);
    });

    app.get('/send-bill', async (req, res) => {
        try {
            const { phone, amount, ticketId, from, to } = req.query;
            if (!phone || !amount || !from || !to)
                return res.status(400).json({ error: 'Missing parameters' });
            if (!client.info)
                return res.status(503).json({ error: 'WhatsApp not ready yet' });

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
            console.error('Send error:', error);
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
