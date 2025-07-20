// File: verify_gemini.js
// Purpose: A simple, isolated test to check if the Gemini API key is working.

const axios = require('axios');
require('dotenv').config({ path: '../../.env' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('--- Gemini API Connection Test ---');

// 1. Check if the API key was loaded from the .env file
if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 20) {
  console.error('\n[FATAL_ERROR] ❌ API Key not found or is too short in .env file.');
  console.log('Please ensure your .env file exists in the same folder and contains: GEMINI_API_KEY="YourActualKey"');
  process.exit(1); // Stop the script
}

console.log('[INFO] ✅ API Key loaded successfully.');

// 2. The simplest possible function to call the Gemini API
async function testConnection() {
  console.log('[INFO] Attempting to contact Google Gemini API...');

  try {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: "Write a one-sentence, friendly greeting." }] }],
        }
      );

    // If we get here, the key is working!
    console.log('\n[SUCCESS] ✅ The API call was successful!');
    console.log('Gemini responded:', response.data.candidates[0].content.parts[0].text.trim());
    console.log('\nThis confirms your API key and connection are working correctly. The issue might be in how you are calling the main function in your other file.');

  } catch (error) {
    // If we get here, the key or connection is broken.
    console.error('\n[FATAL_ERROR] ❌ The API call failed.');
    console.error('This is the most likely source of your problem.');

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('--------------------');
      console.error(`Status Code: ${error.response.status}`);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
      console.error('--------------------');
      console.log('Common reasons for this error include:\n- An invalid API key.\n- The Gemini API not being enabled in your Google Cloud project.\n- Billing not being set up for your project.');
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error: No response received from the server. Check your internet connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request Setup Error:', error.message);
    }
  }
}

// 3. Run the test
testConnection();