# NightOwls Mythic+ Signup System

One repo, one Koyeb deployment. FastAPI serves both the API and the frontend.

## Project Structure

```
nightowls/
├── app/                    # Python backend
│   ├── main.py             # FastAPI — serves API + static files
│   ├── database.py         # PostgreSQL connection
│   ├── models/
│   │   ├── models.py       # SQLAlchemy tables
│   │   └── schemas.py      # Pydantic validation + WoW spec data
│   ├── routers/
│   │   ├── players.py      # Signup, roster, spec endpoints
│   │   ├── admin.py        # Lock, unlock, archive
│   │   └── groups.py       # Sort + save groups
│   └── services/
│       └── sorting.py      # Auto-sort algorithm
├── static/                 # Frontend (served by FastAPI)
│   ├── index.html
│   ├── styles.css
│   ├── config.js / data.js / api.js / ui.js
│   ├── sorting.js / admin.js / app.js
│   └── *.png / *.jpg       # Image assets
├── requirements.txt
├── Procfile
├── runtime.txt
└── README.md
```

## Deploy to Koyeb (Free Tier)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "NightOwls Mythic+ Signup System"
git remote add origin https://github.com/YOUR_USER/nightowls.git
git push -u origin main
```

### 2. Create a Koyeb Account
Go to [koyeb.com](https://www.koyeb.com) and sign up (free, no credit card needed).

### 3. Create a PostgreSQL Database
1. In the Koyeb console, go to **Databases** → **Create Database**
2. Pick a name (e.g. `nightowls-db`) and a region
3. Once created, copy the **Connection String** — you'll need it next

### 4. Deploy the App
1. Click **Create Web Service** → **GitHub**
2. Connect your GitHub account and select the `nightowls` repo
3. Koyeb auto-detects Python (from `requirements.txt` + `runtime.txt`)
4. Under **Build**, set the Run command to:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
5. Set the **Exposed port** to `8000`
6. Under **Health checks**, set the path to `/health`
7. Choose the **Free** instance type

### 5. Set Environment Variables
In the service settings → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | The connection string from step 3 |
| `ADMIN_PASSWORD` | Your secret admin password |

> The `DATABASE_URL` from Koyeb looks like:
> `postgresql://user:pass@host:port/dbname`
> The app auto-converts this to the async format needed by asyncpg.

### 6. Deploy!
Click **Deploy**. Koyeb builds and deploys your app. Once healthy, you get a URL like:
```
https://nightowls-YOUR_ORG.koyeb.app
```

- **Your site** → that URL
- **API docs** → `/docs` (Swagger UI)
- **Health check** → `/health`

---

## Free Tier Limits

Koyeb's free tier gives you:
- **1 web service**: 0.1 vCPU, 512MB RAM (plenty for this app)
- **1 PostgreSQL database**: 1GB storage, 50 hours active time/month

The database auto-sleeps after 5 min of inactivity. For a weekly M+ event
this is more than enough. If you ever hit limits, Neon.tech offers a free
PostgreSQL with more generous active hours — just swap the DATABASE_URL.

---

## Features

- **Full spec validation** — Class → Spec dropdown, role auto-derived
- **Smart auto-sort** — 5-man groups with Lust + B-Rez optimization
- **Admin panel** — Lock/Unlock/Archive/Save with password protection
- **Drag & drop** — Rearrange players between groups
- **Live polling** — Roster refreshes every 20 seconds
- **Toast notifications** — Animated feedback for all actions
- **Countdown timer** — Next Friday event countdown with Twitch link

## Local Development

```bash
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/nightowls"
export ADMIN_PASSWORD="test123"
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000`.
