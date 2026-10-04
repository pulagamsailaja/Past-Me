import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("Missing Supabase environment variables")

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

app = FastAPI(title="Past Me API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MemoryCreate(BaseModel):
    content: str
    memory_date: datetime


@app.get("/")
def root():
    return {
        "app": "Past Me",
        "status": "running",
        "principle": "Past Me reminds. It never decides."
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/test-embedding")
def test_embedding():
    text = "I worked so hard to get my visa and study in the US."

    embedding = embedding_model.encode(text).tolist()

    return {
        "success": True,
        "dimensions": len(embedding),
        "preview": embedding[:5]
    }


@app.post("/memories")
def create_memory(
    memory: MemoryCreate,
    authorization: str | None = Header(default=None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token"
        )

    access_token = authorization.replace("Bearer ", "", 1)

    try:
        # Verify the Supabase access token
        user_response = supabase.auth.get_user(access_token)
        user = user_response.user

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        content = memory.content.strip()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Memory cannot be empty"
            )

        # Generate the free local 384-dimensional embedding
        embedding = embedding_model.encode(content).tolist()

        # Use this user's token so Supabase RLS still protects the row
        user_supabase = create_client(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        )

        user_supabase.postgrest.auth(access_token)

        result = (
            user_supabase
            .table("memories")
            .insert({
                "user_id": user.id,
                "content": content,
                "memory_date": memory.memory_date.isoformat(),
                "embedding": embedding,
            })
            .execute()
        )

        return {
            "success": True,
            "memory": result.data[0]
        }

    except HTTPException:
        raise

    except Exception as error:
        print("CREATE MEMORY ERROR:", error)

        raise HTTPException(
            status_code=500,
            detail="Could not save memory"
        )