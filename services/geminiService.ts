
import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { CatalogItem, FinancialAnalysisResult, DeepDiveReport, ParsedInvoiceData, PriceAnalysisResult, UserProfile } from "../types";

export const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';
const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const GEMINI_VISION_MODEL_ID = 'gemini-2.5-flash';
const TIMEOUT_MS = 25000; // 25 seconds timeout

export interface AiKeys {
    gemini?: string;
    openai?: string;
}

// --- UTILS ---

// Wrapper to enforce timeout on AI calls
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = TIMEOUT_MS): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Tiempo de espera agotado. La IA tardó demasiado en responder.")), timeoutMs)
        )
    ]);
};

// Modified to accept a permission flag for using the system/env key
const getAiClient = (keys?: AiKeys, allowSystemFallback: boolean = false) => {
    // Priority 1: User's provided key
    if (keys?.gemini) {
        return new GoogleGenAI({ apiKey: keys.gemini });
    }

    // Priority 2: System Key (ONLY if explicitly allowed)
    if (allowSystemFallback) {
        let systemKey = process.env.API_KEY || process.env.VITE_API_KEY;
        if (!systemKey && typeof import.meta !== 'undefined' && (import.meta as any).env) {
            systemKey = (import.meta as any).env.VITE_API_KEY;
        }
        if (systemKey) {
            return new GoogleGenAI({ apiKey: systemKey });
        }
    }

    console.error("Gemini AI Error: Missing User API Key.");
    throw new Error(AI_ERROR_BLOCKED);
};

// Helper to sanitize JSON response from LLM
const cleanJson = (text: string) => {
    if (!text) return "{}";

    // 1. Try to extract JSON from Markdown code blocks first
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
        return jsonBlockMatch[1].trim();
    }

    // 2. Fallback: Cleanup common markdown artifacts
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // 3. Find brackets to strip introductory text
    const firstOpen = cleaned.indexOf('{');
    const lastClose = cleaned.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1) {
        cleaned = cleaned.substring(firstOpen, lastClose + 1);
    }

    return cleaned.trim();
};

// --- APP FEATURES (Strict Mode: User Key Only) ---

export const parseExpenseImage = async (
    imageBase64: string,
    mimeType: string,
    keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {

    try {
        const ai = getAiClient(keys, false);

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                date: { type: Type.STRING },
                concept: { type: Type.STRING }
            },
            required: ["clientName", "amount", "currency", "concept"]
        };

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_VISION_MODEL_ID,
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType: mimeType } },
                    {
                        text: `
            Analiza este documento (Recibo/Factura) extractivamente.
            
            EXTRAE:
            - clientName: Nombre comercial del proveedor o emisor.
            - amount: Total final a pagar (float).
            - currency: Moneda (USD, PAB, EUR). Asume USD si es ambiguo o $.
            - date: Fecha de emisión (YYYY-MM-DD). Usa la fecha actual si no es legible.
            - concept: Descripción breve (max 5 palabras) de qué se pagó (ej. "Almuerzo Cliente", "Uber", "Suscripción Software").
            
            Si es una factura fiscal válida de Panamá (tiene RUC, DV), prioriza extraer esos datos con precisión.
            Responder SOLO JSON PLANO.
          ` }
                ]
            },
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

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
        const ai = getAiClient(keys, false);
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

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: input,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        if (response.text) {
            const cleaned = cleanJson(response.text);
            return JSON.parse(cleaned);
        }
        return null;
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};

export const askSupportBot = async (message: string, keys?: AiKeys, context?: string): Promise<string> => {
    try {
        const ai = getAiClient(keys, false);
        const systemPrompt = `
        Eres "Bill Bot", un asesor financiero experto y amigable para freelancers y PyMEs en la plataforma Kônsul Bills.
        
        OBJETIVO:
        Ayudar al usuario a entender sus finanzas, cobrar mejor y organizar su negocio.
        Responde de forma concisa, proactiva y motivadora.
        
        CONTEXTO FINANCIERO ACTUAL DEL USUARIO:
        "${context || 'No hay datos financieros disponibles aún.'}"
        
        SI EL USUARIO PREGUNTA SOBRE SUS DATOS:
        Usa el contexto proporcionado para dar respuestas precisas.
        Ejemplo: "Tienes $500 pendientes de cobro, te sugiero enviar recordatorios."
        
        SI EL USUARIO SALUDA:
        Preséntate brevemente como su asesor financiero y menciona un dato clave de su resumen si es relevante.
        `;

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: message,
            config: { systemInstruction: systemPrompt }
        }));
        return response.text || "No entendí, ¿puedes repetir?";
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) return "Por favor configura tu API Key de IA en Ajustes para hablar conmigo.";
        return "Lo siento, estoy teniendo problemas de conexión. Intenta más tarde.";
    }
};

// --- ONBOARDING FEATURES (Allow System Key) ---

export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys, useSystemKey: boolean = false): Promise<CatalogItem[]> => {
    try {
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
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Sugiere 3-5 servicios o productos con precios estimados para: ${businessDescription}. Precios en USD.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

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
        const ai = getAiClient(keys, useSystemKey);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Genera una plantilla de correo ${tone} para enviar una factura a un cliente. Solo el cuerpo del correo.`,
        }));
        return response.text || "";
    } catch (e) {
        return tone === 'Formal' ? "Estimado cliente, adjunto su factura." : "Hola! Aquí tienes tu factura.";
    }
};

// --- APP FEATURES (Strict Mode Continued) ---

export const testAiConnection = async (provider: 'gemini' | 'openai', key: string): Promise<boolean> => {
    if (provider === 'gemini') {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            await withTimeout(ai.models.generateContent({ model: GEMINI_MODEL_ID, contents: "Hi" }), 5000);
            return true;
        } catch { return false; }
    }
    return true;
};

export const generateFinancialAnalysis = async (summary: string, keys?: AiKeys): Promise<FinancialAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys, false);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                healthScore: { type: Type.NUMBER },
                // Use standard string to avoid validation strictness, prompt will enforce values
                healthStatus: { type: Type.STRING },
                diagnosis: { type: Type.STRING },
                actionableTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                projection: { type: Type.STRING }
            },
            required: ['healthScore', 'healthStatus', 'diagnosis', 'actionableTips', 'projection']
        };
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Eres un Auditor Financiero Senior (CFO Virtual) para negocios en Panamá.
            Tu misión es analizar la salud financiera comparando los RESULTADOS REALES contra las METAS DEFINIDAS por el usuario.
            
            DATOS DE LA EMPRESA:
            ${summary}
            
            INSTRUCCIONES CRÍTICAS:
            1. Compara explícitamente lo facturado contra la "Meta Mensual Definida". Si está por debajo, sé severo.
            2. Revisa si los "Gastos Totales" superan a los "Costos Fijos".
            3. Ajusta el tono según si es "Persona Natural" (más personal) o "Sociedad" (más corporativo).
            4. 'healthStatus' DEBE ser exactamente una de estas palabras: 'Excelente', 'Buena', 'Regular', 'Crítica'.
            5. 'healthScore' es un número de 0 a 100 basado en el cumplimiento de metas.
            6. 'projection': Una predicción corta basada en la tendencia actual.
            
            Responde SOLO en JSON válido.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        const cleaned = cleanJson(response.text || "{}");
        const result = JSON.parse(cleaned);

        // Safety Fallback for Enums
        const validStatuses = ['Excelente', 'Buena', 'Regular', 'Crítica'];
        if (!validStatuses.includes(result.healthStatus)) {
            result.healthStatus = 'Regular';
        }

        return result;
    } catch (e) {
        console.error("Analysis Error:", e);
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};

export const generateDeepDiveReport = async (title: string, context: string, keys?: AiKeys): Promise<DeepDiveReport | null> => {
    try {
        const ai = getAiClient(keys, false);
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

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como Analista Financiero Senior. Genera un reporte profundo para el gráfico: "${title}".
            
            CONTEXTO DE DATOS:
            ${context}
            
            INSTRUCCIONES:
            - 'executiveSummary': Resumen de 1 párrafo.
            - 'keyMetrics': 3 métricas clave.
            - 'strategicInsight': Análisis de tendencias.
            - 'recommendation': Acción táctica.
            - Idioma: Español (excepto 'trend').
            - IMPORTANTE: 'trend' debe ser obligatoriamente 'up', 'down' o 'neutral'.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        const cleaned = cleanJson(response.text || "{}");
        const parsed = JSON.parse(cleaned);
        if (!parsed.chartTitle) return null;
        return parsed;
    } catch (e) {
        console.error("Deep Dive Error:", e);
        return null;
    }
};

export const analyzePriceMarket = async (
    itemName: string,
    country: string,
    keys?: AiKeys,
    userContext?: UserProfile
): Promise<PriceAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys, false);

        let contextPrompt = `Ubicación: ${country}.`;
        if (userContext) {
            contextPrompt += ` Perfil: ${userContext.type}.`;
        }

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

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como experto en precios. ${contextPrompt} Analiza: "${itemName}". Devuelve rangos en USD.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};

export const enhanceProductDescription = async (desc: string, name: string, format: 'paragraph' | 'bullets', keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys, false);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Mejora esta descripción de venta para "${name}": "${desc}". Formato: ${format}. Idioma: Español.`,
        }));
        return response.text || desc;
    } catch (e) {
        return desc;
    }
};

export const getDiscountRecommendation = async (
    amount: number,
    clientName: string,
    keys?: AiKeys
): Promise<{ recommendedRate: number, reasoning: string } | null> => {
    try {
        const ai = getAiClient(keys, false);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                recommendedRate: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
            },
            required: ['recommendedRate', 'reasoning']
        };

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Recomienda un descuento para venta de $${amount} a "${clientName}". Prioriza rentabilidad.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
};

export const generateRevenueInsight = async (
    currentRevenue: number,
    prevRevenue: number,
    percentChange: number,
    keys?: AiKeys
): Promise<string | null> => {
    try {
        const ai = getAiClient(keys, false);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Eres un CFO. Datos: Mes Actual $${currentRevenue}, Anterior $${prevRevenue}, Var ${percentChange}%.
            Genera una frase ESTRATÉGICA y CORTA (max 10 palabras).`,
        }));
        return response.text?.trim() || null;
    } catch (e) {
        return null;
    }
};
