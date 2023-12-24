const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.NODEMAIL_CLIENTID,
  process.env.NODEMAIL_CLIENTSECRET,
  process.env.REDIRECT_GMAILURI
);

oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESHTOKEN });

module.exports = async (email, link) => {
  try {
    const ACCESS_TOKEN = await oAuth2Client.getAccessToken();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.NODEMAIL_EMAIL,
        clientId: process.env.NODEMAIL_CLIENTID,
        clientSecret: process.env.NODEMAIL_CLIENTSECRET,
        refreshToken: process.env.GMAIL_REFRESHTOKEN,
        accessToken: ACCESS_TOKEN,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    await transporter.sendMail({
      from: process.env.NODEMAIL_EMAIL,
      to: email,
      subject: "BeeHub: Reset Password",
      html: `
			<div>
			<p>Hello, this is a verificatbion email.</p>
			<a href=${link}> Click here to activate your account</a>
			</div>
			`,
    });
    console.log("email sent successfully");
  } catch (error) {
    console.log("email not sent!");
    console.log(error);
    return error;
  }
};
