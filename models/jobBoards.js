const mongoose = require("mongoose");

const JobBoardsSchema = new mongoose.Schema({
  jobTitle: String,
  jobSummary: String,
  jobSalary: String,
  jobEmploymentType: String,
  jobLevelExperience: String,
  jobHours: String,
  jobCompanyOverview: String,
  jobKeyResponsibilities: String,
  jobRequirements: String,
  jobEducation: String,
  jobBenefits: String,
  jobSkills: Array,
  jobApplicationRequirements: String,
  jobDeadline: Date,
  jobPosted: Date,
  jobPostedBy: String,
  jobPostedById: String,
  jobVerified: { type: String, default: "Pending" },
  usersApplied: Array,
});

const JobBoardsModel = mongoose.model("JobBoards", JobBoardsSchema);
module.exports = JobBoardsModel;
