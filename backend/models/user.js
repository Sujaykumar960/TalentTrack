const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Role 'player' rakha hai server logic se match karne ke liye
    role: { type: String, enum: ['player', 'scout'], default: 'player' },
    sport: String,
    location: String,
    phone: String,
    bio: String,
    profilePic: { type: String, default: '' } 
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);