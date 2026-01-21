# Authentication 401 Error - Debugging & Solution

## Problem
Getting 401 Unauthorized when trying to fetch `/applications` after login.

## Root Causes

### 1. Missing JWT Secret (PRIMARY)
The JWT secret is required but may not be set in environment variables.

**Error Pattern:**
- Login works and returns a token
- Token is stored in localStorage
- Token IS being sent in Authorization header
- But API still returns 401: "Invalid token"

**Why:** The backend is using a different secret to decode the token than what was used to encode it.

### Solution 1: Set JWT_SECRET in .env

Create or update `backend/.env`:
```
DATABASE_URL=postgresql://user:password@db:5432/ingestion_db
AWS_ENDPOINT_URL=http://localstack:4566
S3_BUCKET=data-ingestion
SQS_QUEUE_NAME=applications
JWT_SECRET=my-super-secret-key-change-in-production
```

The backend now has a default value (`dev-secret-key-change-in-production`), but for consistency between frontend and backend, set it explicitly.

### 2. Check Environment Variables Are Being Loaded

In docker-compose.yml, the api service has:
```yaml
env_file:
  - ./backend/.env
```

This loads variables from `.env` file.

### Testing
1. Check if `.env` exists:
   ```bash
   ls -la backend/.env
   ```

2. If it doesn't exist, create it with the content above

3. Restart docker:
   ```bash
   docker compose down
   docker compose up --build
   ```

## Common Mistakes

### Mistake 1: Token not being sent
Check browser DevTools Network tab:
- Open DevTools (F12)
- Go to Network tab
- Click on any API request
- Look for `Authorization` header
- Should see: `Authorization: Bearer eyJ0eXAi...`

If missing, the frontend isn't sending it correctly.

### Mistake 2: CORS preventing request
If you see CORS error in console, the real error might be hidden. The request is being blocked before it reaches the backend.

Check:
- Frontend is running on `http://localhost:5173`
- Backend CORS is set to allow this origin
- In `backend/main.py` line 20:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Mistake 3: Token expired
Tokens expire after 24 hours. If you've been testing for a while, token might be expired.

Solution: Register/login again to get a fresh token.

## How to Debug

### Step 1: Check if token was created
```javascript
// In browser console (F12)
localStorage.getItem("token")
```

Should return a long string starting with `eyJ`

### Step 2: Check if token is being sent
```javascript
// In browser console
const token = localStorage.getItem("token");
const headers = {};
if (token) headers["Authorization"] = `Bearer ${token}`;
console.log(headers);
```

### Step 3: Manually test the token
```bash
# From terminal (replace TOKEN with actual token from localStorage)
TOKEN="eyJ0eXAi..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/applications
```

If returns 401, the token/secret mismatch is the issue.

### Step 4: Check backend logs
```bash
docker logs <api-container-id>
```

Look for error messages. Should see something like:
```
INFO:     172.20.0.1:XXXXX - "GET /applications HTTP/1.1" 200 OK
```

If you see 401, the issue is in the backend token validation.

## The Fix (Summary)

1. **Create `backend/.env`** with JWT_SECRET set
2. **Restart Docker**: `docker compose down && docker compose up --build`
3. **Register/Login** again to get a new token
4. **Test**: Try to fetch `/applications`

## Verification Checklist

- [ ] `backend/.env` file exists
- [ ] `JWT_SECRET` is set in `.env`
- [ ] Docker containers restarted after adding `.env`
- [ ] Registered/logged in after restart
- [ ] Token is in localStorage
- [ ] Token is being sent in Authorization header
- [ ] API returns 200 (not 401) for `/applications`

## If Still Getting 401

Check these logs:
```bash
# See backend logs
docker logs data-ingestion-tool-api-1

# See backend container output
docker exec data-ingestion-tool-api-1 python -c "from config import settings; print(f'JWT Secret set: {len(settings.jwt_secret)} chars')"
```

## Complete Restart Procedure

If nothing works, do a complete restart:

```bash
# Stop all containers and remove volumes
docker compose down -v

# Rebuild and start
docker compose up --build

# Register new account
# Login
# Test API calls
```

This ensures:
- Clean database
- Fresh environment variables
- New tokens generated with current secret
- No stale data

---

## Files That Were Changed

1. `backend/config.py` - Added default value for `jwt_secret`
2. `backend/main.py` - Fixed 3 database query bugs (Application class name)

Both are required for the system to work correctly.
