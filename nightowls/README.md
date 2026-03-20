# NightOwls Mythic+ Signup System

One repo, one Railway deployment. FastAPI serves both the API and the frontend.

## Project Structure

```
nightowls/
├── app/                    # Python backend
│   ├── main.py             # FastAPI app — serves API + static files
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
│   ├── config.js           # Config (API_URL is same-origin)
│   ├── data.js             # WoW class colors, utility data
│   ├── api.js              # All API fetch calls
│   ├── ui.js               # DOM rendering, toasts, particles
│   ├── sorting.js          # Client-side sort fallback
│   ├── admin.js            # Admin panel + drag-drop
│   ├── app.js              # Main controller
│   └── *.png / *.jpg       # Image assets
├── requirements.txt
├── Procfile
├── railway.toml
└── README.md
```

## Deploy to Railway (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "NightOwls Mythic+ Signup System"
git remote add origin https://github.com/YOUR_USER/nightowls.git
git push -u origin main
```

### 2. Set up Railway
1. Go to [railway.app](https://railway.app) → sign in with GitHub
2. **New Project** → **Deploy from GitHub Repo** → select `nightowls`
3. Railway auto-detects Python and starts building

### 3. Add PostgreSQL
1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-sets the `DATABASE_URL` environment variable

### 4. Set Admin Password
In Railway → your service → **Variables** tab, add:
```
ADMIN_PASSWORD=your_secret_password_here
```

### 5. Done!
Railway gives you a URL like `https://nightowls-production.up.railway.app`
- Your site is at that URL (FastAPI serves `index.html`)
- API docs at `/docs` (Swagger UI)
- All API endpoints at `/api/*`

## Features

- **Full spec validation** — Class → Spec dropdown, role auto-derived (no Mage Tanks)
- **Smart auto-sort** — 5-man groups with Lust + B-Rez optimization
- **Admin panel** — Lock/Unlock/Archive/Save with password protection
- **Drag & drop** — Rearrange players between groups
- **Live polling** — Roster refreshes every 20 seconds
- **Toast notifications** — Animated feedback for all actions
- **Countdown timer** — Next Friday event countdown with Twitch link

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# You need a PostgreSQL instance running locally, or override DATABASE_URL:
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/nightowls"
export ADMIN_PASSWORD="test123"

# Run
uvicorn app.main:app --reload --port 8000
```

Then open `http://localhost:8000` in your browser.
