import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeWellData(input: string) {
  const prompt = `
    Analyze the following Well Completion Report (WCR) or offset well data. 
    Extract casing seat depths, pore pressure, fracture gradient, lithology, and drilling fluid parameters.
    
    Data:
    ${input}
    
    Return the data in the following JSON format:
    {
      "wellName": "string",
      "casings": [{ "name": "string", "holeSize": "string", "casingSize": "string", "depth": number, "lithology": "string" }],
      "pressureProfile": [{ "depth": number, "porePressure": number, "fractureGradient": number }],
      "fluidPolicies": [{ "section": "string", "fluidType": "WBM|OBM", "density": number, "pv": number, "yp": number, "fluidLoss": number }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wellName: { type: Type.STRING },
            casings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  holeSize: { type: Type.STRING },
                  casingSize: { type: Type.STRING },
                  depth: { type: Type.NUMBER },
                  lithology: { type: Type.STRING }
                }
              }
            },
            pressureProfile: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  depth: { type: Type.NUMBER },
                  porePressure: { type: Type.NUMBER },
                  fractureGradient: { type: Type.NUMBER }
                }
              }
            },
            fluidPolicies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  fluidType: { type: Type.STRING },
                  density: { type: Type.NUMBER },
                  pv: { type: Type.NUMBER },
                  yp: { type: Type.NUMBER },
                  fluidLoss: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error analyzing well data:", error);
    throw error;
  }
}

export async function chatWithWellAssistant(history: { role: 'user' | 'model', content: string }[], wellContext: string) {
  const systemInstruction = `
    You are an AI Well Planning Assistant for Flow-Dynamics AUTOPLANNER. 
    Expert in drilling fluids, casing design, and pressure profile analysis.
    Current Well Context:
    ${wellContext}
    
    Answer technical questions clearly and professionally. If data is missing from context, mention you're interpreting based on general drilling engineering best practices.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] }))
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "The system is currently busy. Please try again in a moment.";
  }
}
