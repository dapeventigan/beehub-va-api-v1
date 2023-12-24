const mongoose = require("mongoose");

const VerifyUserSchema = new mongoose.Schema({
  userId: { type: String, ref: "user", unique: true },
  uniqueString: String,
  createdAt: { type: Date, default: Date.now(), expires: 3600 },
});

const VerifyUserModel = mongoose.model("VerifyUserData", VerifyUserSchema);
module.exports = VerifyUserModel;
