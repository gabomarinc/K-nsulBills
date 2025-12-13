
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CatalogItem, FinancialAnalysisResult, DeepDiveReport, ParsedInvoiceData, PriceAnalysisResult } from "../types";

export const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';
const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const GEMINI_VISION_MODEL_ID = 'gemini-2.5-flash-image';

export interface AiKeys {
  gemini?: string;
  openai?: string;
}

const getAiClient = (keys?: AiKeys) => {
  // Priority: 1. User provided key (keys.gemini) 2. System Env Key (process.env.API_KEY)
  const apiKey = keys?.gemini || process.env.API_KEY;
  
  if (!apiKey) {
      console.error("Gemini AI Error: Missing API Key. User key is undefined and process.env.API_KEY is missing.");
      throw new Error(AI_ERROR_BLOCKED);
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to sanitize JSON response from LLM
const cleanJson = (text: string) => {
  if (!text) return "{}";
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
};

export const parseExpenseImage = async (
  imageBase64: string, 
  mimeType: string, 
  keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {
  
  try {
    const ai = getAiClient(keys);

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        clientName: { type: Type.STRING, description: "Nombre comercial o razón social del proveedor. NO incluyas 'Factura' o 'Recibo' en el nombre." },
        amount: { type: Type.NUMBER, description: "Monto total a pagar final." },
        currency: { type: Type.STRING, description: "Código de moneda ej. USD, EUR, PAB" },
        date: { type: Type.STRING, description: "Fecha de emisión en formato YYYY-MM-DD. Si no hay año, asume el actual." },
        concept: { type: Type.STRING, description: "Descripción breve de QUÉ se compró (ej. 'Almuerzo de negocios', 'Laptop', 'Uber'). NO repetir el nombre del proveedor." }
      },
      required: ["clientName", "amount", "currency", "concept"]
    };

    const prompt = `Analiza este documento (imagen o PDF) y actúa como un asistente contable preciso.
    
    Tus objetivos:
    1. **Proveedor**: Identifica quién emite la factura (ej. "Doit Center", "Uber", "Restaurante El Trapiche").
    2. **Concepto**: Resume la lista de ítems o el servicio prestado. Sé conciso. (ej. "Materiales de construcción", "Transporte", "Cena con cliente").
    3. **Fecha**: Busca la fecha de la transacción.
    4. **Total**: El monto final pagado.
    
    Si el documento es ilegible o no es una factura, devuelve null.`;

    const response = await ai.models.generateContent({
      model: GEMINI_VISION_MODEL_ID,
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: mimeType } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    if (response.text) {
       const cleaned = cleanJson(response.text);
       const data = JSON.parse(cleaned);
       return { ...data, detectedType: 'Expense' } as ParsedInvoiceData;
    }
    return null;

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return null;
  }
};

export const parseInvoiceRequest = async (input: string, keys?: AiKeys): Promise<ParsedInvoiceData | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                concept: { type: Type.STRING },
                detectedType: { type: Type.STRING, enum: ['Invoice', 'Quote'] }
            },
            required: ['clientName', 'amount', 'currency', 'concept', 'detectedType']
        };

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: input,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });

        if (response.text) {
            const cleaned = cleanJson(response.text);
            return JSON.parse(cleaned);
        }
        return null;
    } catch (e) {
        console.error("Parse Invoice Request Error:", e);
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};

export const askSupportBot = async (message: string, keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: message,
            config: { systemInstruction: "Eres un asistente de soporte técnico amigable y servicial para la plataforma Kônsul Bills." }
        });
        return response.text || "No entendí, ¿puedes repetir?";
    } catch(e) {
        return "Lo siento, no puedo responder ahora mismo. (Error de conexión IA)";
    }
};

export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys): Promise<CatalogItem[]> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                },
                required: ['name', 'price', 'description']
            }
        };
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Sugiere 3-5 servicios o productos con precios estimados para este negocio: ${businessDescription}. Precios realistas en USD.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        
        const text = response.text || "[]";
        const cleaned = cleanJson(text);
        const items = JSON.parse(cleaned);
        
        return items.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random(), isRecurring: false }));
    } catch (e) {
        console.error("Suggest Catalog Error:", e);
        return [];
    }
};

export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Genera una plantilla de correo ${tone} para enviar una factura a un cliente. Solo el cuerpo del correo, sin asunto. Manténlo breve y profesional.`,
        });
        return response.text || "";
    } catch(e) {
        console.error("Generate Email Error:", e);
        return tone === 'Formal' ? "Estimado cliente, adjunto encontrará su factura. Saludos cordiales." : "Hola! Aquí tienes tu factura. Gracias!";
    }
};

export const testAiConnection = async (provider: 'gemini' | 'openai', key: string): Promise<boolean> => {
    if (provider === 'gemini') {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            await ai.models.generateContent({ model: GEMINI_MODEL_ID, contents: "Hi" });
            return true;
        } catch { return false; }
    }
    // OpenAI mock implementation
    return true; 
};

export const generateFinancialAnalysis = async (summary: string, keys?: AiKeys): Promise<FinancialAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                healthScore: { type: Type.NUMBER },
                healthStatus: { type: Type.STRING, enum: ['Excellent', 'Good', 'Fair', 'Critical'] },
                diagnosis: { type: Type.STRING },
                actionableTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                projection: { type: Type.STRING }
            },
            required: ['healthScore', 'healthStatus', 'diagnosis', 'actionableTips', 'projection']
        };
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Analiza este resumen financiero y actúa como un CFO experto: ${summary}`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        
        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) { 
        console.error("Analysis Error:", e);
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null; 
    }
};

export const generateDeepDiveReport = async (title: string, context: string, keys?: AiKeys): Promise<DeepDiveReport | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                chartTitle: { type: Type.STRING },
                executiveSummary: { type: Type.STRING },
                keyMetrics: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: {
                            label: { type: Type.STRING },
                            value: { type: Type.STRING },
                            trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
                        }
                    }
                },
                strategicInsight: { type: Type.STRING },
                recommendation: { type: Type.STRING }
            },
            required: ['chartTitle', 'executiveSummary', 'keyMetrics', 'strategicInsight', 'recommendation']
        };
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Generate a deep dive analysis report for the chart titled "${title}". Context data: ${context}`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch { return null; }
};

export const analyzePriceMarket = async (itemName: string, country: string, keys?: AiKeys): Promise<PriceAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                minPrice: { type: Type.NUMBER },
                maxPrice: { type: Type.NUMBER },
                avgPrice: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                reasoning: { type: Type.STRING }
            },
            required: ['minPrice', 'maxPrice', 'avgPrice', 'currency', 'reasoning']
        };
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Analyze market price for "${itemName}" in ${country}. Provide estimated range and reasoning.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null; 
    }
};

export const enhanceProductDescription = async (desc: string, name: string, format: 'paragraph' | 'bullets', keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Improve and expand the sales description for product "${name}". Original description: "${desc}". Format as ${format}. Language: Spanish.`,
        });
        return response.text || desc;
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return desc; 
    }
};

export const getDiscountRecommendation = async (
    amount: number, 
    clientName: string, 
    keys?: AiKeys
): Promise<{ recommendedRate: number, reasoning: string } | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                recommendedRate: { type: Type.NUMBER, description: "Porcentaje recomendado (0-100)" },
                reasoning: { type: Type.STRING, description: "Breve justificación en Español (max 15 palabras)" }
            },
            required: ['recommendedRate', 'reasoning']
        };
        
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como asesor de ventas. Recomienda un descuento prudente para cerrar una venta de $${amount} con el cliente "${clientName}".
            Reglas:
            - Si el monto es bajo (<$500), sugiere 0% o 5%.
            - Si es alto, puedes sugerir hasta 10-15%.
            - Prioriza la rentabilidad.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        
        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};
