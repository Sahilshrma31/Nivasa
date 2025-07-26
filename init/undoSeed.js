require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

console.log("🔌 Connecting to:", process.env.ATLASDB_URL); // 👈 add this

mongoose.connect(process.env.ATLASDB_URL)
  .then(async () => {
    const result = await Listing.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} listings.`);
    process.exit();
  })
  .catch((err) => {
    console.error("❌ DB error", err);
    process.exit(1);
  });
