const mongoose = require("mongoose");

const EmploymentSchema = new mongoose.Schema({
    //CLIENT
    clientID: String,
    clientName: String,
    clientCompany: String,
    //VA
    vaID: String,
    vaName: String,
    //JOB
    jobID: String,
    jobTitle: String,
    jobSalary: String,
    jobEmploymentType: String,
    jobWorkHours: String,
    jobStatus: String,
    dateHired: Date,
    dateEnded: Date,
    employmentStatus: String,
});

const EmploymentModel = mongoose.model("Employment", EmploymentSchema);
module.exports = EmploymentModel;