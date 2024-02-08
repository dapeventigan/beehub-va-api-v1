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
app.use("/resumes", express.static(path.join(__dirname, "resumes")));
app.use(
  "/profilepicture",
  express.static(path.join(__dirname, "profilepicture"))
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

//MULTER
const multer = require("multer");

//resumes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./resumes");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + file.originalname);
  },
});
const upload = multer({ storage: storage });

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
    if (roleStatus === "client") {
      if (googleSignStatus) {
        user = await new UserModel({
          ...req.body,
          verified: true,
          role: roleStatus,
        }).save();

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

        user = await new UserModel({
          ...req.body,
          role: roleStatus,
          password: encryptedPassword,
        }).save();

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
        user = await new UserModel({
          ...req.body,
          pdfFile: fileName,
          verified: true,
          role: roleStatus,
        }).save();

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

        user = await new UserModel({
          ...req.body,
          role: roleStatus,
          pdfFile: fileName,
          password: encryptedPassword,
        }).save();

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
              secure: true, // Set to true if your application is served over HTTPS
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
});

app.get("/profile-bh/:username/:id", async (req, res) => {
  if (req.params.id.length < 24 || 24 < req.params.id.length) {
    res.json("Link Broken");
  } else {
    const userId = await UserModel.findOne({
      _id: req.params.id,
      role: "client",
    });
    if (!userId) {
      res.json("Profile doesn't exist");
    } else {
      res.json(userId);
    }
  }
});

app.get("/va-bh/:username/:id", async (req, res) => {
  if (req.params.id.length < 24 || 24 < req.params.id.length) {
    res.json("Link Broken");
  } else {
    const userId = await UserModel.findOne({
      _id: req.params.id,
      role: "virtualassistant",
    });
    if (!userId) {
      res.json("Profile doesn't exist");
    } else {
      res.json(userId);
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
      res.json(user);
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

app.get("/getApplyUsers", async (req, res) => {
  const userRole = "applyUser";

  await UserModel.find({ role: userRole, archive: false })
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send({ message: error });
    });
});

app.get("/getJoinUsers", async (req, res) => {
  const userRole = "joinUser";

  await UserModel.find({ role: userRole, archive: false })
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

//PUT

//profile picture

const imgStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./profilepicture");
  },
  filename: function (req, file, cb) {
    const uniqueDPname = Date.now();
    cb(null, uniqueDPname + file.originalname);
  },
});

const profilepic = multer({ storage: imgStorage });

app.put(
  "/editProfilePicture",
  profilepic.single("profilePicture"),
  async (req, res) => {
    const profilepic = req.file.filename;
    const userId = req.body.userId;

    const imagefile = await UserModel.findById({ _id: userId });

    if (imagefile && imagefile.profilePicture) {
      const oldProfilePicPath = "./profilepicture/" + imagefile.profilePicture;

      fs.unlink(oldProfilePicPath, async (err) => {
        if (err) {
          console.error("Error deleting file:", err);
          return res.status(500).json({ error: "Error deleting old file" });
        }

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

  if (fileName) {
    const pdfFilename = await UserModel.findById({ _id: userID });
    const oldPdfPath = "./resumes/" + pdfFilename.pdfFile;

    fs.unlink(oldPdfPath, async (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ error: "Error deleting old file" });
      }

      await UserModel.findByIdAndUpdate({ _id: userID }, { pdfFile: fileName });
      res.json({ valid: true });
    });
  }

  await UserModel.findByIdAndUpdate({ _id: userID }, { ...req.body });
  res.json({ valid: true });
});