# EntertainmentGHC Deployment Guide

## 🚀 Overview
This guide provides instructions for deploying the EntertainmentGHC website. The project uses Vite for building and React with shadcn/ui for the frontend.

---

## 🛠️ Prerequisites
Before deploying, ensure you have:
- Node.js (v18 or later)
- npm or yarn
- Git (for cloning the repository)

---

## 📦 Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/zagzy8776/realssa.git
cd realssa
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
This will start a development server, typically at `http://localhost:5173`

---

## 🏗️ Production Build

### 1. Create Optimized Build
```bash
npm run build
```
This command:
- Creates a production-ready build in the `dist` folder
- Optimizes the code for performance
- Minifies assets

### 2. Build Output
After running the build command, you'll find the production-ready files in:
```
dist/
├── assets/
├── index.html
└── ...other generated files
```

**Note:** The `dist` folder is ignored by Git (via `.gitignore`), so you don't need to commit it.

---

## 🌐 GitHub Pages Deployment

### 1. Push Your Code
```bash
git add .
git commit -m "Update application"
git push origin main
```

### 2. Configure GitHub Pages
1. Go to your repository on GitHub
2. Click on **Settings** > **Pages**
3. Under **Source**, select:
   - **Branch:** `main` (or your default branch)
   - **Folder:** `/dist` (or `/` if you're not using the `dist` folder)
4. Click **Save**

### 3. Wait for Deployment
GitHub will automatically build and deploy your site. This may take a few minutes.

### 4. Access Your Site
Once deployed, your site will be available at:
```
https://zagzy8776.github.io/realssa/
```

---

## 🔧 Advanced Deployment Options

### 1. Custom Domain
You can connect a custom domain to your GitHub Pages site:
1. Go to **Settings** > **Pages**
2. Under **Custom domain**, enter your domain name
3. Follow the instructions to configure DNS settings

### 2. Environment Variables
For environment-specific configurations:
1. Create a `.env` file in your project root
2. Add your variables (e.g., `VITE_API_URL=https://api.example.com`)
3. These will be automatically included in the build process

---

## 📋 Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| **Build fails** | Check your Node.js version and run `npm install` again |
| **Site not updating** | Clear your browser cache or try a hard refresh (Ctrl+F5) |
| **404 errors** | Ensure you've selected the correct branch and folder in GitHub Pages settings |
| **CSS/JS not loading** | Verify all paths in your HTML files are correct |

---

## 📞 Support
For any issues or questions, please:
- Open an issue on GitHub
- Contact the project maintainer at [your-email@example.com]

---
Last updated: January 27, 2026