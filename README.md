# NightOwls Updated Community Build

This package adds:
- Email/password authentication
- Community tab with profile cards and image upload
- Rules tab with admin editor
- Admin-only banner uploads for Rules and Community
- Position seed ordering for community profiles

## New environment variables
- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `SECRET_KEY` recommended for auth token signing
- `ADMIN_EMAILS` comma-separated emails to auto-mark as admin on signup
- `TRUSTED_IPS` optional for legacy admin panel auto-login

## Run locally
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
