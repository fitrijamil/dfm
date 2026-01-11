# DFI System - Deployment & Cloud Placement Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│   FRONTEND (CDN)    │────HTTPS───▶│    BACKEND (API)    │
│  Static HTML/CSS/JS │   REST      │   Node.js/Express   │
│  Cloudflare Pages   │   CORS      │      Render         │
│     or Vercel       │             │    or Fly.io        │
└─────────────────────┘             └─────────────────────┘
                                              │
                                              │ Service Key
                                              ▼
                                    ┌─────────────────────┐
                                    │     DATABASE        │
                                    │ Supabase PostgreSQL │
                                    │    (or Neon)        │
                                    └─────────────────────┘
```

## Component Responsibilities

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Frontend** | User interface, client-side logic | Static HTML/CSS/JS |
| **Backend** | Business logic, auth, API endpoints | Node.js 18 + Express |
| **Database** | Data persistence, RLS security | PostgreSQL (Supabase) |

## Why This Separation?

1. **Security**: Supabase SERVICE_ROLE_KEY stays only on backend server
2. **Scalability**: Frontend scales via CDN edge caching globally
3. **Cost**: Static frontend hosting is essentially free
4. **Performance**: CDN delivers frontend in <50ms worldwide
5. **Compliance**: Backend can be deployed in specific regions for data residency

---

## OPTION A: Simple/Low-Cost Stack (Recommended for Prototype)

### Services Used:
- **Frontend**: Cloudflare Pages (FREE)
- **Backend**: Render (FREE tier available)
- **Database**: Supabase (FREE tier: 500MB, 2 projects)

### Total Cost: $0/month for development, ~$7-25/month for production

---

### Step 1: Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → Create account
2. Click **"New Project"**
   - Name: `dfi-system`
   - Database Password: (save securely!)
   - Region: `Southeast Asia (Singapore)` or nearest
3. Wait 2 minutes for provisioning
4. Go to **SQL Editor** → Run these files IN ORDER:
   ```
   sql/001_create_users.sql
   sql/002_create_tables.sql
   sql/003_seed_data.sql
   ```
5. Go to **Settings → API** and copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **service_role** key (NOT anon key!)

**Environment Variables from Supabase:**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Step 2: Backend (Render)

1. Push code to GitHub repository
2. Go to [render.com](https://render.com) → Sign up
3. Click **"New +"** → **"Web Service"**
4. Connect GitHub repo
5. Configure:
   - **Name**: `dfi-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter $7/mo for always-on)

6. Add **Environment Variables**:
   ```
   PORT=3000
   NODE_ENV=production
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key...
   JWT_SECRET=your-random-32-character-secret-key-here
   FRONTEND_ORIGIN=https://dfi-system.pages.dev
   ```

7. Click **"Create Web Service"** → Wait 3-5 minutes
8. Copy your backend URL: `https://dfi-api.onrender.com`

**IMPORTANT**: Update `FRONTEND_ORIGIN` after deploying frontend!

---

### Step 3: Frontend (Cloudflare Pages)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Click **"Create a project"** → **"Connect to Git"**
3. Select your GitHub repo
4. Configure:
   - **Project name**: `dfi-system`
   - **Production branch**: `main`
   - **Framework preset**: `None`
   - **Build command**: (leave empty)
   - **Build output directory**: `frontend`

5. Click **"Save and Deploy"** → Wait 1 minute
6. Your site is live at: `https://dfi-system.pages.dev`

---

### Step 4: Update Configurations

**A. Update Frontend API URL:**

Edit `frontend/js/config.js`:
```javascript
const CONFIG = {
  API_BASE_URL: 'https://dfi-api.onrender.com',  // ← Your Render URL
  // ...
};
```

Commit and push → Cloudflare auto-deploys.

**B. Update Backend CORS:**

In Render Dashboard → Environment Variables:
```
FRONTEND_ORIGIN=https://dfi-system.pages.dev
```

Render will auto-redeploy.

---

### Step 5: Test Deployment

1. Go to `https://dfi-system.pages.dev`
2. Login with: `admin` / `Admin@123`
3. Verify dashboard loads with data

---

## OPTION B: Enterprise Stack (Azure)

### Services Used:
- **Frontend**: Azure Static Web Apps
- **Backend**: Azure App Service (Node.js)
- **Database**: Azure Database for PostgreSQL

### Total Cost: ~$50-150/month depending on tier

---

### Step 1: Database (Azure PostgreSQL)

1. Azure Portal → Create **"Azure Database for PostgreSQL"**
2. Choose **"Flexible server"**
3. Configure:
   - Server name: `dfi-db`
   - Region: `Southeast Asia`
   - Compute: `Burstable B1ms` (~$15/mo)
   - Storage: 32GB
4. Set admin credentials
5. Networking: Allow Azure services + your IP
6. Connect via pgAdmin and run SQL files

**Connection String:**
```
postgresql://admin:password@dfi-db.postgres.database.azure.com:5432/dfi?sslmode=require
```

---

### Step 2: Backend (Azure App Service)

1. Azure Portal → Create **"App Service"**
2. Configure:
   - Name: `dfi-api`
   - Runtime: `Node 18 LTS`
   - Region: `Southeast Asia`
   - Plan: `Basic B1` (~$13/mo)

3. Deployment Center → Connect GitHub
4. Configuration → Application Settings:
   ```
   PORT=8080
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret
   FRONTEND_ORIGIN=https://dfi-web.azurestaticapps.net
   ```

5. Your API: `https://dfi-api.azurewebsites.net`

---

### Step 3: Frontend (Azure Static Web Apps)

1. Azure Portal → Create **"Static Web App"**
2. Connect GitHub repo
3. Configure:
   - App location: `/frontend`
   - API location: (leave empty)
   - Output location: `/frontend`

4. Your site: `https://dfi-web.azurestaticapps.net`

---

## Environment Variables Reference

### Backend (.env)

```env
# Server
PORT=3000
NODE_ENV=production

# Database (Supabase)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OR Database (Direct PostgreSQL)
# DATABASE_URL=postgresql://user:pass@host:5432/db

# Auth
JWT_SECRET=minimum-32-characters-random-string

# CORS
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

### Frontend (config.js)

```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-backend-url.com',
  // ... rest of config
};
```

---

## CORS Configuration

Backend (`index.js`) uses:
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true,
  optionsSuccessStatus: 200
};
```

**CRITICAL**: The `FRONTEND_ORIGIN` must exactly match your frontend URL:
- ✅ `https://dfi-system.pages.dev`
- ❌ `https://dfi-system.pages.dev/` (trailing slash)
- ❌ `http://dfi-system.pages.dev` (wrong protocol)

---

## Folder Structure for Deployment

```
dfi-system/
├── frontend/           ← Deploy to Cloudflare Pages / Azure Static
│   ├── index.html
│   ├── login.html
│   ├── dashboard_*.html
│   ├── addcase_exec.html
│   ├── assets/
│   │   └── style.css
│   └── js/
│       └── config.js   ← UPDATE API_BASE_URL HERE
│
├── backend/            ← Deploy to Render / Azure App Service
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   ├── db/
│   ├── middleware/
│   └── routes/
│
└── sql/                ← Run in database console
    ├── 001_create_users.sql
    ├── 002_create_tables.sql
    └── 003_seed_data.sql
```

---

## Security Checklist

- [ ] Change default admin password immediately after deployment
- [ ] Use strong JWT_SECRET (32+ characters, random)
- [ ] Never expose SUPABASE_SERVICE_ROLE_KEY in frontend
- [ ] Enable HTTPS only (both services do this by default)
- [ ] Set proper CORS origin (no wildcards in production)
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Review and restrict database permissions

---

## Troubleshooting

### "CORS Error" in browser
→ Check `FRONTEND_ORIGIN` matches exactly (no trailing slash)

### "401 Unauthorized" on API calls
→ Check JWT_SECRET is same in backend as when token was issued
→ Check token hasn't expired (24h default)

### "Connection refused" to database
→ Check Supabase project is running
→ Verify SUPABASE_URL and SERVICE_ROLE_KEY are correct

### Frontend shows old version
→ Clear browser cache
→ Check Cloudflare Pages deployment completed
→ Hard refresh: Ctrl+Shift+R

---

## Support

For issues with:
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Render**: [render.com/docs](https://render.com/docs)
- **Cloudflare Pages**: [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages)
- **Azure**: [docs.microsoft.com/azure](https://docs.microsoft.com/azure)
