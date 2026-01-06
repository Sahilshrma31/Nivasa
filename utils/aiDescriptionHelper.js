const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateSmartDescription(title, location, country, price) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      reason: "NO_API_KEY",
      message: "AI service is not configured."
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const prompt = `
You are a professional real estate listing writer.

Write a realistic, market-ready property description using ONLY the information provided below.
Do NOT make assumptions beyond the given details.

PROPERTY DETAILS:
- Title: ${title}
- Location: ${location}
- Country: ${country}
- Listing Price: ₹${price}

STRICT RULES:
1. ₹${price} is the PROPERTY LISTING PRICE (what a buyer pays). It is NOT height, elevation, altitude, or rent.
2. The property is located in ${location}, ${country}.
3. Do NOT guess property type, amenities, views, luxury level, or business usage.
4. Use neutral, professional real estate language.
5. Length: 65–75 words.
6. Write in third person.
7. Output ONLY the description text.

Now write the property description:
`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(prompt);
    const description = result.response.text().trim();

    return {
      success: true,
      description: description
        .replace(/^["']|["']$/g, "")
        .replace(/^\*\*.*?\*\*:?\s*/g, "")
        .replace(/^Description:?\s*/i, "")
    };

  } catch (error) {
    console.error("❌ Gemini SDK Error:", error);

    //  QUOTA / RATE LIMIT HANDLING
    if (error.status === 429) {
      return {
        success: false,
        reason: "QUOTA_EXCEEDED",
        message: "Daily AI description limit reached. Please try again later."
      };
    }

    //  OTHER ERRORS
    return {
      success: false,
      reason: "GENERIC_ERROR",
      message: "Failed to generate description. Please try again."
    };
  }
}

module.exports = { generateSmartDescription };
