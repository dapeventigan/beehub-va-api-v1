const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
    vaID: String,
    certificateTitle: String,
    certificateStart: Date,
    certificateEnd: Date,
    certificate: String,
});

const CertificateModel = mongoose.model("Certificate", CertificateSchema);
module.exports = CertificateModel;