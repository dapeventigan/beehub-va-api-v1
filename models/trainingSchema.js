const mongoose = require("mongoose");

const TrainingSchema = new mongoose.Schema({
    vaID: String,
    vaName: String,
    trainingTitle: String,
    trainingStart: Date,
    trainingEnd: Date,
    certificate: String,
});

const TrainingModel = mongoose.model("Training", TrainingSchema);
module.exports = TrainingModel;