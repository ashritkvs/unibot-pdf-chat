from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_classic.chains import RetrievalQA
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_pinecone import PineconeVectorStore
import os
import tempfile
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up vectorstore
embeddings = OpenAIEmbeddings()
vectorstore = PineconeVectorStore.from_existing_index(
    os.getenv("PINECONE_INDEX"),
    embeddings
)

llm = ChatOpenAI()
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever()
)

def _extract_question(data: dict) -> str:
    # Support both legacy keys and the new consistent key.
    if not isinstance(data, dict):
        return ""
    return (data.get("question") or data.get("query") or "").strip()


@app.post("/ask")
async def ask_question(request: Request):
    data = await request.json()
    query = _extract_question(data)
    try:
        answer = qa_chain.run(query)
        return JSONResponse({"answer": answer})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/query")
async def query_alias(request: Request):
    """
    Backwards-compatible alias for older frontend code.
    Returns the same shape as /ask, plus legacy `response`.
    """
    data = await request.json()
    query = _extract_question(data)
    try:
        answer = qa_chain.run(query)
        return JSONResponse({"answer": answer, "response": answer})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF via multipart form-data, ingest into Pinecone,
    and delete the temp file afterwards.
    """
    if not file.filename.lower().endswith(".pdf"):
        return JSONResponse({"error": "Only PDF files are supported."}, status_code=400)

    from ingest import ingest_pdf

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp_path = tmp.name
            contents = await file.read()
            tmp.write(contents)

        ingest_pdf(tmp_path)
        return JSONResponse({"status": "success"})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
