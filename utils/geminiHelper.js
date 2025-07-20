const axios = require("axios");
require('dotenv').config({ path: '../../.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper function to extract key features from the listing title
const extractFeatures = (title) => {
  const features = [];
  const featureMap = {
    // Keywords -> Feature to highlight
    'pool': 'a private pool',
    'view': 'scenic views',
    'mountain': 'mountain surroundings',
    'beach': 'beach access',
    'seafront': 'seafront location',
    'luxury': 'luxurious amenities',
    'premium': 'premium quality',
    'villa': 'spacious villa living',
    'penthouse': 'an exclusive penthouse setting',
    '2bhk': 'a spacious two-bedroom layout',
    '3bhk': 'an expansive three-bedroom layout',
    'studio': 'a compact and modern studio design',
    'cozy': 'a cozy and intimate atmosphere',
    'heritage': 'historic character',
    'cottage': 'charming cottage style',
    'garden': 'a private garden space',
    'rooftop': 'a rooftop terrace',
    'modern': 'modern design and architecture'
  };

  const lowerCaseTitle = title.toLowerCase();
  for (const keyword in featureMap) {
    if (lowerCaseTitle.includes(keyword)) {
      features.push(featureMap[keyword]);
    }
  }
  return features;
};

// ✅ Truly Smart & Dynamic Rental Description Generator
const generateSmartDescription = async (title, location, price) => {
  // 1. Extract features to make the prompt more specific
  const features = extractFeatures(title);

  // 2. Create a much more detailed and directive prompt
  const prompt = `
    You are an expert real estate copywriter. Your task is to generate a compelling, unique, and creative 2-3 sentence rental description.

    **Property Details:**
    - Name: "${title}"
    - City: ${location}
    - Cost: ₹${price}

    **Key Features to Highlight (based on the name):**
    - ${features.length > 0 ? features.join(', ') : 'The unique character and atmosphere of the place.'}

    **Instructions:**
    - Write in a sophisticated and evocative style.
    - Weave the key features naturally into the description of the property and its location.
    - Start writing the description immediately without any introduction.
    - **CRITICAL:** Do NOT use these common and boring words: discover, enjoy, stay, ideal, perfect, welcome, experience, escape, getaway, stunning, beautiful, lovely, charming, cozy, amazing, great.
  `;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9, // Slightly reduced for more focused creativity
          topP: 0.85,
          maxOutputTokens: 120
        }
      }
    );

    let content = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // 3. Validate the response. If it's too short or empty, it's a failed generation.
    if (!content || content.length < 40) {
        console.warn("Initial generation was weak. Attempting a fallback generation.");
        // Throw an error to trigger the catch block for a retry with a simpler prompt
        throw new Error("Generated content is too short or empty.");
    }

    return content;

  } catch (err) {
    console.error("Smart description generation error:", err.message);
    
    // 4. Fallback Strategy: Try ONE more time with a simpler, safer prompt
    console.log("Executing fallback generation strategy...");
    const fallbackPrompt = `
      Create a compelling and unique 2-sentence rental description for "${title}" in ${location}.
      Focus on the feeling of being in the city and the essence of the property.
      Avoid generic marketing words. Start writing immediately.
    `;
    
    try {
        const fallbackResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: fallbackPrompt }] }],
            generationConfig: { temperature: 1.0, maxOutputTokens: 120 }
          }
        );
        let fallbackContent = fallbackResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (fallbackContent && fallbackContent.length > 20) {
            return fallbackContent;
        } else {
            // Final resort if the second attempt also fails
            return `${title} in ${location} presents a distinct opportunity for your time in the city. Its position offers a direct connection to the local rhythm and culture.`;
        }
    } catch (finalErr) {
        console.error("Final fallback generation failed:", finalErr.message);
        // Absolute final resort if the API is down
        return `${title} in ${location} presents a distinct opportunity for your time in the city. Its position offers a direct connection to the local rhythm and culture.`;
    }
  }
};

module.exports = {
  generateSmartDescription,
};