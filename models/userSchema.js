  const mongoose = require("mongoose");

const jobDetailsSchema = new mongoose.Schema({
  name: String,
  date: Date,
  jobName: String,
});

const UserSchema = new mongoose.Schema({
  pdfFile: String,
  profilePicture: String,
  selectedOption: String,
  fname: String,
  lname: String,
  username: String,
  mobileNumber: String,
  industry: String,
  email: String,
  password: String,
  hearAbout: String,
  othersOption: String,
  skills: Object,
  userTitle: String,
  education: String,
  bio: String,
  portfolio: String,
  fbLink: String,
  linkedinLink: String,
  igLink: String,
  role: String,
  jobHistory: [jobDetailsSchema],
  emailSubscribe: { type: Boolean, default: false },
  googleVerified: { type: Boolean, default: false },
  archive: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  contacted: { type: Boolean, default: false },
});

const UserModel = mongoose.model("UserData", UserSchema);
module.exports = UserModel;
