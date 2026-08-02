const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// জমা হওয়া সব সাবমিশন ডাটা মেমরিতে রাখার জন্য
let submissions = [];

// ইউজারের জমা দেওয়া ফর্ম রিসিভ করার API
app.post('/api/submit', (req, res) => {
    const data = req.body;
    submissions.push(data);
    res.json({ success: true, message: 'Submitted successfully' });
});

// এডমিন লগইন API (এখানে আপনার ইমেইল ও পাসওয়ার্ড সেট করে দেওয়া হয়েছে)
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;

    const ADMIN_EMAIL = "asraful@gmail.com";
    const ADMIN_PASS = "Asraful";

    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
        res.json({
            success: true,
            submissions: submissions
        });
    } else {
        res.json({
            success: false,
            message: "ভুল এডমিন ইমেল অথবা পাসওয়ার্ড!"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
