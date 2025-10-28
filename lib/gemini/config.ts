import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Get the Gemini model for news generation
export const getGeminiModel = () => {
  const genAI = getGeminiClient();
  
  // Using gemini-2.0-flash which is available in the current API
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
