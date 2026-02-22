# Beroe Procurement Platform - Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vercel        │     │  Railway/Render  │     │   Supabase      │
│   (Frontend)    │────▶│   (Backend)      │────▶│   (Database)    │
│   Next.js       │     │   FastAPI        │     │   PostgreSQL    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 1. Supabase Setup (Database)

1. Create a project at [supabase.com](https://supabase.com)
2. Get your credentials from **Settings > API**:
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_ANON_KEY`: Your anon/public key
   - `DATABASE_URL`: Connection string from **Settings > Database**

---

## 2. Backend Deployment (Railway/Render)

### Option A: Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo
3. Set the **root directory** to `backend`
4. Add environment variables:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# LLM Providers
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
OPENAI_API_KEY=sk-your_key_here
SUPPLIER_INTEL_MODEL=gpt-4o-mini
SERPER_API_KEY=your_serper_key

# Auth
JWT_SECRET_KEY=generate-a-secure-random-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# App
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=INFO
```

5. Railway will auto-detect the `Procfile` and deploy

### Option B: Render

1. Go to [render.com](https://render.com) and create a new **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add the same environment variables as above

---

## 3. Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) and import your repo
2. Set the **root directory** to `frontend`
3. Add environment variables in **Settings > Environment Variables**:

```env
# Backend API (your Railway/Render URL)
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key
NEXT_PUBLIC_SUPABASE_SYNC=true

# App Info
NEXT_PUBLIC_APP_NAME=Beroe Procurement Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
```

4. Deploy!

---

## 4. Post-Deployment Checklist

- [ ] Backend health check: `https://your-backend.railway.app/health`
- [ ] Frontend loads: `https://your-app.vercel.app`
- [ ] Login/Register works
- [ ] File upload works
- [ ] LLM responses work (check backend logs for Groq/OpenAI)
- [ ] Supabase sync works (check browser console)

---

## Environment Variables Reference

### Backend Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (async) |
| `JWT_SECRET_KEY` | Random secret for JWT tokens |
| `GROQ_API_KEY` | Groq API key (primary LLM) |
| `OPENAI_API_KEY` | OpenAI API key (fallback + PP8) |

### Backend Optional
| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `groq` | Primary LLM provider |
| `SERPER_API_KEY` | - | For supplier intelligence |
| `DEBUG` | `false` | Enable debug mode |

### Frontend Required
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### Frontend Optional
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_SYNC` | `false` | Enable Supabase state sync |

---

## Troubleshooting

### CORS Errors
Backend allows all origins by default. If you need to restrict:
1. Update `backend/app/main.py` CORS settings
2. Add your Vercel domain to allowed origins

### Database Connection Failed
- Check `DATABASE_URL` format: `postgresql+asyncpg://user:pass@host:5432/db`
- Ensure Supabase allows external connections (Settings > Database > Connection Pooling)

### LLM Not Working
- Check Groq API key is valid
- Check rate limits (Groq: 12K TPM, 100K TPD)
- Falls back to OpenAI automatically if Groq fails

### Supabase Sync Not Working
- Check `NEXT_PUBLIC_SUPABASE_SYNC=true`
- Check browser console for errors
- Verify Supabase credentials are correct
