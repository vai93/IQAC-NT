const { db } = require("../firebase-admin-setup");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";
module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const MIScode = req.body.MIScode?.trim(); // Faculty MIS code
    const email = req.body.email?.trim(); // Gmail from frontend

    if (!MIScode || !email) {
        return res.status(400).json({ message: "MIS ID and email are required." });
    }
    if (!email.endsWith("@paruluniversity.ac.in")) {
    return res.status(403).json({ message: "Only institute email IDs are allowed." });
}
    try {
        // Check if faculty exists in PITFacultyDatabase
        const userDoc = await db.collection("PITFacultyDatabase").doc(MIScode).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                message: "No faculty record found. If you are a new faculty member, please register yourself."
            });
        }

        const userData = userDoc.data();

        if (userData.InstituteEmailId?.trim().toLowerCase() ===
  email?.trim().toLowerCase()) {
    const token = jwt.sign(
                {
                    MIScode: userData.MIScode,
                    FullName: userData.FullName,
                    Dept: userData.Dept,
                    Roles: userData.Roles
                },
                JWT_SECRET,
                { expiresIn: "2h" } // Token expiry
            );
            return res.status(200).json({
                message: "Login successful!",
                MIScode: userData.MIScode,
                FullName: userData.FullName,
                Dept: userData.Dept,
                Roles: userData.Roles,
                token
            });
        }

        return res.status(401).json({ message: "Email does not match our records." });

    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).json({
            message: "Error logging in",
            error: error.message
        });
    }
};
