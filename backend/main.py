import os
import re
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client


# ==========================================================
# ENVIRONMENT
# ==========================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError(
        "Missing Supabase environment variables"
    )


# ==========================================================
# SUPABASE
# ==========================================================

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
)


# ==========================================================
# EMBEDDING MODEL
# ==========================================================

embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)


# ==========================================================
# FASTAPI
# ==========================================================

app = FastAPI(
    title="Past Me API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================
# REQUEST MODELS
# ==========================================================

class MemoryCreate(BaseModel):
    content: str
    memory_date: datetime
    title: str | None = None


class MemoryUpdate(BaseModel):
    content: str
    memory_date: datetime
    title: str | None = None


# ==========================================================
# SETTINGS
# ==========================================================

# Whole-journal matches can be slightly broader.
WHOLE_JOURNAL_THRESHOLD = 0.35

# Short segments can create accidental matches more easily,
# so we make their threshold slightly stricter.
SEGMENT_THRESHOLD = 0.38

MAX_CONNECTIONS = 3

MATCHES_PER_SEARCH = 8


# ==========================================================
# AUTH HELPER
# ==========================================================

def get_authenticated_user(
    authorization: str | None
):

    if (
        not authorization
        or not authorization.startswith("Bearer ")
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token"
        )

    access_token = authorization.replace(
        "Bearer ",
        "",
        1
    )

    user_response = supabase.auth.get_user(
        access_token
    )

    user = user_response.user

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    user_supabase = create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    )

    user_supabase.postgrest.auth(
        access_token
    )

    return (
        user,
        user_supabase,
        access_token
    )


# ==========================================================
# GENERAL HELPERS
# ==========================================================

def clean_title(
    title: str | None
):

    if not title:
        return None

    cleaned = title.strip()

    return cleaned if cleaned else None


def create_embedding(
    text: str
):

    return embedding_model.encode(
        text
    ).tolist()


# ==========================================================
# MULTI-TOPIC SEGMENTATION
# ==========================================================

def create_search_segments(
    content: str
):

    cleaned = re.sub(
        r"\s+",
        " ",
        content
    ).strip()

    if not cleaned:
        return []

    # Split on sentence-ending punctuation.
    sentences = re.split(
        r"(?<=[.!?])\s+",
        cleaned
    )

    sentences = [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]

    segments = []

    for sentence in sentences:

        # Ignore tiny fragments such as "Yeah."
        if len(sentence.split()) >= 5:
            segments.append(sentence)

    # Also make two-sentence groups.
    #
    # This helps when the meaning is spread across
    # two nearby sentences.
    if len(sentences) > 1:

        for index in range(
            len(sentences) - 1
        ):

            combined = (
                sentences[index]
                + " "
                + sentences[index + 1]
            ).strip()

            if len(combined.split()) >= 8:
                segments.append(combined)

    # Remove duplicate text while preserving order.
    unique_segments = []

    seen = set()

    for segment in segments:

        normalized = segment.lower().strip()

        if normalized in seen:
            continue

        seen.add(normalized)
        unique_segments.append(segment)

    # Prevent a huge journal from causing dozens
    # of embedding/database calls.
    return unique_segments[:8]


# ==========================================================
# SEARCH ONE PIECE OF TEXT
# ==========================================================

def search_past_memories(
    user_supabase,
    user_id: str,
    text: str,
    before_date: datetime,
    threshold: float,
    source_type: str
):

    embedding = create_embedding(
        text
    )

    result = user_supabase.rpc(
        "match_memories",
        {
            "query_embedding": embedding,
            "match_user_id": user_id,
            "before_date":
                before_date.isoformat(),
            "match_count":
                MATCHES_PER_SEARCH,
        }
    ).execute()

    matches = result.data or []

    accepted = []

    for match in matches:

        similarity = float(
            match.get(
                "similarity",
                0
            )
        )

        if similarity < threshold:
            continue

        accepted.append({
            "id":
                match["id"],

            "title":
                match.get("title"),

            "content":
                match["content"],

            "memory_date":
                match["memory_date"],

            "similarity":
                similarity,

            # Useful internally and for debugging.
            "matched_from":
                source_type,

            "matched_text":
                text,
        })

    return accepted


# ==========================================================
# FIND MULTIPLE PAST CONNECTIONS
# ==========================================================

def find_past_connections(
    user_supabase,
    user_id: str,
    content: str,
    memory_date: datetime
):

    candidates = []


    # ------------------------------------------------------
    # 1. SEARCH THE ENTIRE JOURNAL
    # ------------------------------------------------------

    whole_matches = search_past_memories(
        user_supabase=user_supabase,
        user_id=user_id,
        text=content,
        before_date=memory_date,
        threshold=WHOLE_JOURNAL_THRESHOLD,
        source_type="whole_journal",
    )

    candidates.extend(
        whole_matches
    )


    # ------------------------------------------------------
    # 2. SEARCH INDIVIDUAL TOPICS / SEGMENTS
    # ------------------------------------------------------

    segments = create_search_segments(
        content
    )

    print(
        "\nSEARCH SEGMENTS:"
    )

    for segment in segments:
        print(
            "-",
            segment
        )

        segment_matches = search_past_memories(
            user_supabase=user_supabase,
            user_id=user_id,
            text=segment,
            before_date=memory_date,
            threshold=SEGMENT_THRESHOLD,
            source_type="segment",
        )

        candidates.extend(
            segment_matches
        )


    # ------------------------------------------------------
    # 3. DEDUPLICATE
    #
    # The same old memory might be discovered by:
    #
    # whole journal
    # sentence 1
    # sentence 2
    #
    # We only want to show it once.
    # ------------------------------------------------------

    best_by_memory = {}

    for candidate in candidates:

        memory_id = candidate["id"]

        existing = best_by_memory.get(
            memory_id
        )

        if (
            existing is None
            or candidate["similarity"]
            > existing["similarity"]
        ):
            best_by_memory[
                memory_id
            ] = candidate


    unique_matches = list(
        best_by_memory.values()
    )


    # ------------------------------------------------------
    # 4. RANK STRONGEST FIRST
    # ------------------------------------------------------

    unique_matches.sort(
        key=lambda item:
            item["similarity"],
        reverse=True
    )


    # ------------------------------------------------------
    # 5. DEBUG OUTPUT
    # ------------------------------------------------------

    print(
        "\nFINAL CONNECTION CANDIDATES:"
    )

    for candidate in unique_matches:

        print(
            round(
                candidate["similarity"],
                3
            ),
            "|",
            candidate["matched_from"],
            "|",
            candidate["content"][:80]
        )


    # ------------------------------------------------------
    # 6. MAXIMUM THREE
    # ------------------------------------------------------

    return unique_matches[
        :MAX_CONNECTIONS
    ]


# ==========================================================
# BASIC ROUTES
# ==========================================================

@app.get("/")
def root():

    return {
        "app": "Past Me",
        "status": "running",
        "principle":
            "Past Me reminds. It never decides."
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


@app.get("/test-embedding")
def test_embedding():

    text = (
        "I worked so hard to get my "
        "visa and study in the US."
    )

    embedding = create_embedding(
        text
    )

    return {
        "success": True,
        "dimensions": len(embedding),
        "preview": embedding[:5]
    }


# ==========================================================
# CREATE JOURNAL
# ==========================================================

@app.post("/memories")
def create_memory(
    memory: MemoryCreate,
    authorization: str | None = Header(
        default=None
    )
):

    try:

        (
            user,
            user_supabase,
            _
        ) = get_authenticated_user(
            authorization
        )

        content = memory.content.strip()

        if not content:

            raise HTTPException(
                status_code=400,
                detail=
                    "Journal cannot be empty"
            )


        # --------------------------------------------------
        # CREATE EMBEDDING FOR THE STORED JOURNAL
        # --------------------------------------------------

        embedding = create_embedding(
            content
        )


        # --------------------------------------------------
        # SAVE JOURNAL
        # --------------------------------------------------

        insert_result = (
            user_supabase
            .table("memories")
            .insert({
                "user_id":
                    user.id,

                "title":
                    clean_title(
                        memory.title
                    ),

                "content":
                    content,

                "memory_date":
                    memory.memory_date
                    .isoformat(),

                "embedding":
                    embedding,
            })
            .execute()
        )


        if not insert_result.data:

            raise HTTPException(
                status_code=500,
                detail=
                    "Journal was not saved"
            )


        new_memory = (
            insert_result.data[0]
        )


        # --------------------------------------------------
        # FIND MULTIPLE MEANINGFUL CONNECTIONS
        # --------------------------------------------------

        connections = (
            find_past_connections(
                user_supabase=
                    user_supabase,

                user_id=
                    str(user.id),

                content=
                    content,

                memory_date=
                    memory.memory_date,
            )
        )


        return {
            "success": True,
            "memory": new_memory,
            "connections": connections
        }


    except HTTPException:
        raise


    except Exception as error:

        print(
            "CREATE MEMORY ERROR:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=
                "Could not save journal"
        )


# ==========================================================
# EDIT JOURNAL
# ==========================================================

@app.put("/memories/{memory_id}")
def update_memory(
    memory_id: str,
    memory: MemoryUpdate,
    authorization: str | None = Header(
        default=None
    )
):

    try:

        (
            user,
            user_supabase,
            _
        ) = get_authenticated_user(
            authorization
        )

        content = memory.content.strip()

        if not content:

            raise HTTPException(
                status_code=400,
                detail=
                    "Journal cannot be empty"
            )


        # --------------------------------------------------
        # GET EXISTING JOURNAL
        # --------------------------------------------------

        existing_result = (
            user_supabase
            .table("memories")
            .select(
                "id, user_id, title, "
                "content, memory_date"
            )
            .eq(
                "id",
                memory_id
            )
            .single()
            .execute()
        )

        existing_memory = (
            existing_result.data
        )


        if not existing_memory:

            raise HTTPException(
                status_code=404,
                detail=
                    "Journal not found"
            )


        if (
            str(
                existing_memory[
                    "user_id"
                ]
            )
            != str(user.id)
        ):

            raise HTTPException(
                status_code=403,
                detail=
                    "You cannot edit this journal"
            )


        # --------------------------------------------------
        # PREPARE UPDATE
        # --------------------------------------------------

        update_data = {
            "title":
                clean_title(
                    memory.title
                ),

            "content":
                content,

            "memory_date":
                memory.memory_date
                .isoformat(),
        }


        # --------------------------------------------------
        # REGENERATE VECTOR ONLY WHEN TEXT CHANGES
        # --------------------------------------------------

        content_changed = (
            existing_memory[
                "content"
            ].strip()
            != content
        )


        if content_changed:

            update_data[
                "embedding"
            ] = create_embedding(
                content
            )


        # --------------------------------------------------
        # UPDATE DATABASE
        # --------------------------------------------------

        update_result = (
            user_supabase
            .table("memories")
            .update(
                update_data
            )
            .eq(
                "id",
                memory_id
            )
            .execute()
        )


        if not update_result.data:

            raise HTTPException(
                status_code=500,
                detail=
                    "Journal was not updated"
            )


        return {
            "success": True,
            "memory":
                update_result.data[0]
        }


    except HTTPException:
        raise


    except Exception as error:

        print(
            "UPDATE MEMORY ERROR:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=
                "Could not update journal"
        )

    # ==========================================================
# BACKFILL MISSING EMBEDDINGS
# ==========================================================

@app.post("/backfill-embeddings")
def backfill_embeddings(
    authorization: str | None = Header(default=None)
):

    try:

        (
            user,
            user_supabase,
            _
        ) = get_authenticated_user(
            authorization
        )

        result = (
            user_supabase
            .table("memories")
            .select("id, content")
            .eq("user_id", user.id)
            .is_("embedding", "null")
            .execute()
        )

        memories = result.data or []

        updated_count = 0

        for memory in memories:

            content = memory["content"].strip()

            if not content:
                continue

            embedding = create_embedding(
                content
            )

            (
                user_supabase
                .table("memories")
                .update({
                    "embedding": embedding
                })
                .eq(
                    "id",
                    memory["id"]
                )
                .execute()
            )

            updated_count += 1

        return {
            "success": True,
            "updated": updated_count
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "BACKFILL ERROR:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail="Could not backfill embeddings"
        )