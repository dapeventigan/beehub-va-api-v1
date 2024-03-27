const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  manatalID: String,
  pdfFile: String,
  profilePicture: String,
  selectedOption: String,
  fname: String,
  lname: String,
  username: String,
  mobileNumber: String,
  industry: String,
  company: String,
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
  emailSubscribe: { type: Boolean, default: false },
  googleVerified: { type: Boolean, default: false },
  archive: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  contacted: { type: Boolean, default: false },
  verifiedForJob: { type: Boolean, default: false },
  joinedDate: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("UserData", UserSchema);
module.exports = UserModel;
