from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin
cred = credentials.Certificate("firebase_config.json")
firebase_admin.initialize_app(cred)

app = FastAPI()

# Allow CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper: verify Firebase token
def verify_firebase_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth_header.split(" ")[1]
    try:
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception as e:
        print("Token verification failed:", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# API endpoint for registering user
@app.post("/api/register")
async def register_user(request: Request, user=Depends(verify_firebase_token)):
    body = await request.json()
    email = body.get("email")

    # You can store this user info in a database (if needed)
    print(f" User verified: {user['uid']}, email: {email}")
    return {
        "message": "User registered successfully",
        "firebase_uid": user["uid"],
        "email": email,
    }

@app.get("/api/protected")
def protected_route(request: Request):
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")

    id_token = auth_header.split(" ")[1]  # Expected format: Bearer <token>

    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email")
        return {"message": "Access granted", "uid": uid, "email": email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    
@app.get("/")
async def root():
    return {"message": "Backend running successfully"}
