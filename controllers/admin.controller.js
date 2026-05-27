const Customer = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const jwtSecret = process.env.JWT_SECRET;
dotenv.config();

const postAdminSignin = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required",
        });
    }

    Customer.findOne({ email }).then((foundAdmin) => {
        if (!foundAdmin) {
            return res.status(404).json({
                success: false,
                message: "Admin account not found",
            });
        }
        if (foundAdmin.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied: Not an admin",
            });
        }

        const isMatch = bcrypt.compareSync(password, foundAdmin.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: foundAdmin._id,
                email: foundAdmin.email,
                role: foundAdmin.role,
            },
            jwtSecret,
            { expiresIn: "2h" },
        );
        return res.json({
            success: true,
            message: "Admin login successful",
            token,
            admin: {
                id: foundAdmin._id,
                firstName: foundAdmin.firstName,
                lastName: foundAdmin.lastName,
                email: foundAdmin.email,
                role: foundAdmin.role,
            },
        });
    });
};

const getAdminDashboard = (req, res) => {
    const adminId = req.user.id;

    Customer.findOne({ _id: adminId, role: "admin" })
        .then((admin) => {
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            res.json({
                message: "Admin dashboard accessed successfully",
                admin: {
                    _id: admin._id,
                    email: admin.email,
                    firstName: admin.firstName,
                    lastName: admin.lastName,
                    role: admin.role,
                },
            });
        })
        .catch((err) => {
            console.error("Error fetching admin:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

module.exports = {
    postAdminSignin,
    getAdminDashboard,
};