const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateSmartDescription(title, location, price) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env file");
    return "API key missing. Please check your .env file.";
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const prompt = `
Describe a real estate listing called "${title}" in ${location}, India,
priced at ₹${price}. Use vivid, poetic language.
Keep it 70–80 words. Avoid repetition.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("❌ Gemini SDK Error:", error);
    return "Failed to generate description.";
  }
}

module.exports = { generateSmartDescription };
