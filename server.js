require('dotenv').config();
const express = require('express');
const makeWASocket  = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

let sock = null;

async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectWhatsApp, 5000);
            }
        }

        if (connection === 'open') {
            console.log('🚀 WhatsApp Connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectWhatsApp();

// Send bill endpoint
app.get('/send-bill', async (req, res) => {
    try {
        const { phone, amount, ticketId, from, to } = req.query;

        if (!phone || !amount || !from || !to) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        if (!sock) {
            return res.status(503).json({ error: 'WhatsApp not ready' });
        }

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
        res.json({ success: true, message: '✅ Bill sent!' });

    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: sock ? 'connected' : 'not ready',
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
