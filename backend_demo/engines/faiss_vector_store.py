"""
FAISS Vector Store for RAG Pipeline
Simple, Windows-compatible vector database
"""

import os
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
load_dotenv()

# FAISS
try:
    import faiss
    import numpy as np
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    faiss = None
    np = None

# OpenAI for embeddings
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


class FAISSVectorStore:
    """
    Simple FAISS-based vector store for RAG
    Windows-compatible alternative to ChromaDB
    """

    def __init__(
        self,
        persist_directory: str = "./data/faiss_db",
        embedding_model: str = "text-embedding-3-small"
    ):
        if not FAISS_AVAILABLE:
            raise ImportError("FAISS not installed. Install with: pip install faiss-cpu")

        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self.embedding_model = embedding_model

        # OpenAI client for embeddings
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key and OPENAI_AVAILABLE else None

        # FAISS index and documents
        self.index = None
        self.documents = []  # List of (content, metadata) tuples
        self.dimension = 1536  # text-embedding-3-small dimension

        print(f" FAISS Vector Store initialized")
        print(f"  Persist Directory: {self.persist_directory}")
        print(f"  Embedding Model: {self.embedding_model}")

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text using OpenAI"""
        if not self.client:
            return [0.0] * self.dimension

        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    def _get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        if not self.client:
            return [[0.0] * self.dimension for _ in texts]

        # Process in batches of 100
        all_embeddings = []
        batch_size = 100

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=batch
            )
            all_embeddings.extend([d.embedding for d in response.data])

        return all_embeddings

    def create_index(self, documents: List[Dict[str, Any]], reset: bool = False) -> None:
        """
        Create FAISS index from documents

        Args:
            documents: List of dicts with 'content' and 'metadata' keys
            reset: Reset existing index
        """
        if not documents:
            print("Warning: No documents provided")
            return

        print(f"\n Creating FAISS index with {len(documents)} documents...")

        # Get embeddings
        texts = [doc['content'] for doc in documents]
        print(" Generating embeddings...")
        embeddings = self._get_embeddings_batch(texts)

        # Create FAISS index
        embeddings_array = np.array(embeddings).astype('float32')
        self.index = faiss.IndexFlatIP(self.dimension)  # Inner product (cosine similarity with normalized vectors)

        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings_array)
        self.index.add(embeddings_array)

        # Store documents
        self.documents = [(doc['content'], doc.get('metadata', {})) for doc in documents]

        # Save to disk
        self._save()

        print(f" FAISS index created with {self.index.ntotal} vectors")

    def load_index(self) -> bool:
        """Load existing index from disk"""
        index_path = self.persist_directory / "index.faiss"
        docs_path = self.persist_directory / "documents.pkl"

        if not index_path.exists() or not docs_path.exists():
            print(f"[WARN] FAISS index not found at {self.persist_directory}")
            return False

        try:
            self.index = faiss.read_index(str(index_path))
            with open(docs_path, 'rb') as f:
                self.documents = pickle.load(f)

            print(f" Loaded FAISS index: {self.index.ntotal} vectors")
            return True
        except Exception as e:
            print(f"[WARN] Error loading FAISS index: {e}")
            return False

    def _save(self) -> None:
        """Save index and documents to disk"""
        index_path = self.persist_directory / "index.faiss"
        docs_path = self.persist_directory / "documents.pkl"

        faiss.write_index(self.index, str(index_path))
        with open(docs_path, 'wb') as f:
            pickle.dump(self.documents, f)

    def search(
        self,
        query: str,
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents

        Args:
            query: Search query
            k: Number of results

        Returns:
            List of results with content, metadata, and score
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        # Get query embedding
        query_embedding = np.array([self._get_embedding(query)]).astype('float32')
        faiss.normalize_L2(query_embedding)

        # Search
        scores, indices = self.index.search(query_embedding, min(k, self.index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.documents):
                content, metadata = self.documents[idx]
                results.append({
                    'content': content,
                    'metadata': metadata,
                    'score': float(score),
                    'source': metadata.get('source', 'unknown'),
                    'category': metadata.get('category', 'unknown')
                })

        return results

    def get_context_for_query(self, query: str, k: int = 5) -> str:
        """Get formatted context string for RAG"""
        results = self.search(query, k)

        if not results:
            return ""

        context_parts = []
        for i, result in enumerate(results, 1):
            context_parts.append(f"[SOURCE-{i}] ({result['source']})\n{result['content']}")

        return "\n\n---\n\n".join(context_parts)
