Nivasa – Full-Stack Rental Platform

Nivasa is a full-stack rental platform that allows users to explore, list, and book rental properties with integrated payment, geolocation, and AI-powered description generation. Designed with modular architecture and production-grade features to simulate a real-world scalable web application.

Features

User authentication and session management using Passport.js
Property listing creation, editing, and deletion with image uploads
AI-generated listing descriptions using Google Gemini API
Integrated Razorpay payments (test mode) for simulating bookings
Geocoding and interactive map display with Mapbox
Reviews and ratings system for listed properties
Flash messaging for feedback on key actions
Fully responsive EJS templating for cross-device compatibility
Modular MVC structure with middleware-based access control
MongoDB schema validation with Mongoose
Tech Stack

Frontend

HTML5, CSS3, EJS templating engine
Backend

Node.js
Express.js
MongoDB with Mongoose
Passport.js (Authentication)
Razorpay SDK (Payment Gateway)
Google Gemini API (AI Description Generation)
Mapbox (Geolocation + Maps)
Folder Structure

nivasa/
├── models/ → Mongoose schemas
├── routes/ → Express routers
├── controllers/ → Controller logic (MVC)
├── views/ → EJS view templates
├── public/ → Static files (CSS, JS)
├── middleware/ → Auth, error handlers, etc.
├── utils/ → Mapbox and Gemini helpers
├── app.js → Main Express app
└── .env → Environment config

Getting Started

Prerequisites
Node.js and npm
MongoDB (Atlas or local)
Razorpay account (test credentials)
Mapbox API key
Gemini API key from Google AI
Setup Instructions
Clone the repository
git clone https://github.com/sahilshrma31/nivasa.git
cd nivasa
Install dependencies
npm install
Configure environment variables
Create a .env file in the root directory:
MAPBOX_TOKEN=your_mapbox_token
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=your_session_secret
MONGO_URI=your_mongodb_connection_string
Start the development server
npm run dev
Then visit http://localhost:3000 to view the app in action.


Author

Sahil Sharma
GitHub: https://github.com/sahilshrma31


