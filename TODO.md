# Hosting Deployment Plan for Sri Devi Snacks Application

## Overview
- Deploy backend to Railway for better performance (persistent instances, no cold starts)
- Deploy frontend to Vercel for fast static hosting
- Configure environment variables for secure communication
- Update frontend API service to use configurable base URL

## Steps to Complete

### 1. Update Frontend API Configuration
- [x] Modify `frontend/src/services/api.ts` to use `VITE_API_BASE_URL` environment variable
- [x] Add fallback to localhost for development
- [x] Update tsconfig.json to support import.meta (target es2020)

### 2. Prepare Repositories
- [ ] Create separate GitHub repository for backend code
- [ ] Create separate GitHub repository for frontend code
- [ ] Push backend code to backend repository
- [ ] Push frontend code to frontend repository

### 3. Deploy Backend to Railway
- [ ] Sign up/login to Railway (railway.app)
- [ ] Connect backend GitHub repository
- [ ] Configure environment variables in Railway:
  - DATABASE_URL (Railway provides PostgreSQL)
  - JWT_SECRET
  - JWT_EXPIRES_IN
  - NODE_ENV=production
  - FRONTEND_URL (will be Vercel URL)
- [ ] Set build command: `npm run build`
- [ ] Set start command: `npm start`
- [ ] Deploy and run database migrations: `npm run db:migrate`
- [ ] Seed database if needed: `npm run db:seed`

### 4. Deploy Frontend to Vercel
- [ ] Sign up/login to Vercel
- [ ] Connect frontend GitHub repository
- [ ] Configure build settings:
  - Build Command: `npm run build`
  - Output Directory: `dist`
- [ ] Set environment variable: `VITE_API_BASE_URL` to Railway backend URL
- [ ] Deploy frontend

### 5. Update Backend CORS
- [ ] In Railway, update FRONTEND_URL to the deployed Vercel frontend URL
- [ ] Redeploy backend if necessary

### 6. Testing and Verification
- [ ] Test frontend-backend communication
- [ ] Verify all API endpoints work correctly
- [ ] Check performance compared to previous deployment
- [ ] Monitor for any issues

### 7. Final Optimizations
- [ ] Enable Railway monitoring
- [ ] Configure Vercel analytics if needed
- [ ] Set up proper error handling and logging





Hosting Deployment Guide
I've updated your frontend code to support configurable API URLs and prepared a comprehensive deployment plan. Here's what I've done and the next steps:

✅ Code Changes Completed
Updated frontend/src/services/api.ts to use VITE_API_BASE_URL environment variable with localhost fallback
Updated frontend/tsconfig.json to ES2020 target for import.meta support
🚀 Deployment Strategy to Avoid Slow Communication
To prevent the slow frontend-backend communication you experienced with Vercel's serverless functions, we'll deploy:

Backend: Railway (persistent instances, no cold starts, better Node.js performance)
Frontend: Vercel (fast static hosting)
📋 Step-by-Step Deployment Instructions
1. Prepare Separate Repositories

# Create two new GitHub repositories:
# 1. sri-devi-snacks-backend
# 2. sri-devi-snacks-frontend

# Push backend code
cd backend
git init
git add .
git commit -m "Initial backend commit"
git remote add origin https://github.com/yourusername/sri-devi-snacks-backend.git
git push -u origin main

# Push frontend code  
cd ../frontend
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin https://github.com/yourusername/sri-devi-snacks-frontend.git
git push -u origin main
2. Deploy Backend to Railway
Go to Railway.app and sign up/login
Click "New Project" → "Deploy from GitHub repo"
Connect your sri-devi-snacks-backend repository
Railway will auto-detect Node.js and provide PostgreSQL database
In Railway dashboard → Variables tab, add:

JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
NODE_ENV=production
FRONTEND_URL=https://your-vercel-frontend-url.vercel.app  # Will update later
In Railway → Build tab, set:
Build Command: npm run build
Start Command: npm start
Deploy will start automatically
Once deployed, run database setup in Railway terminal:

npm run db:migrate
npm run db:seed
Note the Railway backend URL (e.g., https://sri-devi-snacks-backend.up.railway.app)
3. Deploy Frontend to Vercel
Go to Vercel.com and sign up/login
Click "New Project" → "Import Git Repository"
Connect your sri-devi-snacks-frontend repository
Configure project:
Framework Preset: Vite
Root Directory: ./ (leave default)
Build Command: npm run build
Output Directory: dist
Add Environment Variable:

VITE_API_BASE_URL=https://your-railway-backend-url/api
Click "Deploy"
Note the Vercel frontend URL (e.g., https://sri-devi-snacks-frontend.vercel.app)
4. Update Backend CORS
Back in Railway dashboard → Variables tab
Update FRONTEND_URL to your Vercel frontend URL
Redeploy backend if necessary
5. Test the Deployment
Visit your Vercel frontend URL
Try logging in and using the app
Check browser network tab for API response times (should be much faster than before)
🔧 Key Improvements Over Previous Setup
Railway backend: Persistent instances eliminate cold starts
Separate deployments: Better scaling and maintenance
Environment variables: Secure configuration management
Optimized communication: Direct API calls without Vercel function overhead
📊 Expected Performance
API response times: <200ms (vs 2-5s with Vercel serverless)
No cold start delays
Better reliability for database operations
The TODO.md file in your project root contains the complete checklist. Follow these steps, and your app should perform much better than the previous Vercel-only setup!