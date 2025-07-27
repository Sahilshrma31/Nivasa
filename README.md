# Nivasa 🏠

> A modern, full-stack rental platform built with Node.js, Express, and MongoDB

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://nivasa-fevd.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/sahilshrma31/nivasa)

## 🌟 Overview

Nivasa is a comprehensive rental platform that enables users to discover, book, and manage rental properties with ease. Built with modern web technologies, it offers a seamless experience for both property owners and renters with features like real-time payments, interactive maps, and AI-powered content generation.

## ✨ Key Features

### 🔐 User Management
- Secure user authentication and authorization
- Role-based access control (Property owners, Renters, Admins)
- User profile management and settings
- Comprehensive booking history

### 🏡 Property Management
- Dynamic property listings with detailed information
- Image upload and gallery management
- Advanced search and filtering capabilities
- Location-based property discovery
- AI-powered listing descriptions

### 💳 Payment Integration
- **Razorpay Integration**: Secure payment processing with real-time simulation
- Secure payment flow with comprehensive error handling
- Used environment variables to securely manage API keys

### 🗺️ Location Services
- **Mapbox Integration**: Interactive maps for property locations
- Geocoding API for converting addresses to coordinates
- Location-aware search functionality
- Interactive property markers and clustering

### 📱 User Experience
- Fully responsive design across all devices
- Dark mode support for enhanced user experience
- Modern EJS templates with clean UI/UX
- Real-time notifications and feedback

### 🤖 AI Features
- AI-powered description generator for property listings
- Intelligent content creation from user-provided data
- Enhanced listing quality and engagement

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling

### Frontend
- **EJS** - Templating engine
- **HTML5/CSS3** - Markup and styling
- **JavaScript** - Client-side functionality
- **Bootstrap/Custom CSS** - Responsive design

### Integrations
- **Razorpay** - Payment gateway
- **Mapbox** - Maps and geocoding
- **AI Services** - Content generation
- **Cloudinary/Multer** - Image handling

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Razorpay account for payment integration
- Mapbox account for map services

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nivasa.git
   cd nivasa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/nivasa
   SESSION_SECRET=your-session-secret
   
   # Razorpay Configuration
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   
   # Mapbox Configuration
   MAPBOX_ACCESS_TOKEN=your-mapbox-access-token
   
   # AI Service Configuration
   AI_API_KEY=your-ai-service-key
   
   # Cloudinary (if using)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB service
   mongod
   
   # Run database migrations (if any)
   npm run migrate
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:8080`

## 📁 Project Structure

```
nivasa/
├── controllers/          # Route controllers
├── models/              # Database models
├── routes/              # Express routes
├── views/               # EJS templates
├── public/              # Static assets
│   ├── css/            # Stylesheets
│   ├── js/             # Client-side JavaScript
│   └── images/         # Static images
├── middleware/          # Custom middleware
├── config/             # Configuration files
├── utils/              # Utility functions
├── uploads/            # File uploads
└── app.js              # Main application file
```

## 🎯 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Properties
- `GET /properties` - Get all properties
- `GET /properties/:id` - Get property details
- `POST /properties` - Create new property
- `PUT /properties/:id` - Update property
- `DELETE /properties/:id` - Delete property

### Bookings
- `POST /bookings` - Create booking
- `GET /bookings/user` - Get user bookings
- `PUT /bookings/:id` - Update booking status

### Payments
- `POST /payments/create-order` - Create Razorpay order
- `POST /payments/verify` - Verify payment

## 🔧 Configuration

### Payment Setup (Razorpay)
1. Create a Razorpay account
2. Get your Key ID and Key Secret
3. Add them to your environment variables
4. Configure webhooks for payment status updates

### Map Integration (Mapbox)
1. Create a Mapbox account
2. Generate an access token
3. Add the token to your environment variables
4. Configure map styles and clustering options

## 🚀 Deployment
The project is deployed on Render for easy and reliable hosting.
It automatically builds and redeploys from the GitHub repo on every push.

Backend: Node.js server hosted on Render

Database: MongoDB Atlas

Payments: Razorpay integrated using environment variables

Live Demo: https://nivasa.onrender.com



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request



## 👥 Author

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/sahilshrma31)

## 🙏 Acknowledgments

- Razorpay for payment processing
- Mapbox for mapping services
- MongoDB for database solutions
- Express.js community for the excellent framework

## 📞 Support

For support, email sahil.sharma3184@gmail.com

---

⭐ **Star this repository if you found it helpful!** ⭐
