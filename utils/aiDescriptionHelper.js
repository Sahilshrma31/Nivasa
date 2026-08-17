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

  // Gemini returns 503 when the model is momentarily oversubscribed. That is
  // not a real failure — the same request usually succeeds a second later —
  // so retry it a couple of times before giving up. 429 (quota) is NOT
  // retried: that one means stop asking.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
    });

    let result;
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (err) {
        const overloaded = err.status === 503 || err.status === 500;
        if (!overloaded || attempt === MAX_ATTEMPTS) throw err;

        // Back off a little further each time: 0.8s, then 1.6s.
        const wait = 800 * attempt;
        console.warn(
          `Gemini busy (${err.status}), retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`
        );
        await sleep(wait);
      }
    }

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

    //  MODEL OVERLOADED — survived all retries
    if (error.status === 503 || error.status === 500) {
      return {
        success: false,
        reason: "MODEL_BUSY",
        message: "The AI is busy right now. Try again in a few seconds."
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
