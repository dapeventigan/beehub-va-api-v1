const mongoose = require("mongoose");

const JobBoardsSchema = new mongoose.Schema({
  jobManatalID: String,
  jobTitle: String,
  jobSummary: String,
  jobHeadcount: String,
  jobCurrency: String,
  jobMinSalary: String,
  jobMaxSalary: String,
  jobLocation: String,
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
