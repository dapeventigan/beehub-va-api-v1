const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  pdfFile: String,
  selectedOption: String,
  fname: String,
  lname: String,
  mobileNumber: String,
  industry: String,
  email: String,
  password: String,
  hearAbout: String,
  othersOption: String,
  skills: Object,
  role: String,
  emailSubscribe: { type: Boolean, default: false },
  googleVerified: { type: Boolean, default: false },
  archive: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  contacted: { type: Boolean, default: false },
});

const UserModel = mongoose.model("UserData", UserSchema);
module.exports = UserModel;
