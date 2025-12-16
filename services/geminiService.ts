
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CatalogItem, FinancialAnalysisResult, DeepDiveReport, ParsedInvoiceData, PriceAnalysisResult, UserProfile } from "../types";

export const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';
const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const GEMINI_VISION_MODEL_ID = 'gemini-2.5-flash-image';

export interface AiKeys {
  gemini?: string;
  openai?: string;
}

// Modified to accept a permission flag for using the system/env key
const getAiClient = (keys?: AiKeys, allowSystemFallback: boolean = false) => {
  // Priority 1: User's provided key
  if (keys?.gemini) {
      return new GoogleGenAI({ apiKey: keys.gemini });
  }

  // Priority 2: System Key (ONLY if explicitly allowed, e.g. for Onboarding Wizard)
  if (allowSystemFallback) {
      // Check multiple sources for the API key to ensure Vercel/Vite compatibility
      let systemKey = process.env.API_KEY || process.env.VITE_API_KEY;
      
      // Try import.meta.env if available (Client-side Vite)
      if (!systemKey && typeof import.meta !== 'undefined' && (import.meta as any).env) {
          systemKey = (import.meta as any).env.VITE_API_KEY;
      }

      if (systemKey) {
          return new GoogleGenAI({ apiKey: systemKey });
      }
  }
  
  // If no user key and (system key not allowed OR system key missing)
  console.error("Gemini AI Error: Missing User API Key. System fallback is " + (allowSystemFallback ? "enabled but key missing" : "disabled") + ".");
  throw new Error(AI_ERROR_BLOCKED);
};

// Helper to sanitize JSON response from LLM
const cleanJson = (text: string) => {
  if (!text) return "{}";
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  return cleaned;
};

// --- APP FEATURES (Strict Mode: User Key Only) ---

export const parseExpenseImage = async (
  imageBase64: string, 
  mimeType: string, 
  keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {
  
  try {
    const ai = getAiClient(keys, false); // Strict: No System Key

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
        const ai = getAiClient(keys, false); // Strict: No System Key
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
        const ai = getAiClient(keys, false); // Strict: No System Key
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: message,
            config: { systemInstruction: "Eres un asistente de soporte técnico amigable y servicial para la plataforma Kônsul Bills." }
        });
        return response.text || "No entendí, ¿puedes repetir?";
    } catch(e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) return "Por favor configura tu API Key de IA en Ajustes para hablar conmigo.";
        return "Lo siento, no puedo responder ahora mismo. (Error de conexión IA)";
    }
};

// --- ONBOARDING FEATURES (Allow System Key) ---

export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys, useSystemKey: boolean = false): Promise<CatalogItem[]> => {
    try {
        // ALLOW System Key fallback here
        const ai = getAiClient(keys, useSystemKey);
        
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

export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', keys?: AiKeys, useSystemKey: boolean = false): Promise<string> => {
    try {
        // ALLOW System Key fallback here
        const ai = getAiClient(keys, useSystemKey);
        
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

// --- APP FEATURES (Strict Mode Continued) ---

export const testAiConnection = async (provider: 'gemini' | 'openai', key: string): Promise<boolean> => {
    if (provider === 'gemini') {
        try {
            // Direct instantiation to test the specific key provided
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
        const ai = getAiClient(keys, false); // Strict: No System Key
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
        const ai = getAiClient(keys, false); // Strict: No System Key
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

export const analyzePriceMarket = async (
    itemName: string, 
    country: string, 
    keys?: AiKeys,
    userContext?: UserProfile // NEW: Context-aware pricing
): Promise<PriceAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys, false); // Strict: No System Key
        
        // Build User Context String
        let contextPrompt = `Ubicación: ${country}.`;
        if (userContext) {
            const isCompany = userContext.type.includes('Empresa') || userContext.fiscalConfig?.entityType === 'JURIDICA';
            const annualRevenue = userContext.fiscalConfig?.annualRevenue || 0;
            
            contextPrompt += ` El vendedor es un perfil ${isCompany ? 'Empresarial/Corporativo' : 'Freelance/Independiente'}. `;
            contextPrompt += `Nivel de facturación anual aprox: $${annualRevenue.toLocaleString()}. `;
            
            if (!isCompany || annualRevenue < 20000) {
                contextPrompt += "ESTRATEGIA: Sugiere precios competitivos y accesibles para ganar mercado.";
            } else {
                contextPrompt += "ESTRATEGIA: Sugiere precios de mercado estándar o premium según calidad.";
            }
        }

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                minPrice: { type: Type.NUMBER, description: "Precio mínimo viable en el mercado local" },
                maxPrice: { type: Type.NUMBER, description: "Precio máximo (premium)" },
                avgPrice: { type: Type.NUMBER, description: "Precio recomendado para este perfil específico" },
                currency: { type: Type.STRING, description: "Moneda (USD para Panamá)" },
                reasoning: { type: Type.STRING, description: "Breve explicación del precio sugerido basada en el perfil del usuario." }
            },
            required: ['minPrice', 'maxPrice', 'avgPrice', 'currency', 'reasoning']
        };

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como un experto en precios para el mercado de ${country}. ${contextPrompt}
            
            Analiza el precio de mercado para el servicio/producto: "${itemName}".
            Devuelve un rango realista en USD.`,
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
        const ai = getAiClient(keys, false); // Strict: No System Key
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
        const ai = getAiClient(keys, false); // Strict: No System Key
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

// NEW: Short Strategic Insight for Dashboard
export const generateRevenueInsight = async (
    currentRevenue: number, 
    prevRevenue: number, 
    percentChange: number,
    keys?: AiKeys
): Promise<string | null> => {
    try {
        const ai = getAiClient(keys, false); // Strict: No System Key
        
        const trend = percentChange > 0 ? "positiva" : (percentChange < 0 ? "negativa" : "neutral");
        const context = `Mes Actual: $${currentRevenue}. Mes Anterior: $${prevRevenue}. Variación: ${percentChange.toFixed(1)}%.`;

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Eres un CFO. Dados estos datos: ${context}.
            Genera una frase ESTRATÉGICA y CORTA (máximo 10 palabras) sobre la tendencia ${trend}.
            Ejemplo positivo: "Crecimiento sólido, reinvierte en captación."
            Ejemplo negativo: "Caída leve, activa promociones para cerrar mes."
            NO digas "Basado en los datos". Sé directo.`,
        });
        
        return response.text?.trim() || null;
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) return null;
        return null;
    }
};
