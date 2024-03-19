const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path"); // Import the 'path' module
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");
const cron = require("node-cron");

//utils
const verifyEmail = require("./utils/verifyEmail");
const resetPassword = require("./utils/resetPassword");
const contactEmail = require("./utils/contactEmail");
const welcomeEmail = require("./utils/welcomeEmail");
const welcomeJoinEmail = require("./utils/welcomeJoinEmail");
require("dotenv").config();

//middlewares
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://beehubvas.com",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
    optionsSuccessStatus: 200,
  },
});
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: "https://beehubvas.com",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://beehubvas.com");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});
app.use("/resumes", express.static(path.join(__dirname, "files/resumes")));
app.use(
  "/profilepicture",
  express.static(path.join(__dirname, "files/profilepicture"))
);

app.use(
  "/certificates",
  express.static(path.join(__dirname, "files/certificates"))
);

mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

//MODELS
const UserModel = require("./models/userSchema");
const VerifyUserModel = require("./models/verifyUserSchema");
const JobBoardModel = require("./models/jobBoards");
const EmploymentModel = require("./models/employmentSchema");
const TrainingModel = require("./models/trainingSchema");
const CertificateModel = require("./models/certificateSchema");

//MANATAL
const sdk = require("api")("@manatalapi/v3#1t65nfls2ndbhu");
sdk.auth(`Token ${process.env.MANATAL_OPEN_AI}`);

//MULTER
const multer = require("multer");

//resumes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files/resumes");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + file.originalname);
  },
});
const upload = multer({ storage: storage });

//profile picture

const imgStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files/profilepicture");
  },
  filename: function (req, file, cb) {
    const uniqueDPname = Date.now();
    cb(null, uniqueDPname + file.originalname);
  },
});

const profilepic = multer({ storage: imgStorage });

//certificates

const certStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files/certificates");
  },
  filename: function (req, file, cb) {
    const uniqueDPname = Date.now();
    cb(null, uniqueDPname + file.originalname);
  },
});

const certificate = multer({ storage: certStorage });

//POST

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on("authenticate", (token) => {
    const userId = token;

    socket.join(userId);

    socket.on("refresh-all", (data) => {
      if (data == userId) {
        io.to(data).emit("refresh");
      }
    });
  });

  socket.on("new_user", (data) => {
    socket.broadcast.emit("senduser_admin", data);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.post("/register", upload.single("pdfFile"), async (req, res) => {
  const roleStatus = req.body.roleStatus;
  const googleSignStatus = req.body.googleVerified;
  const password = req.body.password;

  let user = await UserModel.findOne({
    email: req.body.email,
  });

  if (user) {
    res.send({ message: "Email Already Exist!" });
  } else {
    //CLIENT REGISTRATION
    if (roleStatus === "client") {
      if (googleSignStatus) {
        user = await new UserModel({
          ...req.body,
          verified: true,
          role: roleStatus,
        })
          .save()
          .then((dataModel) => {
            sdk.auth(`Token ${process.env.MANATAL_OPEN_AI}`);
            sdk
              .organizations_create({
                external_id: dataModel._id,
                name: dataModel.fname + " " + dataModel.lname,
              })
              .then(({ data }) => console.log(data))
              .catch((err) => console.error(err));
          })
          .catch((err) => console.error(err));

        // await welcomeJoinEmail(req.body.email, req.body.fname);

        const token = jwt.sign(
          { email: user.email, role: user.role, userID: user._id },
          process.env.JWT_SECRET,
          {
            expiresIn: "1d",
          }
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000,
        });

        res.status(200).send({
          message: "Email sent, check your mail.",
          user: user,
        });
      } else {
        const encryptedPassword = await bcrypt.hash(password, 10);

        try {
          user = await new UserModel({
            ...req.body,
            role: roleStatus,
            password: encryptedPassword,
          }).save();

          await sdk
            .organizations_create({
              external_id: user._id,
              name: user.fname + " " + user.lname,
            })
            .then(({ data }) => {
              console.log(data.id);
              return UserModel.findByIdAndUpdate(user._id, {
                manatalID: data.id,
              });
            })
            .catch((err) => console.error(err));
        } catch (error) {
          console.log(error);
        }

        const userVerify = await new VerifyUserModel({
          userId: user._id,
          uniqueString: crypto.randomBytes(32).toString("hex"),
        }).save();
        const urlVerify = `https://beehubvas.com/verify/${user._id}/${userVerify.uniqueString}`;
        await verifyEmail(req.body.email, urlVerify);

        // await welcomeJoinEmail(req.body.email, req.body.fname);

        res.status(200).send({
          message: "Email sent, check your mail.",
          user: user,
        });
      }
    } else {
      //VA REGISTER
      const fileName = req.file.filename;
      if (googleSignStatus) {
        try {
          user = await new UserModel({
            ...req.body,
            pdfFile: fileName,
            verified: true,
            role: roleStatus,
          }).save();

          const userData = await sdk.candidates_create({
            external_id: user._id,
            full_name: user.fname + " " + user.lname,
            source_type: "applied",
            consent: true,
            email: user.email,
            phone_number: user.mobileNumber,
          });

          console.log(userData.data.id);

          await UserModel.findByIdAndUpdate(user._id, {
            manatalID: userData.data.id,
          });

          const resumelink = await sdk.candidates_resume_create({
            candidate_pk: userData.data.id,
            resume_file: `https://server.beehubvas.com/resumes/${fileName}`,
          });

          await UserModel.findByIdAndUpdate(user._id, {
            manatalResume: resumelink.resume_file,
          });
        } catch (error) {
          console.error(error);
        }

        // await welcomeEmail(req.body.email, req.body.fname);

        const token = jwt.sign(
          { email: user.email, role: user.role, userID: user._id },
          process.env.JWT_SECRET,
          {
            expiresIn: "1d",
          }
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000,
        });

        res.status(200).send({
          message: "Email sent, check your mail.",
          user: user,
        });
      } else {
        const encryptedPassword = await bcrypt.hash(password, 10);

        try {
          user = await new UserModel({
            ...req.body,
            role: roleStatus,
            pdfFile: fileName,
            password: encryptedPassword,
          }).save();

          const userData = await sdk.candidates_create({
            external_id: user._id,
            full_name: user.fname + " " + user.lname,
            source_type: "applied",
            consent: true,
            email: user.email,
            phone_number: user.mobileNumber,
          });

          await UserModel.findByIdAndUpdate(user._id, {
            manatalID: userData.data.id,
          });

          const resumelink = await sdk
            .candidates_resume_create({
              candidate_pk: userData.data.id,
              resume_file: `https://server.beehubvas.com/resumes/${user.pdfFile}`,
            })
            .then(({ data }) => console.log(data))
            .catch((err) => console.error(err));

          await UserModel.findByIdAndUpdate(user._id, {
            manatalResume: resumelink.resume_file,
          });
        } catch (error) {
          console.error(error);
        }

        const userVerify = await new VerifyUserModel({
          userId: user._id,
          uniqueString: crypto.randomBytes(32).toString("hex"),
        }).save();
        const urlVerify = `https://beehubvas.com/verify/${user._id}/${userVerify.uniqueString}`;
        await verifyEmail(req.body.email, urlVerify);
        // await welcomeEmail(
        //   req.body.email,
        //   req.body.fname,
        //   req.body.selectedValues,
        //   fileName
        // );

        res.status(200).send({
          message: "Email sent, check your mail.",
          user: user,
        });
      }
    }
  }
});

app.post("/login", async (req, res) => {
  const { email, password, googleSignStatus } = req.body;
  const user = await UserModel.findOne({ email: email });

  if (!user) {
    return res.status(400).send({
      message: `Account doesn't exist!`,
    });
  } else {
    if (googleSignStatus) {
      const token = jwt.sign(
        { email: user.email, role: user.role, userID: user._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000,
      });

      if (res.status(201)) {
        return res.json({
          status: "ok",
          role: user.role,
          userId: user._id,
          userfname: user.fname,
          userlname: user.lname,
          token: token,
        });
      } else {
        return res.json({ status: "error" });
      }
    } else {
      const googleAcount = await UserModel.findOne({
        email: email,
        googleVerified: true,
      });
      if (googleAcount) {
        return res.status(400).send({
          message: `The account was created using Google. Please login using Google Sign-In`,
        });
      } else {
        if (await bcrypt.compare(password, user.password)) {
          if (!user.verified) {
            const token = await VerifyUserModel.findOne({ userId: user._id });
            if (!token) {
              const userVerify = await new VerifyUserModel({
                userId: user._id,
                uniqueString: crypto.randomBytes(32).toString("hex"),
              }).save();
              const urlVerify = `https://beehubvas.com/verify/${user._id}/${userVerify.uniqueString}`;
              await verifyEmail(req.body.email, urlVerify);
            }

            return res.status(400).send({
              message: `An verification link was sent to ${req.body.email}. Please verify your account.`,
            });
          } else {
            const token = jwt.sign(
              { email: user.email, role: user.role, userID: user._id },
              process.env.JWT_SECRET,
              {
                expiresIn: "1d",
              }
            );

            res.cookie("token", token, {
              httpOnly: true,
              secure: true,
              sameSite: "None",
              maxAge: 24 * 60 * 60 * 1000,
            });

            if (res.status(201)) {
              return res.json({
                status: "ok",
                role: user.role,
                userId: user._id,
                userfname: user.fname,
                userlname: user.lname,
                token: token,
              });
            } else {
              return res.json({ status: "error" });
            }
          }
        }
      }
    }
  }

  return res.status(400).send({
    message: `Invalid Password!`,
  });
});

app.post("/logout", async (req, res, next) => {
  res.clearCookie("token", {
    domain: "https://beehubvas.com",
    path: "/", // Path should match the original cookie setting
    secure: true, // Set to true if the cookie was set with the secure flag
    httpOnly: true,
    sameSite: "none", // Set to 'None' if the cookie was set with SameSite=None
  });

  res.clearCookie("token");

  res.send("Token cookie deleted");
});

app.post("/getEmail", async (req, res) => {
  let user = await UserModel.findOne({ email: req.body.email });
  if (user) {
    const userVerify = await new VerifyUserModel({
      userId: user._id,
      uniqueString: crypto.randomBytes(32).toString("hex"),
    }).save();
    const urlVerify = `https://beehubvas.com/reset/${user._id}/${userVerify.uniqueString}`;
    await resetPassword(req.body.email, urlVerify);
  } else {
    res.status(400).send({
      message: "Email is not registered or it doesn't exist.",
    });
  }
});

app.post("/resetPassword", upload.single("pdfFile"), async (req, res) => {
  const newPassword = req.body.password;
  const encryptedPassword = await bcrypt.hash(newPassword, 10);
  const userID = req.body.userID;
  try {
    await UserModel.updateOne({ _id: userID }, { password: encryptedPassword });
  } catch (error) {
    res
      .status(200)
      .send({ message: "Change password unsuccessful. Please try again." });
  }
});

app.post("/contactMessage", async (req, res) => {
  const email = req.body.email;
  const message = req.body.message;
  const subject = req.body.subject;
  const id = req.body.id;

  await contactEmail(email, subject, message);
  await UserModel.updateOne({ _id: id }, { archive: true });
});

app.post("/addjob", upload.none(), async (req, res) => {
  const userBio = req.body.companyOverview;
  const userID = req.body.jobPostedById;
  const skills = req.body.jobSkills.split(",");

  try {
    const user = await UserModel.findById({ _id: userID });
    if (!user) {
      res.status(200).send({ message: "User not found" });
    } else {
      const userPostedBy = user.fname + " " + user.lname;
      await UserModel.updateOne({ _id: userID }, { bio: userBio });
      await new JobBoardModel({
        ...req.body,
        jobPosted: new Date(),
        jobPostedBy: userPostedBy,
        jobPostedById: userID,
        jobSkills: skills,
        jobCompanyOverview: userBio,
      }).save();
    }
  } catch (error) {
    console.log(error);
  }

  res.status(200).send({
    message: "Job added successfully",
  });
});

app.post("/verifyPassword", async (req, res) => {
  const currentPassword = req.body.currentPassword;
  const userID = req.body.userID;

  console.log(currentPassword, userID);

  const user = await UserModel.findById(userID);

  // Compare the passwords
  bcrypt.compare(currentPassword, user.password, function (err, result) {
    if (err) {
      res.status(500).json({ error: "Internal error please try again" });
    } else if (result) {
      res.json(true);
    } else {
      res.json(false);
    }
  });
});

app.post("/hire", upload.none(), async (req, res) => {
  await new EmploymentModel({
    ...req.body,
    dateHired: new Date(),
    employmentStatus: "Active",
  }).save();

  res.json("Success");
});

app.post(
  "/addTraining",
  certificate.single("certificate"),
  async (req, res) => {
    const fileName = req.file ? req.file.filename : "";
    try {
      await new TrainingModel({
        ...req.body,
        certificate: fileName,
      }).save();
      res.json("Success");
    } catch (error) {
      res.json(error.toString());
    }
  }
);

app.post(
  "/addCertificate",
  certificate.single("certificate"),
  async (req, res) => {
    const fileName = req.file ? req.file.filename : "";

    try {
      await new CertificateModel({
        ...req.body,
        certificate: fileName,
      }).save();
      res.json("Success");
    } catch (error) {
      res.json(error.toString());
    }
  }
);

//GET
app.get("/verify/:id/:token", async (req, res) => {
  const linkId = req.params.id;
  const userId = await VerifyUserModel.findOne({ userId: linkId });

  if (!userId) {
    res.send({
      message: "Link expired or Invalid token. Please try again by logging in.",
    });
  } else {
    const token = await VerifyUserModel.findOne({
      uniqueString: req.params.token,
    });

    if (!token) {
      console.log("Invalid token");
    } else {
      await UserModel.updateOne(
        { _id: token.userId },
        { $set: { verified: true } }
      );
      await VerifyUserModel.findByIdAndRemove(token._id);
      res.send({ message: "Valid Link" });
    }
  }
});

app.get("/reset/:id/:token", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.send({ message: "nah" });
  } else {
    const userId = await VerifyUserModel.findOne({ userId: req.params.id });
    if (!userId) {
      res.send({ message: "nah" });
    } else {
      const token = await VerifyUserModel.findOne({
        uniqueString: req.params.token,
      });
      res.send({ message: "yeah" });
      if (!token) {
        console.log("Invalid token");
      } else {
        await VerifyUserModel.findByIdAndRemove(token._id);
      }
    }
  }
});

app.get("/va-bh/:username/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.json("Link Broken");
  } else {
    const user = await UserModel.findOne({
      _id: req.params.id,
      role: "virtualassistant",
    });
    if (!user) {
      res.json("Profile doesn't exist");
    } else {
      sdk
        .candidates_list({ external_id: user._id.toString() })
        .then(({ data }) => {
          res.json({ user: user, candidates: data.results[0] });
        })
        .catch((err) => console.error(err));
    }
  }
});

app.get("/job-boards/bh/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.json("Job doesn't exist");
  } else {
    const jobId = await JobBoardModel.findById({ _id: req.params.id });
    if (!jobId) {
      res.json("Job doesn't exist");
    } else {
      res.json(jobId);
    }
  }
});

const verifyLoginUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    const tokenkey = "No token found";
    req.tokenkey = tokenkey;
    next();
  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.json(err);
      } else {
        if (
          decoded.role === "admin" ||
          decoded.role === "client" ||
          decoded.role === "virtualassistant"
        ) {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        } else {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        }
      }
    });
  }
};

app.get("/verifylogin", verifyLoginUser, (req, res) => {
  const user = req.user;
  const tokenVerify = req.tokenkey;
  if (tokenVerify === "No token found") {
    res.json("User not found");
  } else {
    res.json(user);
  }
});

const verifyAdminUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    const tokenkey = "No token found";
    req.tokenkey = tokenkey;
    next();
  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.json("Error with token");
      } else {
        if (decoded.role === "admin") {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        } else {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        }
      }
    });
  }
};

app.get("/admindashboard", verifyAdminUser, (req, res) => {
  const user = req.user;
  const tokenVerify = req.tokenkey;

  if (tokenVerify === "No token found") {
    res.json("User not found");
  } else {
    if (user.role === "admin") {
      res.json(user);
    } else {
      res.json("User not found");
    }
  }
});

const verifyApplyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    const tokenkey = "No token found";
    req.tokenkey = tokenkey;
    next();
  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.json("Error with token");
      } else {
        if (decoded.role === "virtualassistant") {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        } else {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        }
      }
    });
  }
};

app.get("/applyuserdashboard", verifyApplyUser, (req, res) => {
  const user = req.user;
  const tokenVerify = req.tokenkey;

  if (tokenVerify === "No token found") {
    res.json("User not found");
  } else {
    if (user.role === "virtualassistant") {
      sdk
        .candidates_list({ external_id: user._id.toString() })
        .then(({ data }) => {
          res.json({ user: user, candidates: data.results[0] });
        })
        .catch((err) => console.error(err));
    } else {
      res.json("User not found");
    }
  }
});

const verifyJoinUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    const tokenkey = "No token found";
    req.tokenkey = tokenkey;
    next();
  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.json("Error with token");
      } else {
        if (decoded.role === "client") {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        } else {
          const user = await UserModel.findById(decoded.userID);
          req.user = user;
          next();
        }
      }
    });
  }
};

app.get("/joinuserdashboard", verifyJoinUser, (req, res) => {
  const user = req.user;
  const tokenVerify = req.tokenkey;

  if (tokenVerify === "No token found") {
    res.json("User not found");
  } else {
    if (user.role === "client") {
      res.json(user);
    } else {
      res.json("User not found");
    }
  }
});

app.get("/getSpecificUser", async (req, res) => {
  const user = req.query.userID;
  await UserModel.find({ _id: user })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getVAUsers", async (req, res) => {
  const userRole = "virtualassistant";

  await UserModel.find({ role: userRole })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getJoinUsers", async (req, res) => {
  const userRole = "client";

  await UserModel.find({ role: userRole })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getArchiveUsers", async (req, res) => {
  await UserModel.find({ archive: true })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/viewPDF", (req, res) => {
  const pdfFilename = req.query.filename;
  const pdfUrl = `https://server.beehubvas.com/resumes/${pdfFilename}`;
  res.status(200).send({ url: pdfUrl });
});

//JOB BOARDS

app.get("/getAllJobData", async (req, res) => {
  await JobBoardModel.find({
    jobVerified: { $nin: ["Pending", "Closed", "Declined"] },
  })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getHireJobData", async (req, res) => {
  await JobBoardModel.find({ jobVerified: { $nin: ["Closed", "Declined"] } })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getJobData", async (req, res) => {
  await JobBoardModel.find({ jobVerified: "Accepted" })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getClientJobData", async (req, res) => {
  await JobBoardModel.find({ jobPostedById: req.query.userID })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getPendingJobData", async (req, res) => {
  await JobBoardModel.find({ jobVerified: "Pending" })
    .sort({ _id: -1 })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getAppliedJob", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.query.jobID)) {
    res.json("User not found");
  } else {
    const userCheck = await JobBoardModel.find({
      $and: [
        { _id: req.query.jobID },
        { "usersApplied.userID": req.query.userID },
      ],
    });
    if (userCheck.length === 0) {
      res.json("User not found");
    } else {
      res.json("User found");
    }
  }
});

app.get("/getUnverifiedUsers", async (req, res) => {
  await UserModel.find({ role: "virtualassistant", verifiedForJob: false })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getActiveWorkers", async (req, res) => {
  await EmploymentModel.find({ employmentStatus: "Active" })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getJobHistory", async (req, res) => {
  await EmploymentModel.find({ vaID: req.query.userID })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getHiredVA", async (req, res) => {
  await EmploymentModel.find({ clientID: req.query.userID })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getUnhireRequest", async (req, res) => {
  await EmploymentModel.find({
    employmentStatus: "Unhire Requested",
  })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getTraining", async (req, res) => {
  await TrainingModel.find({
    vaID: req.query.userID,
  })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getCertificate", async (req, res) => {
  await CertificateModel.find({
    vaID: req.query.userID,
  })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

//PUT

app.put(
  "/editProfilePicture",
  profilepic.single("profilePicture"),
  async (req, res) => {
    const profilepic = req.file ? req.file.filename : "";
    const userId = req.body.userId;

    if (profilepic) {
      const imagefile = await UserModel.findById({ _id: userId });
      const oldProfilePicPath =
        "./files/profilepicture/" + imagefile.profilePicture;

      fs.unlink(oldProfilePicPath, async () => {
        await UserModel.findByIdAndUpdate(
          { _id: userId },
          { profilePicture: profilepic }
        );

        res.json({ valid: true });
      });
    } else {
      await UserModel.findByIdAndUpdate(
        { _id: userId },
        { profilePicture: profilepic }
      );

      res.json({ valid: true });
    }
  }
);

app.put("/accountSettings", upload.single("pdfFile"), async (req, res) => {
  const userID = req.body.userID;
  const fileName = req.file ? req.file.filename : "";
  const password = req.body.password;

  if (password) {
    const encryptedPassword = await bcrypt.hash(password, 10);
    await UserModel.findByIdAndUpdate(
      { _id: userID },
      { ...req.body, password: encryptedPassword }
    );
    res.json({ valid: true });
  } else {
    if (fileName) {
      const pdfFilename = await UserModel.findById({ _id: userID });
      const oldPdfPath = "./files/resumes/" + pdfFilename.pdfFile;

      fs.unlink(oldPdfPath, async () => {
        await UserModel.findByIdAndUpdate(
          { _id: userID },
          { pdfFile: fileName }
        );
      });
    }

    await UserModel.findByIdAndUpdate({ _id: userID }, { ...req.body });
    res.json({ valid: true });
  }
});

app.put("/verifyJobPost", upload.none(), async (req, res) => {
  const jobID = req.body.jobID;
  const skills = req.body.jobSkills.split(",");
  await JobBoardModel.findByIdAndUpdate(
    { _id: jobID },
    {
      ...req.body,
      jobSkills: skills,
      jobPosted: new Date(),
      jobVerified: "Accepted",
    }
  );

  res.json({ message: "Job posted successfully" });
});

app.put("/applyJob", async (req, res) => {
  const jobID = req.body.jobID;
  const userID = req.body.userID;
  const userName = req.body.userName;

  await JobBoardModel.findByIdAndUpdate(jobID, {
    $push: { usersApplied: { userID, userName } },
  });
});

app.put("/declineJob", async (req, res) => {
  const jobID = req.body.jobID;

  await JobBoardModel.findByIdAndUpdate(jobID, { jobVerified: "Declined" });
  res.json("Job declined successfully");
});

app.put("/closeJob", async (req, res) => {
  const jobID = req.body.jobID;

  await JobBoardModel.findByIdAndUpdate(jobID, { jobVerified: "Closed" });
  res.json("Job closed successfully");
});

app.put("/expireJob", async (req, res) => {
  const jobID = req.body.jobID;

  await JobBoardModel.findByIdAndUpdate(jobID, { jobVerified: "Expired" });
  res.json("Job expired successfully");
});

app.put("/verifyUserForJob", async (req, res) => {
  const userID = req.body.userID;

  await UserModel.findByIdAndUpdate(userID, { verifiedForJob: true });
  res.json({ valid: true });
});

app.put("/unhire", async (req, res) => {
  const employmentID = req.body.jobID;

  try {
    await EmploymentModel.findByIdAndUpdate(employmentID, {
      employmentStatus: "Unhire Requested",
    });
    res.json("Request sent");
  } catch (error) {
    res.json("Request failed");
  }
});

app.put("/adminUnhire", async (req, res) => {
  const employmentID = req.body.id;
  const action = req.body.action;

  try {
    if (action === "Active") {
      await EmploymentModel.findByIdAndUpdate(employmentID, {
        employmentStatus: action,
      });
    } else {
      await EmploymentModel.findByIdAndUpdate(employmentID, {
        employmentStatus: action,
        dateEnded: new Date(),
      });
    }
    res.json({ valid: true });
  } catch (error) {
    res.json("Request failed");
  }
});

//DELETE
app.delete("/deleteCertificate", async (req, res) => {
  const certificateID = req.body.id;
  const certificateFile = req.body.file;
  try {
    const filePath = "./files/certificates/" + certificateFile;
    fs.unlink(filePath, async () => {
      await CertificateModel.findByIdAndRemove(certificateID);
    });
    res.json("Success");
  } catch (error) {
    res.json(error.toString());
  }
});

//DEADLINE SCHEDULER
cron.schedule("0 * * * *", async () => {
  console.log("your time has come");
  const now = new Date();
  const expiredJobs = await JobBoardModel.find({
    jobDeadline: { $lt: now },
    jobVerified: { $ne: "Expired" },
  });

  expiredJobs.forEach(async (job) => {
    if (new Date(job.jobDeadline) < now) {
      await JobBoardModel.findByIdAndUpdate(job._id, {
        jobVerified: "Expired",
      });
    }
  });
});
