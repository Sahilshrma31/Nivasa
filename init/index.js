//  Force dotenv to load from the root .env file
require("dotenv").config({ path: "../.env" });

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

//  Use the MAP_TOKEN from .env
const geocodingClient = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });


const MONGO_URL = "mongodb://127.0.0.1:27017/Nivasa";

main()
  .then(() => {
    console.log(" Connected to DB");
  })
  .catch((err) => {
    console.log(" DB Connection Error", err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});

  for (let obj of initData.data) {
    const geoData = await geocodingClient
      .forwardGeocode({
        query: obj.location,
        limit: 1,
      })
      .send();

    const newListing = new Listing({
      ...obj,
      owner: "687abc680867c8c53f33b630", // your ObjectId as string
      geometry: geoData.body.features[0].geometry, // <-- add this line
    });

    await newListing.save(); // save one by one to support geometry
  }

  console.log("All data seeded with geometry");
};

initDB();
