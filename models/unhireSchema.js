const mongoose = require("mongoose");

const UnhireSchema = new mongoose.Schema({
    vaID: String,
    vaName: String,
    matchID: String,
    jobID: String,
    jobName: String,
    clientID: String,
    clientName: String,
    status: String,
    message: String,
});

const UnhireModel = mongoose.model("Unhire", UnhireSchema);
module.exports = UnhireModel;