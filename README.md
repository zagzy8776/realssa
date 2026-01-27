# EntertainmentGHC - African Entertainment News Portal

## 🎬 Project Overview

**EntertainmentGHC** is a comprehensive entertainment news portal focused on African entertainment, including Afrobeats, Nollywood, culture, fashion, and technology.

## 🚀 Features

### Public Features
- ✅ Latest entertainment news from Ghana and Nigeria
- ✅ Category-based browsing (Afrobeats, Nollywood, Culture, Fashion, Tech, Music)
- ✅ Responsive design for all devices
- ✅ Article reading and sharing
- ✅ Library section with special content

### Admin Features
- ✅ Secure admin login system
- ✅ Complete article management dashboard
- ✅ Create, edit, and delete articles
- ✅ Static article editing capability
- ✅ Search and filtering functionality
- ✅ Statistics and analytics

## 🛠️ Technologies Used

- **Frontend**: React, TypeScript, Vite
- **UI Framework**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Context & localStorage
- **Routing**: React Router
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/            # Page components
├── data/             # Static data and interfaces
├── assets/           # Images and media
├── lib/              # Utility functions
└── styles/           # CSS and styling
```

## 💻 Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/zagzy8776/EntertainmenGhc.git

# Navigate to project directory
cd EntertainmenGhc

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## 🎯 Admin Access

### Default Credentials
- **Username**: admin
- **Password**: EntertainmentGHC2026!

### Admin Features
1. **Dashboard**: Manage all articles (static + user)
2. **Post News**: Create new articles
3. **Edit Articles**: Modify existing content
4. **Make Editable**: Convert static articles to editable
5. **Delete Articles**: Remove unwanted content

## 🔧 Customization

### Change Admin Credentials
Edit `src/pages/AdminLogin.tsx`:

```typescript
// Update these values
const ADMIN_USERNAME = "YourUsername";
const ADMIN_PASSWORD = "YourSecurePassword";
```

### Update Site Information
Edit `src/components/Header.tsx` and `src/pages/Index.tsx` for site branding.

## 🌐 Deployment

### Recommended Hosting
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **GitHub Pages**: Enable in repository settings

### Environment Variables
Create `.env` file:

```env
VITE_ADMIN_USER=your_username
VITE_ADMIN_PASS=your_password
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 📞 Contact

For questions or support, please contact the project maintainer.

---

**EntertainmentGHC** - Bringing African entertainment to the world! 🎭🎶🎬