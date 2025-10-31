import { GoogleGenerativeAI } from '@google/generative-ai';

// Track which API key is currently in use
let currentKeyIndex = 0;
let lastKeyRotation = Date.now();

// Get all available API keys from environment
const getApiKeys = (): string[] => {
  const keys: string[] = [];
  
  // Primary key
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  
  // Spare keys (add GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc. to .env.local)
  if (process.env.GEMINI_API_KEY_2) {
    keys.push(process.env.GEMINI_API_KEY_2);
  }
  
  if (process.env.GEMINI_API_KEY_3) {
    keys.push(process.env.GEMINI_API_KEY_3);
  }
  
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY configured in environment variables');
  }
  
  return keys;
};

// Get current API key
const getCurrentApiKey = (): string => {
  const keys = getApiKeys();
  return keys[currentKeyIndex % keys.length];
};

// Rotate to next API key
const rotateApiKey = (): void => {
  const keys = getApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    lastKeyRotation = Date.now();
    console.log(`🔄 Rotated to API key #${currentKeyIndex + 1} of ${keys.length}`);
  }
};

// Initialize Gemini API client with current key
const getGeminiClient = () => {
  const apiKey = getCurrentApiKey();
  return new GoogleGenerativeAI(apiKey);
};

// Get the Gemini model for news generation with automatic fallback
export const getGeminiModel = () => {
  const genAI = getGeminiClient();
  
  // Using gemini-2.0-flash which is available in the current API
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};

// Wrapper function that handles rate limit errors and retries with different keys
export const generateWithFallback = async (prompt: string, retries = 3): Promise<string> => {
  const keys = getApiKeys();
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < Math.min(retries, keys.length); attempt++) {
    try {
      const model = getGeminiModel();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      const isRateLimit = 
        error.message?.includes('429') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit && keys.length > 1 && attempt < keys.length - 1) {
        console.warn(`⚠️ Rate limit hit on API key #${currentKeyIndex + 1}, trying next key...`);
        rotateApiKey();
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // If not rate limit or no more keys, throw error
      throw error;
    }
  }
  
  throw lastError || new Error('Failed to generate content with all available API keys');
};

// Test connection to Gemini API
export const testGeminiConnection = async (): Promise<boolean> => {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent('Hello');
    const response = await result.response;
    return !!response.text();
  } catch (error) {
    console.error('Gemini API connection test failed:', error);
    return false;
  }
};
