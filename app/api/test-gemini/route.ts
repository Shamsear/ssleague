import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY not configured',
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try to list available models
    try {
      const models = await genAI.listModels();
      
      return NextResponse.json({
        success: true,
        models: models.map((m: any) => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description,
          supportedGenerationMethods: m.supportedGenerationMethods,
        })),
      });
    } catch (listError: any) {
      // If listModels doesn't work, just try a simple generation with different models
      const modelsToTry = [
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'models/gemini-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
      ];

      const results: any[] = [];

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent('Hello');
          const response = await result.response;
          const text = response.text();
          
          results.push({
            model: modelName,
            success: true,
            response: text.substring(0, 50) + '...',
          });
          
          // If one works, we can stop
          break;
        } catch (err: any) {
          results.push({
            model: modelName,
            success: false,
            error: err.message,
          });
        }
      }

      return NextResponse.json({
        success: false,
        listModelsError: listError.message,
        triedModels: results,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
