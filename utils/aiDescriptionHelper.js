require("dotenv").config();
const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateSmartDescription(title, location, price) {
    const prompt = `
    Randomly vary this: Describe a real estate listing called "${title}" in ${location} priced at ₹${price}. 
    Use vivid, poetic language. Keep it 70-80 words. No repetition.
    `;
    

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        params: {
          key: GEMINI_API_KEY,
        },
      }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    // Log the actual Gemini response to terminal
    console.log("Gemini Response:", text);

    return text || "[Gemini Fallback] A beautiful property located in a prime location.";
  } catch (error) {
    console.error(" Gemini API Error:", error.message);
    return "[Gemini Error] A beautiful property located in a prime location.";
  }
}

module.exports = { generateSmartDescription };
