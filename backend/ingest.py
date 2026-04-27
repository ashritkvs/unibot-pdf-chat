import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone as PineconeClient, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

# Load environment variables
load_dotenv()

def ingest_pdf(pdf_path: str) -> None:
    """
    Ingest a local PDF into Pinecone:
    load → chunk → embed → upsert.
    """
    openai_api_key = os.getenv("OPENAI_API_KEY")
    pinecone_api_key = os.getenv("PINECONE_API_KEY")
    pinecone_index_name = os.getenv("PINECONE_INDEX")

    if not pinecone_index_name:
        raise RuntimeError("Missing PINECONE_INDEX in environment.")
    if not openai_api_key:
        raise RuntimeError("Missing OPENAI_API_KEY in environment.")
    if not pinecone_api_key:
        raise RuntimeError("Missing PINECONE_API_KEY in environment.")

    loader = PyPDFLoader(pdf_path)
    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(documents)

    embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)

    pc = PineconeClient(api_key=pinecone_api_key)

    if pinecone_index_name not in pc.list_indexes().names():
        pc.create_index(
            name=pinecone_index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    else:
        # Guardrail: Pinecone index dimension must match embedding dimension (1536).
        # If an index already exists with the wrong dimension (e.g. 1024), upserts will fail.
        try:
            desc = pc.describe_index(pinecone_index_name)
            dim = getattr(desc, "dimension", None)
            if dim is None and isinstance(desc, dict):
                dim = desc.get("dimension")
        except Exception as e:
            raise RuntimeError(f"Failed to describe Pinecone index '{pinecone_index_name}': {e}") from e

        if dim is not None and int(dim) != 1536:
            raise RuntimeError(
                f"Pinecone index '{pinecone_index_name}' has dimension {dim}, but UniBot requires 1536. "
                f"Fix: either delete/recreate that index with dimension=1536 (cosine, serverless aws us-east-1), "
                f"or set PINECONE_INDEX in your .env to a NEW index name and re-upload the PDF."
            )

    PineconeVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=pinecone_index_name,
        pinecone_api_key=pinecone_api_key,
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ingest a PDF into Pinecone.")
    parser.add_argument("pdf_path", help="Path to a local PDF file")
    args = parser.parse_args()

    ingest_pdf(args.pdf_path)
    print("✅ Ingestion complete! Embedded chunks uploaded to Pinecone.")

