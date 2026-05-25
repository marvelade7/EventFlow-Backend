const Customer = require("../models/user.model");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const crypto = require("crypto");

const jwtSecret = process.env.JWT_SECRET;

const postSignup = async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, terms } =
            req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        if (!terms) {
            return res.status(400).json({ message: "Accept terms first" });
        }

        const existingUser = await Customer.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exist" });
        }

        let salt = bcrypt.genSaltSync(10);
        let hashedPassword = bcrypt.hashSync(password, salt);

        const newUser = new Customer({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            termsAccepted: terms,
        });

        const savedUser = await newUser.save();

        res.status(201).json({
            message: "Sign up successful",
            user: {
                id: savedUser._id,
                firstName: savedUser.firstName,
                lastName: savedUser.lastName,
                email: savedUser.email,
            },
        });

        // ✅ Move transporter outside setTimeout — no need to recreate it every time
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",  // ✅ Explicit host instead of service: "gmail"
            port: 465,               // ✅ Try 465 first, fallback to 587 if it fails
            secure: true,            // ✅ true for 465, false for 587
            auth: {
                user: process.env.mailUser,
                pass: process.env.mailPass,
            },
        });

        // ✅ Verify connection before sending (check Render logs for errors)
        transporter.verify((error) => {
            if (error) {
                console.log("Mailer connection error:", error);
                return;
            }

            const mailOptions = {
                from: `"EventFlow" <${process.env.mailUser}>`,
                to: [savedUser.email, "marvellousadewuyi72@gmail.com"],
                subject: `Welcome to EventFlow ${savedUser.firstName} 👋`,
                html: `
                    <div style="background-color: #f4f4f4; padding: 0 0 10px; border-radius: 30px 30px 0 0;">
                        <div style="padding-top: 20px; height: 100px; border-radius: 30px 30px 0 0; background: linear-gradient(-45deg, #f89b29 0%, #ff0f7b 100%);">
                            <h1 style="color:white; text-align: center;">Welcome to EventFlow ${savedUser.firstName}</h1>
                        </div>
                        <div style="padding: 30px 0; text-align: center;">
                            <p style="font-size: 18px;"><span style="font-weight: 600;">Congratulations!</span> Your sign-up was successful!</p>
                            <p>Thank you for registering. We are excited to have you on board.</p>
                            <div style="padding: 20px 0;">
                                <hr style="width: 50%;">
                                <p style="margin-bottom: 10px;">Best Regards</p>
                                <p style="color: #f89b29; margin-top: 0;">marvelAde</p>
                            </div>
                        </div>
                    </div>
                `,
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.log("Error sending mail:", err);
                } else {
                    console.log("Email sent:", info.response);
                }
            });
        });

    } catch (err) {
        console.error("Error saving to DB:", err);
        if (res.headersSent) return;
        res.status(500).send("Error: " + err.message);
    }
};

// const postSignup = async (req, res) => {
//     try {
//         const { firstName, lastName, email, password, confirmPassword, terms } =
//             req.body;

//         if (password !== confirmPassword) {
//             return res.status(400).json({ message: "Passwords do not match" });
//         }

//         if (!terms) {
//             return res.status(400).json({ message: "Accept terms first" });
//         }

//         const existingUser = await Customer.findOne({ email });
//         if (existingUser) {
//             return res.status(400).json({ message: "User already exist" });
//         }

//         let salt = bcrypt.genSaltSync(10);
//         let hashedPassword = bcrypt.hashSync(password, salt);

//         const newUser = new Customer({
//             firstName,
//             lastName,
//             email,
//             password: hashedPassword,
//             termsAccepted: terms,
//         });

//         const savedUser = await newUser.save();

//         res.status(201).json({
//             message: "Sign up successful",
//             user: {
//                 id: savedUser._id,
//                 firstName: savedUser.firstName,
//                 lastName: savedUser.lastName,
//                 email: savedUser.email,
//             },
//         });

//         setTimeout(() => {
//             const mailUser = process.env.mailUser;
//             const mailPass = process.env.mailPass;

//             let transporter = nodemailer.createTransport({
//                 service: "gmail",
//                 auth: {
//                     user: mailUser,
//                     pass: mailPass,
//                 },
//             });
//             let mailOptions = {
//                 from: mailUser,
//                 to: [savedUser.email, "marvellousadewuyi72@gmail.com"],
//                 subject: `Welcome to EventFlow ${savedUser.firstName} 👋`,
//                 html: `
//                 <div style="background-color: #f4f4f4; padding: 0 0 10px; border-radius: 30px 30px 0 0  ;">
//                     <div style="padding-top: 20px; height: 100px; border-radius: 30px 30px 0 0 ; background: linear-gradient(-45deg, #f89b29 0%, #ff0f7b 100% );">
//                         <h1 style="color:white; text-align: center;">Welcome to EventFlow ${savedUser.firstName}</h1>
//                     </div>
//                     <div style="padding: 30px 0; text-align: center;">
//                         <p style="font-size: 18px;"><span style="font-weight: 600;">Congratulations!</span> Your sign-up was successful!</p>
//                         <p>Thank you for registering. We are excited to have you on board.</p>
//                         <div style="padding: 20px 0;">
//                             <hr style="width: 50%;">
//                             <p style="margin-bottom: 10px;">Best Regards</p>
//                             <p style="color: #f89b29; margin-top: 0;">marvelAde</p>
//                         </div>
//                     </div>
//                 </div>
//             `,
//             };
//             transporter.sendMail(mailOptions, function (err, info) {
//                 if (err) {
//                     console.log("Error sending mail", err);
//                 } else {
//                     console.log("Email sent", info.response);
//                 }
//             });
//         }, 0);
//     } catch (err) {
//         console.error("Error saving to DB:", err);
//         if (res.headersSent) return;
//         res.status(500).send("Error: " + err.message);
//     }
// };

const postSignin = (req, res) => {
    const { email, password } = req.body;

    Customer.findOne({ email })
        .then((foundUser) => {
            if (!foundUser) {
                return res
                    .status(404)
                    .json({ message: "Invalid email or password" });
            }
            const isMatch = bcrypt.compareSync(password, foundUser.password);
            if (!isMatch) {
                return res
                    .status(400)
                    .json({ message: "invalid email or password" });
            }

            const token = jwt.sign(
                { id: foundUser._id, email: foundUser.email },
                jwtSecret,
                { expiresIn: "1h" },
            );
            return res.json({
                message: "Login successful",
                token,
                user: {
                    id: foundUser._id,
                    firstName: foundUser.firstName,
                    lastName: foundUser.lastName,
                    email: foundUser.email,
                },
            });
        })
        .catch((err) => {
            res.status(500).send({
                message: "Internal server error",
                error: err.message,
            });
        });
};

const getDashboard = (req, res) => {
    // let token = req.headers.authorization.split(" ")[1];

    // if (!token) {
    //     return res.status(401).json({ message: "No token provided" });
    // }

    // jwt.verify(token, jwtSecret, (err, decoded) => {
    //     if (err) {
    //         return res
    //             .status(401)
    //             .json({ message: "Invalid or expired token" });
    //     } else {
    //         console.log("Decoded token data:", decoded);
    //         let userId = decoded.id;

    //         Customer
    //             .findOne({ _id: userId })
    //             .then((user) => {
    //                 if (!user) {
    //                     return res
    //                         .status(404)
    //                         .json({ message: "User not found" });
    //                 }
    //                 console.log("User found", user);
    //                 res.json({
    //                     message: "Dashboard accessed successfully",
    //                     user: {
    //                         email: user.email,
    //                         firstName: user.firstName,
    //                         lastName: user.lastName,
    //                         profilePic: user.profilePic,
    //                         location: user.location,
    //                         phoneNumber: user.phoneNumber,
    //                         bio: user.bio,
    //                         isVerified: user.isVerified,
    //                     },
    //                 });
    //             })
    //             .catch((err) => {
    //                 console.error("Error fetching user:", err);
    //                 res.status(500).json({ message: "Internal server error" });
    //             });
    //     }
    // });

    const userId = req.user.id;

    Customer.findOne({ _id: userId })
        .then((user) => {
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({
                message: "Dashboard accessed successfully",
                user: {
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    profilePic: user.profilePic,
                    location: user.location,
                    phoneNumber: user.phoneNumber,
                    bio: user.bio,
                    isVerified: user.isVerified,
                },
            });
        })
        .catch((err) => {
            console.error("Error fetching user:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

const uploadProfilePicture = (fileBuffer) => {
    return uploadToCloudinary(fileBuffer, "profile_pictures");
};

const updateUser = (req, res) => {
    // const token = req.headers.authorization?.split(" ")[1];

    // if (!token) {
    //     return res.status(401).json({ message: "No token provided" });
    // }

    // jwt.verify(token, jwtSecret, (err, decoded) => {
    //     if (err) {
    //         return res.status(401).json({ message: "Invalid token" });
    //     }

    //     const userId = decoded.id;

    //     const body = req.body || {};
    //     const { firstName, lastName, email, phoneNumber, bio, location } = body;

    //     const updateData = {};

    //     if (firstName) updateData.firstName = firstName;
    //     if (lastName) updateData.lastName = lastName;
    //     if (email) updateData.email = email;
    //     if (phoneNumber) updateData.phoneNumber = phoneNumber;
    //     if (bio) updateData.bio = bio;
    //     if (location) updateData.location = location;

    //     // Check if at least one field is being updated (or file is being uploaded)
    //     if (!req.file && Object.keys(updateData).length === 0) {
    //         return res.status(400).json({
    //             message: "Please provide at least one field to update",
    //         });
    //     }

    //     if (req.file) {
    //         uploadToCloudinary(req.file.buffer)
    //             .then((result) => {
    //                 updateData.profilePic = result.secure_url;

    //                 return Customer.findByIdAndUpdate(userId, updateData, {
    //                     new: true,
    //                 });
    //             })
    //             .then((updatedUser) => {
    //                 if (!updatedUser) {
    //                     if (res.headersSent) return;
    //                     return res
    //                         .status(404)
    //                         .json({ message: "User not found" });
    //                 }
    //                 if (res.headersSent) return;

    //                 res.json({
    //                     message: "Profile updated successfully",
    //                     user: updatedUser,
    //                 });
    //             })
    //             .catch((err) => {
    //                 console.error("Error updating profile with file:", err);
    //                 if (res.headersSent) return;
    //                 res.status(500).json({
    //                     message: "Error updating profile: " + err.message,
    //                 });
    //             });
    //     } else {
    //         Customer.findByIdAndUpdate(userId, updateData, { new: true })
    //             .then((updatedUser) => {
    //                 if (!updatedUser) {
    //                     if (res.headersSent) return;
    //                     return res
    //                         .status(404)
    //                         .json({ message: "User not found" });
    //                 }
    //                 if (res.headersSent) return;
    //                 res.json({
    //                     message: "Profile updated successfully",
    //                     user: updatedUser,
    //                 });
    //             })
    //             .catch((err) => {
    //                 console.error("Error updating profile:", err);
    //                 if (res.headersSent) return;
    //                 res.status(500).json({
    //                     message: "Error updating profile: " + err.message,
    //                 });
    //             });
    //     }
    // });

    const userId = req.user.id;

    const body = req.body || {};
    const { firstName, lastName, email, phoneNumber, bio, location } = body;

    const updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (bio) updateData.bio = bio;
    if (location) updateData.location = location;

    // If nothing is being updated
    if (!req.file && Object.keys(updateData).length === 0) {
        return res.status(400).json({
            message: "Please provide at least one field to update",
        });
    }

    if (req.file) {
        uploadProfilePicture(req.file.buffer)
            .then((result) => {
                updateData.profilePic = result.secure_url;

                return Customer.findByIdAndUpdate(userId, updateData, {
                    new: true,
                });
            })
            .then((updatedUser) => {
                if (!updatedUser) {
                    return res.status(404).json({
                        message: "User not found",
                    });
                }

                res.json({
                    message: "Profile updated successfully",
                    user: updatedUser,
                });
            })
            .catch((err) => {
                res.status(500).json({
                    message: "Error updating profile: " + err.message,
                });
            });
    } else {
        Customer.findByIdAndUpdate(userId, updateData, { new: true })
            .then((updatedUser) => {
                if (!updatedUser) {
                    return res.status(404).json({
                        message: "User not found",
                    });
                }

                res.json({
                    message: "Profile updated successfully",
                    user: updatedUser,
                });
            })
            .catch((err) => {
                res.status(500).json({
                    message: "Error updating profile: " + err.message,
                });
            });
    }
};

const sendOtpEmail = (req, res) => {
    const { email } = req.body;

    Customer.findOne({ email }).then((user) => {
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (
            user.otpResendCount >= 3 &&
            Date.now() - user.otpLastSentAt < 24 * 60 * 60 * 1000
        ) {
            return res.status(429).json({
                message: "Too many attempts. Try again after 24 hours",
            });
        }

        if (user.otpLastSentAt && Date.now() - user.otpLastSentAt < 60 * 1000) {
            return res.status(429).json({
                message: "Wait 60 seconds before requesting another OTP",
            });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user.otpHash = otpHash;
        user.otpExpires = otpExpires;
        user.otpResendCount = (user.otpResendCount || 0) + 1;
        user.otpLastSentAt = Date.now();

        user.save().then(() => {
            const mailUser = process.env.mailUser;
            const mailPass = process.env.mailPass;

            let transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: mailUser,
                    pass: mailPass,
                },
            });
            let mailOptions = {
                from: mailUser,
                to: email,
                subject: "Your OTP Code for Email Verification",
                text: `Your OTP code is ${otp}. It will expire in 10 minutes. If you did not request this, please ignore this email.`,
            };
            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log("Error sending OTP email", err);
                    return res
                        .status(500)
                        .json({ message: "Error sending OTP email" });
                } else {
                    console.log("OTP email sent", info.response);
                    return res.json({
                        message: "OTP sent to email successfully",
                    });
                }
            });
        });
    });
};

const verifyEmail = (req, res) => {
    const { email, otp } = req.body;

    Customer.findOne({ email }).then((user) => {
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "Email already verified" });
        }

        if (!user.otpHash || !user.otpExpires) {
            return res.status(400).json({ message: "No OTP requested" });
        }

        if (Date.now() > user.otpExpires) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

        if (otpHash !== user.otpHash) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        user.isVerified = true;
        user.otpHash = undefined;
        user.otpExpires = undefined;
        user.otpResendCount = 0;
        user.otpLastSentAt = undefined;

        return user.save().then(() => {
            return res.json({ message: "Email verified successfully" });
        });
    });
};

const forgotPassword = (req, res) => {
    const { email } = req.body;
    Customer.findOne({ email }).then((user) => {
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const resetToken = crypto.randomBytes(20).toString("hex");
        const resetTokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        const resetTokenExpires = Date.now() + 60 * 60 * 1000;

        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = resetTokenExpires;

        return user.save().then(() => {
            const mailUser = process.env.mailUser;
            const mailPass = process.env.mailPass;
            const resetLink = `https://marvel-event-flow.vercel.app/reset-password/${resetToken}`;

            let transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: mailUser,
                    pass: mailPass,
                },
            });
            let mailOptions = {
                from: mailUser,
                to: email,
                subject: "Your Password Reset Link",
                text: `Click the link to reset your password: ${resetLink}. This link will expire in 1 hour. If you did not request this, please ignore this email.`,
            };
            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log("Error sending reset password link", err);
                    return res.status(500).json({
                        message: "Error sending reset password link",
                    });
                } else {
                    console.log("Reset password link sent", info.response);
                    return res.json({
                        message: "Reset password link sent successfully",
                    });
                }
            });
        });
    });
};

const resetPassword = (req, res) => {
    const { token, newPassword } = req.body;
    const resetTokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    Customer.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: Date.now() },
    })
        .then((user) => {
            if (!user) {
                return res
                    .status(400)
                    .json({ message: "Invalid or expired token" });
            }

            let salt = bcrypt.genSaltSync(10);
            user.password = bcrypt.hashSync(newPassword, salt);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            return user.save().then(() => {
                return res.json({ message: "Password reset successful" });
            });
        })
        .catch((err) => {
            console.error("Error resetting password:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

module.exports = {
    postSignup,
    postSignin,
    getDashboard,
    updateUser,
    sendOtpEmail,
    verifyEmail,
    forgotPassword,
    resetPassword,
};
