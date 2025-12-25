const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
    title: { type: String, required: true }, // Jaise: "U-19 Cricket Selection"
    sport: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: String, required: true }, // Kab hoga trial
    scoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Kisne post kiya
    scoutName: String,

    //applicant list  dikhane ke liye
applicants: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            appliedAt: { type: Date, default: Date.now }
        }
    ]

}, { timestamps: true });

module.exports = mongoose.model('Opportunity', OpportunitySchema);