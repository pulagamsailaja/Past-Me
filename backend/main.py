from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Past Me API")

# Free local embedding model
embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

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
    text = "I worked so hard to get my visa and study in the US."

    embedding = embedding_model.encode(text).tolist()

    return {
        "success": True,
        "dimensions": len(embedding),
        "preview": embedding[:5]
    }