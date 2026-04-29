const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Check if header exists
    if (!authHeader) {
        return res.status(401).json({
            message: "No token provided",
        });
    }

    // 2. Extract token
    const token = authHeader.split(" ")[1];

    // 3. Verify token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                message: "Invalid token",
            });
        }

        // 4. Attach user to request
        req.user = decoded;

        // 5. Continue to controller
        next();
    });
};

module.exports = authMiddleware;