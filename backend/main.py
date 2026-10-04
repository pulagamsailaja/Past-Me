import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="Past Me API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input="I worked so hard to get my visa and study in the US."
        )

        embedding = response.data[0].embedding

        return {
            "success": True,
            "dimensions": len(embedding),
            "preview": embedding[:5]
        }

    except Exception as e:
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error": str(e)
        }