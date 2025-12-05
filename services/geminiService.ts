
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ParsedInvoiceData, CatalogItem, FinancialAnalysisResult, PriceAnalysisResult, DeepDiveReport } from "../types";

const GEMINI_MODEL_ID = "gemini-2.5-flash";
const OPENAI_MODEL_ID = "gpt-3.5-turbo";

export interface AiKeys {
  gemini?: string;
  openai?: string;
}

// --- CORE: DUAL AI EXECUTOR ---

/**
 * Executes an AI request with Fallback Strategy.
 * Priority: 1. Gemini -> 2. OpenAI
 */
const generateWithFallback = async (
  prompt: string, 
  systemInstruction: string,
  responseSchema: Schema | undefined, // Google Schema Type
  keys?: AiKeys,
  jsonMode: boolean = false
): Promise<string | null> => {
  
  const geminiKey = keys?.gemini || process.env.API_KEY;
  const openAiKey = keys?.openai;

  // 1. TRY GEMINI (PRIMARY)
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const config: any = {
        systemInstruction: systemInstruction,
      };

      if (jsonMode && responseSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = responseSchema;
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_ID,
        contents: prompt,
        config: config
      });

      if (response.text) return response.text;
    } catch (error) {
      console.warn("⚠️ Gemini Failed. Attempting Fallback...", error);
    }
  }

  // 2. TRY OPENAI (FALLBACK)
  if (openAiKey) {
    try {
      console.log("🔄 Switching to OpenAI Fallback...");
      
      // Adapt Prompt for OpenAI (Append Schema info if JSON is needed, as OpenAI handles schemas differently)
      let finalSystemPrompt = systemInstruction;
      if (jsonMode) {
        finalSystemPrompt += `\n\nIMPORTANT: You MUST return strictly valid JSON.`;
        if (responseSchema) {
           // We simplify the schema structure to text for OpenAI to understand
           finalSystemPrompt += `\nOutput structure must match this schema description: ${JSON.stringify(responseSchema)}`;
        }
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL_ID,
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: prompt }
          ],
          // Force JSON mode if supported by model, otherwise rely on prompt
          response_format: jsonMode ? { type: "json_object" } : undefined 
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || null;

    } catch (error) {
      console.error("❌ OpenAI Fallback Failed:", error);
    }
  }

  console.error("⛔ All AI Providers failed or no keys provided.");
  return null;
};


// --- PUBLIC METHODS ---

/**
 * Simple connection test to verify API Key validity
 */
export const testAiConnection = async (provider: 'gemini' | 'openai', key: string): Promise<boolean> => {
  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: GEMINI_MODEL_ID,
        contents: "Hello",
      });
      return true;
    } 
    
    if (provider === 'openai') {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      });
      return response.ok;
    }
    return false;
  } catch (e) {
    console.error("Connection Test Failed", e);
    return false;
  }
};

/**
 * Parses natural language input into structured data.
 */
export const parseInvoiceRequest = async (input: string, keys?: AiKeys): Promise<ParsedInvoiceData | null> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      clientName: { type: Type.STRING, description: "Nombre del cliente/empresa. Si no se sabe, dejar vacío." },
      concept: { type: Type.STRING, description: "Descripción clara del servicio/producto." },
      amount: { type: Type.NUMBER, description: "Monto total numerico. Si no se sabe, usar 0." },
      currency: { type: Type.STRING, description: "Código de moneda ej. USD, EUR, MXN" },
      detectedType: { type: Type.STRING, enum: ['Invoice', 'Quote', 'Expense'] },
      date: { type: Type.STRING, description: "Fecha en formato ISO YYYY-MM-DD si se menciona." }
    },
    required: ["clientName", "amount", "concept", "detectedType"],
  };

  const systemPrompt = `Eres un asistente contable experto. Analiza la solicitud del usuario y extrae los datos.
  Reglas:
  1. Si menciona "gasto", "compra" o "pagué" -> 'Expense'.
  2. Si menciona "cotización" o "presupuesto" -> 'Quote'. De lo contrario 'Invoice'.
  3. Infiere moneda (USD default).
  4. Resume el concepto en Español.`;

  const result = await generateWithFallback(input, systemPrompt, schema, keys, true);
  if (!result) return null;
  
  try {
    return JSON.parse(result) as ParsedInvoiceData;
  } catch (e) {
    console.error("JSON Parse Error", e);
    return null;
  }
};

/**
 * PARSE EXPENSE RECEIPT (IMAGE/VISION)
 * Uses Gemini Vision capabilities
 */
export const parseExpenseImage = async (
  imageBase64: string, 
  mimeType: string, 
  keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {
  const geminiKey = keys?.gemini || process.env.API_KEY;
  if (!geminiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    // Schema for vision output
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        clientName: { type: Type.STRING, description: "Nombre del proveedor/comercio." },
        amount: { type: Type.NUMBER, description: "Total a pagar." },
        currency: { type: Type.STRING, description: "Código de moneda ej. USD" },
        date: { type: Type.STRING, description: "Fecha del recibo en YYYY-MM-DD" },
        concept: { type: Type.STRING, description: "Breve descripción de los ítems comprados (ej. Cena, Gasolina, Software)." }
      },
      required: ["clientName", "amount", "currency", "concept"]
    };

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_ID,
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType
            }
          },
          {
            text: "Analiza esta imagen de recibo/factura y extrae los datos clave en JSON. Si no es legible, devuelve null."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    if (response.text) {
       const data = JSON.parse(response.text);
       return {
         ...data,
         detectedType: 'Expense'
       } as ParsedInvoiceData;
    }
    return null;

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return null;
  }
};

/**
 * Level 1 Support Bot
 */
export const askSupportBot = async (query: string, keys?: AiKeys): Promise<string> => {
  const systemPrompt = `Eres 'ZenBot', el agente de soporte nivel 1 de FacturaZen. 
  Tu tono es súper amigable, simple y empático. 
  Características de FacturaZen: Offline-first, Asistente IA Inteligente, Resiliencia.
  Si el usuario menciona "error", "crash", "AFIP", "SAT", o "impuestos", sugiere el botón "Hablar con Humano".
  Mantén las respuestas cortas y usa emojis. Responde siempre en Español.`;

  const result = await generateWithFallback(query, systemPrompt, undefined, keys, false);
  return result || "Lo siento 😓. Mis circuitos de IA están desconectados. Por favor revisa tus API Keys en Ajustes.";
};

/**
 * Suggest catalog items based on business description.
 */
export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys): Promise<CatalogItem[]> => {
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        price: { type: Type.NUMBER }
      }
    }
  };

  const systemPrompt = `Genera 3 ítems de servicios/productos estándar para el negocio descrito. 
  Retorna nombres en Español y precios razonables en USD.`;

  const result = await generateWithFallback(businessDescription, systemPrompt, schema, keys, true);
  if (!result) return [];

  try {
    const items = JSON.parse(result) as any[];
    return items.map((item, idx) => ({
      id: `cat-${idx}-${Date.now()}`,
      name: item.name,
      price: item.price
    }));
  } catch (e) {
    return [];
  }
};

/**
 * Generate email templates based on tone.
 */
export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', keys?: AiKeys): Promise<string> => {
  const systemPrompt = `Eres un asistente de redacción comercial.`;
  const prompt = tone === 'Formal' 
    ? "Genera un cuerpo de email en Español, breve y muy profesional, para enviar una factura. Usa [Cliente] como placeholder. Sin asunto."
    : "Genera un cuerpo de email en Español, breve, amigable y con emojis, para enviar una factura. Usa [Cliente] como placeholder. Sin asunto.";

  const result = await generateWithFallback(prompt, systemPrompt, undefined, keys, false);
  return result || "Adjunto encontrarás la factura correspondiente.";
};

/**
 * Generate comprehensive financial analysis.
 */
export const generateFinancialAnalysis = async (financialSummary: string, keys?: AiKeys): Promise<FinancialAnalysisResult | null> => {
  const schema: Schema = {
     type: Type.OBJECT,
     properties: {
       healthScore: { type: Type.INTEGER },
       healthStatus: { type: Type.STRING, enum: ['Excellent', 'Good', 'Fair', 'Critical'] },
       diagnosis: { type: Type.STRING },
       actionableTips: { 
         type: Type.ARRAY, 
         items: { type: Type.STRING } 
       },
       projection: { type: Type.STRING }
     },
     required: ["healthScore", "healthStatus", "diagnosis", "actionableTips", "projection"]
  };

  const systemPrompt = `Eres un CFO Virtual. Analiza el resumen financiero proveido.
  Genera:
  - healthScore: 0-100.
  - healthStatus: Enum.
  - diagnosis: Frase impactante.
  - actionableTips: 3 consejos cortos.
  - projection: Predicción corta.
  Responde en Español.`;

  const result = await generateWithFallback(financialSummary, systemPrompt, schema, keys, true);
  if (!result) return null;

  try {
    return JSON.parse(result) as FinancialAnalysisResult;
  } catch (e) {
    return null;
  }
};

/**
 * Generates a specific, deep-dive report for a single chart.
 */
export const generateDeepDiveReport = async (
  chartTitle: string, 
  dataContext: string, 
  keys?: AiKeys
): Promise<DeepDiveReport | null> => {
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
    required: ["executiveSummary", "keyMetrics", "strategicInsight", "recommendation"]
  };

  const systemPrompt = `Actúa como Analista Financiero Senior. Analiza los datos del gráfico provisto.
  Genera un reporte ejecutivo en Español.`;
  
  const prompt = `Gráfico: "${chartTitle}". Datos: "${dataContext}"`;

  const result = await generateWithFallback(prompt, systemPrompt, schema, keys, true);
  if (!result) return null;

  try {
    return { ...JSON.parse(result), chartTitle } as DeepDiveReport;
  } catch (e) {
    return null;
  }
};

/**
 * Analyzes market prices.
 */
export const analyzePriceMarket = async (productName: string, country: string, keys?: AiKeys): Promise<PriceAnalysisResult | null> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      minPrice: { type: Type.NUMBER },
      maxPrice: { type: Type.NUMBER },
      avgPrice: { type: Type.NUMBER },
      currency: { type: Type.STRING },
      reasoning: { type: Type.STRING }
    },
    required: ["minPrice", "maxPrice", "avgPrice", "currency", "reasoning"]
  };

  const systemPrompt = `Eres un analista de mercado. Estima rango de precios reales.`;
  const prompt = `Producto: "${productName}". País: "${country}". Return JSON.`;

  const result = await generateWithFallback(prompt, systemPrompt, schema, keys, true);
  if (!result) return null;

  try {
    return JSON.parse(result) as PriceAnalysisResult;
  } catch (e) {
    return null;
  }
};

/**
 * Enhances a product description.
 */
export const enhanceProductDescription = async (
  currentDesc: string, 
  productName: string, 
  format: 'paragraph' | 'bullets' = 'paragraph', 
  keys?: AiKeys
): Promise<string> => {
  const systemPrompt = `Actúa como copywriter de ventas profesional. Mejora la descripción. Español neutro.`;
  const prompt = `Producto: "${productName}". Borrador: "${currentDesc}". Formato: ${format}.`;

  const result = await generateWithFallback(prompt, systemPrompt, undefined, keys, false);
  return result || currentDesc;
};
