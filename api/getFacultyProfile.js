const { db } = require("../firebase-admin-setup");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // adjust for your domain in production
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const misId = url.searchParams.get("misId");

    if (!misId) {
      return res.status(400).json({ message: "misId query parameter is required" });
    }

    const docRef = db.collection("facultyDatabase").doc(misId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Faculty record not found" });
    }

    const data = docSnap.data();

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching faculty profile:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
