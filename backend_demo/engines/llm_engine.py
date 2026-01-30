"""
LLM Engine - OpenAI GPT integration for brief generation
Provides synchronous and asynchronous text generation capabilities.
"""

import os
import logging
import asyncio
from typing import Optional, Dict, Any, List
from pathlib import Path

# Configure logger
logger = logging.getLogger(__name__)


class LLMEngineError(Exception):
    """Base exception for LLM Engine errors"""
    pass


class LLMNotAvailableError(LLMEngineError):
    """Raised when LLM is not available"""
    pass


class LLMRateLimitError(LLMEngineError):
    """Raised when rate limit is hit"""
    pass


class LLMEngine:
    """
    LLM Engine for natural language generation.
    Uses OpenAI GPT-4 for context-aware text generation.

    Supports both synchronous and asynchronous operations.
    """

    # Default configuration
    DEFAULT_MODEL = "gpt-4o"
    DEFAULT_MAX_TOKENS = 2000
    DEFAULT_TEMPERATURE = 0.3

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_retries: int = 3,
        timeout: float = 60.0
    ):
        """
        Initialize LLM Engine with OpenAI.

        Args:
            api_key: OpenAI API key (if None, reads from environment)
            model: Model name (if None, uses gpt-4o)
            max_retries: Maximum number of retry attempts for failed requests
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY', '')
        self.model = model or self.DEFAULT_MODEL
        self.max_retries = max_retries
        self.timeout = timeout
        self._client = None
        self._async_client = None
        self._system_prompt: Optional[str] = None
        self._is_available: Optional[bool] = None

        # Initialize client
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Initialize OpenAI client with proper error handling"""
        if not self.api_key or len(self.api_key) < 10:
            logger.warning(
                "OPENAI_API_KEY not set or invalid. LLM features will be disabled. "
                "Set OPENAI_API_KEY environment variable to enable AI features."
            )
            self._is_available = False
            return

        try:
            from openai import OpenAI, AsyncOpenAI
            self._client = OpenAI(
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries
            )
            self._async_client = AsyncOpenAI(
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries
            )
            self._is_available = True
            logger.info(f"LLM Engine initialized with model: {self.model}")

        except ImportError:
            logger.error("OpenAI package not installed. Run: pip install openai")
            self._is_available = False
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            self._is_available = False

    @property
    def is_available(self) -> bool:
        """Check if LLM is available for use"""
        return self._is_available is True

    @property
    def client(self):
        """Get the synchronous OpenAI client"""
        return self._client

    def _load_system_prompt(self) -> str:
        """
        Load enterprise system prompt from file or use default.
        Caches the prompt for subsequent calls.
        """
        if self._system_prompt is not None:
            return self._system_prompt

        try:
            prompt_file = Path(__file__).parent.parent.parent / 'config' / 'prompts' / 'system_prompt.py'
            if prompt_file.exists():
                with open(prompt_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'SYSTEM_PROMPT = """' in content:
                        start = content.find('SYSTEM_PROMPT = """') + len('SYSTEM_PROMPT = """')
                        end = content.find('"""', start)
                        self._system_prompt = content[start:end].strip()
                        return self._system_prompt

        except PermissionError:
            logger.warning("Permission denied reading system prompt file")
        except UnicodeDecodeError:
            logger.warning("Encoding error reading system prompt file")
        except Exception as e:
            logger.warning(f"Could not load system prompt from file: {e}")

        # Use default prompt
        self._system_prompt = self._get_default_system_prompt()
        return self._system_prompt

    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for procurement AI"""
        return """You are the Procurement AI Supply Chain Recommendation System, an enterprise-grade procurement intelligence system.

CRITICAL RULES:
1. ZERO HALLUCINATION: Never invent data, suppliers, or numbers
2. TRACEABILITY: Cite source for every claim
3. ACCURACY: Show calculations with formulas
4. SPECIFICITY: Use exact numbers, not ranges
5. DATA-DRIVEN: Only use provided data

NEVER:
- Invent supplier names or numbers
- Make assumptions without data
- Provide generic advice
- State opinions as facts

ALWAYS:
- Cite source for every number
- Show calculation formulas
- Reference specific rules
- Acknowledge data limitations
"""

    def generate(
        self,
        prompt: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate text with OpenAI (synchronous).

        Args:
            prompt: The prompt to send to OpenAI
            max_tokens: Maximum tokens in response (default: 2000)
            temperature: Creativity level 0.0-2.0 (default: 0.3)
            system_prompt: Custom system prompt (uses default if None)

        Returns:
            Generated text response, or empty string if unavailable

        Raises:
            LLMNotAvailableError: If LLM is not configured
            LLMRateLimitError: If rate limit is exceeded
            LLMEngineError: For other API errors
        """
        if not self.is_available:
            logger.warning("LLM not available, returning empty response")
            return ""

        if not prompt or not prompt.strip():
            logger.warning("Empty prompt provided")
            return ""

        try:
            system_content = system_prompt or self._load_system_prompt()

            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": prompt}
                ],
                temperature=min(max(temperature, 0.0), 2.0),  # Clamp to valid range
                max_tokens=min(max(max_tokens, 1), 128000)  # Clamp to valid range
            )

            result = response.choices[0].message.content
            logger.debug(f"Generated {len(result)} characters")
            return result or ""

        except ImportError:
            logger.error("OpenAI package not available")
            return ""
        except Exception as e:
            error_type = type(e).__name__

            # Handle specific OpenAI errors
            if 'RateLimitError' in error_type:
                logger.error(f"Rate limit exceeded: {e}")
                raise LLMRateLimitError(f"Rate limit exceeded: {e}") from e
            elif 'AuthenticationError' in error_type:
                logger.error("Invalid API key")
                self._is_available = False
                return ""
            elif 'APIConnectionError' in error_type:
                logger.error(f"Connection error: {e}")
                return ""
            else:
                logger.error(f"LLM generation error ({error_type}): {e}")
                return ""

    async def generate_async(
        self,
        prompt: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate text with OpenAI (asynchronous).

        Args:
            prompt: The prompt to send to OpenAI
            max_tokens: Maximum tokens in response
            temperature: Creativity level 0.0-2.0
            system_prompt: Custom system prompt (uses default if None)

        Returns:
            Generated text response, or empty string if unavailable
        """
        if not self.is_available or self._async_client is None:
            logger.warning("Async LLM not available, returning empty response")
            return ""

        if not prompt or not prompt.strip():
            logger.warning("Empty prompt provided")
            return ""

        try:
            system_content = system_prompt or self._load_system_prompt()

            response = await self._async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": prompt}
                ],
                temperature=min(max(temperature, 0.0), 2.0),
                max_tokens=min(max(max_tokens, 1), 128000)
            )

            result = response.choices[0].message.content
            logger.debug(f"Async generated {len(result)} characters")
            return result or ""

        except Exception as e:
            logger.error(f"Async LLM generation error: {e}")
            return ""

    def generate_with_context(
        self,
        prompt: str,
        context: List[Dict[str, str]],
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE
    ) -> str:
        """
        Generate text with conversation context.

        Args:
            prompt: The current prompt
            context: List of previous messages [{"role": "user/assistant", "content": "..."}]
            max_tokens: Maximum tokens in response
            temperature: Creativity level

        Returns:
            Generated text response
        """
        if not self.is_available:
            return ""

        try:
            messages = [{"role": "system", "content": self._load_system_prompt()}]
            messages.extend(context)
            messages.append({"role": "user", "content": prompt})

            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=min(max(temperature, 0.0), 2.0),
                max_tokens=min(max(max_tokens, 1), 128000)
            )

            return response.choices[0].message.content or ""

        except Exception as e:
            logger.error(f"Context generation error: {e}")
            return ""

    def count_tokens(self, text: str) -> int:
        """
        Estimate token count for text.

        Args:
            text: Text to count tokens for

        Returns:
            Estimated token count
        """
        try:
            import tiktoken
            encoding = tiktoken.encoding_for_model(self.model)
            return len(encoding.encode(text))
        except ImportError:
            # Rough estimate: ~4 chars per token
            return len(text) // 4
        except Exception:
            return len(text) // 4

    def health_check(self) -> Dict[str, Any]:
        """
        Check LLM engine health status.

        Returns:
            Dictionary with health status information
        """
        return {
            "available": self.is_available,
            "model": self.model,
            "api_key_set": bool(self.api_key and len(self.api_key) > 10),
            "client_initialized": self._client is not None,
            "async_client_initialized": self._async_client is not None
        }


# Convenience function for quick generation
def generate_text(prompt: str, **kwargs) -> str:
    """
    Quick text generation without creating engine instance.

    Args:
        prompt: Text prompt
        **kwargs: Additional arguments passed to generate()

    Returns:
        Generated text
    """
    engine = LLMEngine()
    return engine.generate(prompt, **kwargs)
