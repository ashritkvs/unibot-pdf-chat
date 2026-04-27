import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain.chains import RetrievalQA

# Load env vars
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX")

# Set up the LLM
llm = ChatOpenAI(
    temperature=0.2,
    model="gpt-3.5-turbo",
    openai_api_key=openai_api_key,
    streaming=True
)

# Set up the vector store retriever
embedding = OpenAIEmbeddings(openai_api_key=openai_api_key)
vectorstore = PineconeVectorStore(
    index_name=pinecone_index_name,
    embedding=embedding,
    pinecone_api_key=pinecone_api_key,
)

retriever = vectorstore.as_retriever()

# RetrievalQA Chain
qa = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    chain_type="stuff",  # “stuff” = simple RAG context injection
    return_source_documents=True
)

# Chat loop
print("\n💬 Welcome to UniBot! Ask questions about your PDF.")
print("🔚 Type 'exit' to quit.\n")

while True:
    query = input("👤 You: ")
    if query.lower() in ["exit", "quit"]:
        print("👋 Exiting UniBot. See you next time!")
        break

    result = qa({"query": query})
    print("\n🤖 UniBot:", result["result"])
    print("\n📄 Sources:", [doc.metadata.get("source", "") for doc in result["source_documents"]])
    print("-" * 60)

