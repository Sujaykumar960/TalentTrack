const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const User = require('./models/user');
const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors());

// Static Files (CSS, JS, Images) serve karne ke liye
// Isse browser ko style.css aur script.js mil payenge
app.use(express.static(path.join(__dirname, '../TalentTrack')));

// Authentication Middleware
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: "No token, authorization denied" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(400).json({ msg: "Token is not valid" });
    }
};

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 MongoDB Connected..."))
    .catch(err => console.error("❌ Connection Error:", err));

// --- HTML PAGE ROUTES ---
// In routes ki wajah se localhost:5000/login likhne par page dikhega

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../TalentTrack/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../TalentTrack/login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../TalentTrack/signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../TalentTrack/dashboard.html'));
});

// --- API ROUTES ---

/** 1. USER REGISTRATION (Sabh fields ke saath) **/
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role, phone, age, location, sport } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Naye fields ko yahan add kiya gaya hai taaki DB mein save ho
        user = new User({ 
            name, email, password: hashedPassword, role, phone, age, location, sport 
        });
        
        await user.save();
        res.status(201).json({ message: "Account created successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error during registration" });
    }
});

// server.js ke andar routes section mein add karein
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../TalentTrack/dashboard.html'));
});


const Opportunity = require('./models/opportunity'); // Model import karein

// 1. Nayi Opportunity Post karna (Sirf Scout kar sakega)
app.post('/api/opportunities', auth, async (req, res) => {
    try {
        if (req.user.role !== 'scout') {
            return res.status(403).json({ msg: "Only scouts can post trials" });
        }
        const { title, sport, location, description, date } = req.body;
        const newOpp = new Opportunity({
            title, sport, location, description, date,
            scoutId: req.user.id,
            scoutName: req.body.scoutName // Frontend se naam bhejenge
        });
        await newOpp.save();
        res.json({ msg: "Opportunity Posted Successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Post karne mein error aayi" });
    }
});

// 2. Sabhi Opportunities ko fetch karna (Player dekh sakega)
app.get('/api/all-opportunities', async (req, res) => {
    try {
        const opps = await Opportunity.find().sort({ createdAt: -1 });
        res.json(opps);
    } catch (err) {
        res.status(500).json({ error: "Opportunities load nahi ho payi" });
    }
});






/** 2. USER LOGIN **/
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid Credentials" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.json({ 
            token, 
            user: { id: user._id, name: user.name, role: user.role } 
        });
    } catch (error) {
        res.status(500).json({ error: "Login error" });
    }
});

/** 3. LINKEDIN STYLE FEED API **/
app.get('/api/feed', async (req, res) => {
    try {
        // Saare users (Athletes & Scouts) ko dikhayega
        const allUsers = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(allUsers);
    } catch (err) {
        res.status(500).json({ error: "Feed load nahi ho payi" });
    }
});

/** 4. GET MY PROFILE (Dashboard ke liye) **/
app.get('/api/user/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// server.js mein add karein
app.post('/api/opportunities/:id/apply', auth, async (req, res) => {
    try {
        const opportunity = await Opportunity.findById(req.params.id);
        if (!opportunity) return res.status(404).json({ msg: "Trial not found" });

        // Check karein ki kahin player ne pehle hi apply toh nahi kar diya
        const alreadyApplied = opportunity.applicants.some(a => a.userId.toString() === req.user.id);
        if (alreadyApplied) return res.status(400).json({ msg: "Pehle hi apply kar chuke hain" });

        opportunity.applicants.push({ userId: req.user.id });
        await opportunity.save();
        res.json({ msg: "Applied Successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Apply karne mein dikkat aayi" });
    }
});

// Scout ke liye: Applicants dekhne ka route
app.get('/api/my-trials', auth, async (req, res) => {
    try {
        // Scout dwara post kiye gaye saare trials aur applicants ka data
        const myTrials = await Opportunity.find({ scoutId: req.user.id })
                                         .populate('applicants.userId', 'name email sport phone');
        res.json(myTrials);
    } catch (err) {
        res.status(500).json({ error: "Data fetch failed" });
    }
});

// server.js mein add karein
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});


// --- MESSAGE FUNCTIONALITY ---

const Message = require('./models/message'); // Upar import karein

// 1. Send Message API
app.post('/api/messages/send', auth, async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const newMessage = new Message({
            sender: req.user.id,
            receiver: receiverId,
            text
        });
        await newMessage.save();
        res.json({ msg: "Message sent!" });
    } catch (err) { res.status(500).json({ error: "Failed to send" }); }
});

// 2. Get Chat History API
app.get('/api/messages/:otherUserId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: req.params.otherUserId },
                { sender: req.params.otherUserId, receiver: req.user.id }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});


/** PROFILE PHOTO UPDATE **/

const multer = require('multer');
/**  const path = require('path'); **/
const fs = require('fs');

// Static folder banayein taaki photos access ho sakein
//app.use('/uploads', express.static('uploads'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Profile Photo Update Route
app.post('/api/user/upload-photo', auth, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

        const user = await User.findById(req.user.id);
        user.profilePic = `/uploads/${req.file.filename}`; // Database mein path save karein
        await user.save();

        res.json({ msg: "Photo updated!", filePath: user.profilePic });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});




/** 5. UPDATE PROFILE **/
app.put('/api/user/update', auth, async (req, res) => {
    try {
        const { bio, sport, location, videoUrl, phone, age } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id, 
            { $set: { bio, sport, location, videoUrl, phone, age } },
            { new: true }
        ).select('-password');
        
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));