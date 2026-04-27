const customer = require("../models/user.model");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const cloudinary = require("../config/cloudinary");

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

        const existingUser = await customer.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exist" });
        }

        let salt = bcrypt.genSaltSync(10);
        let hashedPassword = bcrypt.hashSync(password, salt);

        const newUser = new customer({
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

        setTimeout(() => {
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
                to: [savedUser.email, "marvellousadewuyi72@gmail.com"],
                subject: `Welcome to EventIQ ${savedUser.firstName} 👋`,
                html: `
                <div style="background-color: #f4f4f4; padding: 0 0 10px; border-radius: 30px 30px 0 0  ;">
                    <div style="padding-top: 20px; height: 100px; border-radius: 30px 30px 0 0 ; background: linear-gradient(-45deg, #f89b29 0%, #ff0f7b 100% );">
                        <h1 style="color:white; text-align: center;">Welcome to EventIQ ${savedUser.firstName}</h1>
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
            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log("Error sending mail", err);
                } else {
                    console.log("Email sent", info.response);
                }
            });
        }, 0);
    } catch (err) {
        console.error("Error saving to DB:", err);
        if (res.headersSent) return;
        res.status(500).send("Error: " + err.message);
    }
};

const postSignin = (req, res) => {
    const { email, password } = req.body;

    customer
        .findOne({ email })
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
    let token = req.headers.authorization.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .json({ message: "Invalid or expired token" });
        } else {
            console.log("Decoded token data:", decoded);
            let userId = decoded.id;

            customer
                .findOne({ _id: userId })
                .then((user) => {
                    if (!user) {
                        return res
                            .status(404)
                            .json({ message: "User not found" });
                    }
                    console.log("User found", user);
                    res.json({
                        message: "Dashboard accessed successfully",
                        user: {
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                        },
                    });
                })
                .catch((err) => {
                    console.error("Error fetching user:", err);
                    res.status(500).json({ message: "Internal server error" });
                });
        }
    });
};

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "avatars" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            },
        );

        stream.end(buffer);
    });
};

const updateUser = (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Invalid token" });
        }

        const userId = decoded.id;

        const { firstName, lastName, email, phoneNumber, bio, location } =
            req.body;

        const updateData = {};

        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (bio) updateData.bio = bio;
        if (location) updateData.location = location;

        if (req.file) {
            uploadToCloudinary(req.file.buffer)
                .then((result) => {
                    updateData.profilePic = result.secure_url;

                    return customer.findByIdAndUpdate(userId, updateData, {
                        new: true,
                    });
                })
                .then((updatedUser) => {
                    if (!updatedUser) {
                        return res
                            .status(404)
                            .json({ message: "User not found" });
                    }

                    res.json({
                        message: "Profile updated successfully",
                        user: updatedUser,
                    });
                })
                .catch((err) => {
                    console.error(err);
                    res.status(500).json({ message: "Server error" });
                });
        } else {
            customer
                .findByIdAndUpdate(userId, updateData, { new: true })
                .then((updatedUser) => {
                    if (!updatedUser) {
                        return res
                            .status(404)
                            .json({ message: "User not found" });
                    }

                    res.json({
                        message: "Profile updated successfully",
                        user: updatedUser,
                    });
                })
                .catch((err) => {
                    console.error(err);
                    res.status(500).json({ message: "Server error" });
                });
        }
    });
};

// const uploadImage = (req, res) => {
//     const file = req.file;

//     if (!file) {
//         return res.status(400).json({ message: "No file uploaded" });
//     }

//     const stream = cloudinary.uploader.upload_stream(
//         { folder: "avatars" },
//         (error, result) => {
//             if (error) {
//                 return res.status(500).json({ message: error.message });
//             }

//             res.json({
//                 url: result.secure_url,
//             });
//         },
//     );

//     stream.end(file.buffer);
// };

module.exports = {
    postSignup,
    postSignin,
    getDashboard,
    updateUser,
};
