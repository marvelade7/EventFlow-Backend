const customer = require("../models/user.model");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

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
            return res.json({
                message: "Login successful",
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

module.exports = { postSignup, postSignin };
