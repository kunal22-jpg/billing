require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Connect to MongoDB Atlas First
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ Connected to MongoDB Atlas');

    // 2. Initialize the MongoStore for WhatsApp Session
    const store = new MongoStore({ mongoose: mongoose });

    // 3. Initialize WhatsApp Client with RemoteAuth (For Render/Cloud)
    const client = new Client({
        authStrategy: new RemoteAuth({
            clientId: 'pune-metro-session',
            store: store,
            backupSyncIntervalMs: 300000 // Automatically saves session every 5 minutes
        }),
        puppeteer: {
            // THESE ARGS ARE STRICTLY REQUIRED FOR RENDER TO NOT CRASH
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // 4. WhatsApp Event Listeners
    client.on('qr', (qr) => {
        console.log('\n📱 SCAN THIS QR CODE WITH YOUR WHATSAPP (ONLY ONCE):');
        qrcode.generate(qr, { small: true });
    });

    client.on('remote_session_saved', () => {
        console.log('💾 WhatsApp Session saved to MongoDB successfully!');
    });

    client.on('ready', () => {
        console.log('\n🚀 WhatsApp Client is Ready and connected!');
    });

    client.initialize();

    // 5. The API Endpoint for the Customer's Scan
    app.get('/send-bill', async (req, res) => {
        try {
            const { phone, amount, ticketId, from, to } = req.query;

            if (!phone || !amount) {
                return res.status(400).send('Missing bill details! Please provide phone and amount.');
            }

            const formattedNumber = `91${phone}@c.us`; 

            const billMessage = `
🚆 *PUNE METRO E-TICKET* 🚆
--------------------------------
🎫 *Ticket ID:* ${ticketId || 'TXN-' + Math.floor(Math.random() * 10000)}
🚉 *From:* ${from || 'Station A'}
🚉 *To:* ${to || 'Station B'}
💰 *Total Amount:* ₹${amount}
--------------------------------
Thank you for traveling! Have a safe journey. 🌍♻️ (Go Paperless)
            `;

            await client.sendMessage(formattedNumber, billMessage.trim());
            console.log(`✅ Bill sent successfully to ${phone}`);
            
            res.send(`
                <html>
                    <body style="text-align: center; font-family: sans-serif; padding-top: 50px;">
                        <h2 style="color: green;">✅ Bill Sent Successfully!</h2>
                        <p>Check your WhatsApp for your e-ticket.</p>
                        <p>You can safely close this window.</p>
                    </body>
                </html>
            `);

        } catch (error) {
            console.error('❌ Error sending bill:', error);
            res.status(500).send('Failed to generate e-ticket.');
        }
    });

}).catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
});

app.listen(PORT, () => {
    console.log(`🌐 Express server starting on port ${PORT}... waiting for DB & WhatsApp...`);
});