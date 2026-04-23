require('dotenv').config();
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

let sock = null;
let isConnected = false;

async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Pune Metro', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log('⚠️ Disconnected. Code:', code, '| Reconnecting:', shouldReconnect);
            if (shouldReconnect) setTimeout(connectWhatsApp, 5000);
        }

        if (connection === 'open') {
            isConnected = true;
            console.log('🚀 WhatsApp Connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectWhatsApp().catch(err => console.error('WA init error:', err));

app.get('/send-bill', async (req, res) => {
    try {
        const { phone, amount, ticketId, from, to } = req.query;

        if (!phone || !amount || !from || !to)
            return res.status(400).json({ error: 'Missing parameters: phone, amount, from, to' });

        if (!isConnected)
            return res.status(503).json({ error: 'WhatsApp not connected yet. Try again shortly.' });

        const jid = `91${phone}@s.whatsapp.net`;
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

        await sock.sendMessage(jid, { text: billMessage });
        res.json({ success: true, message: '✅ Bill sent!', to: phone });

    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: isConnected ? 'connected' : 'not ready',
        uptime: Math.floor(process.uptime()) + 's'
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
