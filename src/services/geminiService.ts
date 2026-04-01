import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || "";

export interface VerificationResult {
  isReal: boolean;
  confidenceScore: number;
  summary: string;
  suggestedCategory?: string;
  warning?: string;
}

export const verifyPlaceWithAI = async (placeName: string, category: string, description: string, city: string, state: string): Promise<VerificationResult> => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Skipping AI verification.");
    return {
      isReal: true,
      confidenceScore: 0,
      summary: "AI verification skipped (API Key missing).",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Verify the following place suggestion for a travel app:
      Name: ${placeName}
      Category: ${category}
      Description: ${description}
      Location: ${city}, ${state}
      
      Check if this place actually exists. Provide a confidence score (0-100) and a very short summary (max 20 words). 
      If the category seems wrong, suggest a better one.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isReal: { type: Type.BOOLEAN },
            confidenceScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            warning: { type: Type.STRING }
          },
          required: ["isReal", "confidenceScore", "summary"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as VerificationResult;
  } catch (error) {
    console.error("Gemini Verification Error:", error);
    return {
      isReal: true,
      confidenceScore: 50,
      summary: "AI verification failed due to an error.",
    };
  }
};
