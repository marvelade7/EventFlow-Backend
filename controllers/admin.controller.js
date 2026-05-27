const Customer = require("../models/user.model");
const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const Payment = require("../models/payment.model");
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

const getAdminStats = (req, res) => {
    const totalUsers = Customer.countDocuments({ role: "user" });
    const totalEvents = Event.countDocuments();
    const totalBookings = Booking.countDocuments();
    const totalPayments = Payment.countDocuments();
    const totalRevenue = Payment.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const upcomingEvents = Event.find({ date: { $gte: new Date() } })
        .sort({ date: 1 })
        .limit(5);
    const recentBookings = Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "firstName lastName email")
        .populate("event", "name date");

    Promise.all([
        totalUsers,
        totalEvents,
        totalBookings,
        totalRevenue,
        upcomingEvents,
        totalPayments,
        recentBookings,
    ])
        .then(
            ([
                usersCount,
                eventsCount,
                bookingsCount,
                revenueResult,
                upcomingEventsList,
                paymentsCount,
                recentBookingsList,
            ]) => {
                res.json({
                    totalUsers: usersCount,
                    totalEvents: eventsCount,
                    totalBookings: bookingsCount,
                    totalRevenue: revenueResult[0] ? revenueResult[0].total : 0,
                    upcomingEvents: upcomingEventsList,
                    totalPayments: paymentsCount,
                    recentBookings: recentBookingsList,
                });
            },
        )
        .catch((err) => {
            console.error("Error fetching admin stats:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

const getAllEvent = (req, res) => {
    const adminId = req.user.id;

    Customer.findOne({ _id: adminId, role: "admin" })
        .then((admin) => {
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            Event.find()
                .then((events) => {
                    res.json({
                        message: "Events fetched successfully",
                        events,
                    });
                })
                .catch((err) => {
                    console.error("Error fetching events:", err);
                    res.status(500).json({ message: "Internal server error" });
                });
        })
        .catch((err) => {
            console.error("Error fetching admin:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

const getAllUsers = (req, res) => {
    const adminId = req.user.id;
    Customer.findOne({ _id: adminId, role: "admin" })
        .then((admin) => {
            if (!admin) {
                return res.status(404).json({ message: "Admin not found" });
            }

            Customer.find({ role: "user" })
                .then((users) => {
                    res.json({
                        message: "Users fetched successfully",
                        users: users.map((user) => ({
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                            profilePic: user.profilePic,
                            phoneNumber: user.phoneNumber,
                            bio: user.bio,
                            location: user.location,
                            isVerified: user.isVerified,
                        })),
                    });
                })
                .catch((err) => {
                    console.error("Error fetching users:", err);
                    res.status(500).json({ message: "Internal server error" });
                });
        })
        .catch((err) => {
            console.error("Error fetching admin:", err);
            res.status(500).json({ message: "Internal server error" });
        });
};

// const deleteUser = (req, res) => {
//     const adminId = req.user.id;
//     if (!adminId) {
//         return res.status(401).json({ message: "Unauthorized" });
//     }
//     const userId = req.params.userId;

//     Customer.findByIdAndDelete(userId)
//         .then((deletedUser) => {
//             if (!deletedUser) {
//                 return res.status(404).json({ message: "User not found" });
//             }
//             res.json({ message: "User deleted successfully" });
//         })
//         .catch((err) => {
//             console.error("Error deleting user:", err);
//             res.status(500).json({ message: "Internal server error" });
//         });
// };

// const deleteEvent = (req, res) => {
//     const adminId = req.user.id;
//     if (!adminId) {
//         return res.status(401).json({ message: "Unauthorized" });
//     }
//     const eventId = req.params.eventId;

//     Event.findByIdAndDelete(eventId)
//         .then((deletedEvent) => {
//             if (!deletedEvent) {
//                 return res.status(404).json({ message: "Event not found" });
//             }
//             res.json({ message: "Event deleted successfully" });
//         })
//         .catch((err) => {
//             console.error("Error deleting event:", err);
//             res.status(500).json({ message: "Internal server error" });
//         });
// };

module.exports = {
    postAdminSignin,
    getAdminDashboard,
    getAdminStats,
    getAllEvent,
    getAllUsers,
    // deleteEvent,
    // deleteUser,
};
