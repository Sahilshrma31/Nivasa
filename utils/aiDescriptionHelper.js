const axios = require("axios");
require('dotenv').config({ path: '../../.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Elements for Creative Randomization (from the second script) ---

const styleVariations = [
    "a poetic storyteller who paints vivid scenes with words",
    "a luxury travel magazine editor using sophisticated language",
    "a local friend recommending their favorite hidden gem with warmth",
    "an adventurous travel blogger capturing an authentic, raw experience",
    "a romantic novelist describing an enchanting, memorable setting",
    "a cultural enthusiast highlighting the true essence and heritage of the location",
    "a minimalist writer focusing on peace, tranquility, and sensory details"
];

const moodWords = [
    "mystical", "vibrant", "serene", "enchanting", "rustic", "elegant",
    "secluded", "bustling", "tranquil", "authentic", "luxurious",
    "dramatic", "peaceful", "dynamic", "intimate", "majestic"
];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// --- Intelligent Feature Extraction (from the first script) ---

const extractFeatures = (title) => {
    const features = [];
    const featureMap = {
        'pool': 'a private pool',
        'view': 'scenic views',
        'mountain': 'mountain surroundings',
        'beach': 'beach access',
        'seafront': 'a location right on the sea',
        'luxury': 'luxurious amenities',
        'villa': 'spacious villa living',
        'penthouse': 'an exclusive penthouse',
        'bhk': 'a spacious layout',
        'studio': 'a compact, modern design',
        'heritage': 'historic character and architecture',
        'cottage': 'charming cottage style',
        'garden': 'a private garden',
        'rooftop': 'a rooftop terrace'
    };

    const lowerCaseTitle = title.toLowerCase();
    for (const keyword in featureMap) {
        if (lowerCaseTitle.includes(keyword)) {
            features.push(featureMap[keyword]);
        }
    }
    return features;
};


// --- The Merged, Ultimate Description Generator ---

async function generateSmartDescription(title, location, price) {
    // 1. Get dynamic elements for the prompt
    const features = extractFeatures(title);
    const randomStyle = getRandomElement(styleVariations);
    const randomMood = getRandomElement(moodWords);

    // 2. Build the master prompt by combining intelligence and creativity
    const prompt = `
    As ${randomStyle}, create a unique 2-3 sentence rental description.

    **Property Details:**
    - Name: "${title}"
    - Location: ${location}
    - Price: ₹${price}

    **Creative Direction:**
    - Highlight these features derived from the title: ${features.length > 0 ? features.join(', ') : 'the property\'s unique character'}.
    - The overall mood and feeling should be: ${randomMood}.
    - Weave a mini-story or a vivid scene, not just a list of amenities.

    **Critical Rules:**
    🚫 Absolutely no overused words: discover, enjoy, stay, ideal, perfect, welcome, experience, escape, getaway, stunning, beautiful, lovely, charming, cozy, amazing, great, "heart of", "steps away".
    🚫 Start the description directly and creatively. Do not use generic openings.
    
    Write ONLY the description. Nothing else.
    `;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 1.0, // Max creativity for varied styles
                    topP: 0.9,
                    maxOutputTokens: 150
                }
            }
        );

        let content = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        // 3. Validate the response. If it's weak, trigger the fallback generation.
        if (!content || content.length < 40) {
            console.warn("Primary generation was weak. Triggering dynamic fallback.");
            throw new Error("Generated content is too short or empty.");
        }

        return content;

    } catch (err) {
        console.error("Smart description generation error:", err.message);
        
        // 4. Robust Fallback: Try again with a simpler, safer dynamic prompt
        console.log("Executing dynamic fallback generation...");
        const fallbackPrompt = `
          Create a compelling, unique 2-sentence rental description for "${title}" in ${location}.
          Focus on an authentic feeling of the place, using fresh language.
          Avoid all marketing clichés. Start writing immediately.
        `;
        
        try {
            const fallbackResponse = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
              {
                contents: [{ parts: [{ text: fallbackPrompt }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 120 }
              }
            );
            let fallbackContent = fallbackResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (fallbackContent && fallbackContent.length > 20) {
                return fallbackContent;
            } else {
                // Absolute final resort if the second attempt also fails
                throw new Error("Fallback generation also failed.");
            }
        } catch (finalErr) {
            console.error("Final fallback generation failed:", finalErr.message);
            // This is the emergency brake - still dynamic, no static text.
            return `${title} in ${location} presents a distinct opportunity for your time in the city. Its position offers a direct connection to the local rhythm and culture.`;
        }
    }
}

module.exports = { generateSmartDescription };

