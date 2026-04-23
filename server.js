require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ Connected to MongoDB Atlas');

    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            clientId: 'pune-metro-session',
            store: store,
            backupSyncIntervalMs: 60000 // Faster sync (1 minute)
        }),
        puppeteer: {
            headless: true, // Run in background
            args: ['--no-sandbox']
        }
    });

    client.on('qr', (qr) => {
        console.log('\n📱 SCAN THIS QR CODE:');
        qrcode.generate(qr, { small: true });
    });

    // THIS IS THE IMPORTANT PART
    client.on('remote_session_saved', () => {
        console.log('💾 SAVED! Check your Atlas collections now.');
    });

    client.on('ready', () => {
        console.log('\n🚀 READY! STAY ON THIS SCREEN FOR 2 MINUTES TO FINISH UPLOAD.');
    });

    client.initialize();
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
