
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ParsedInvoiceData, CatalogItem, FinancialAnalysisResult, PriceAnalysisResult, DeepDiveReport } from "../types";

const GEMINI_MODEL_ID = "gemini-2.5-flash";
const OPENAI_MODEL_ID = "gpt-3.5-turbo";

export const AI_ERROR_BLOCKED = "AI_BLOCKED_MISSING_KEYS";

export interface AiKeys {
  gemini?: string;
  openai?: string;
}

// --- CORE: DUAL AI EXECUTOR ---

/**
 * Executes an AI request.
 * CRITICAL COST CONTROL LOGIC:
 * 1. If `keys` arg is UNDEFINED -> Assumes Onboarding/Public context -> Uses System ENV Key.
 * 2. If `keys` arg IS PROVIDED (User Context) -> STRICTLY uses User Keys. NO FALLBACK to System Key.
 */
const generateWithFallback = async (
  prompt: string, 
  systemInstruction: string,
  responseSchema: Schema | undefined, // Google Schema Type
  keys?: AiKeys,
  jsonMode: boolean = false
): Promise<string | null> => {
  
  let geminiKey = "";
  let openAiKey = "";
  let isUserContext = false;

  if (keys) {
    // USER CONTEXT: Strict Mode
    isUserContext = true;
    geminiKey = keys.gemini || "";
    openAiKey = keys.openai || "";
    
    // If user is authenticated but has NO keys, block the request immediately.
    if (!geminiKey && !openAiKey) {
      console.warn("⛔ [AI Blocked] User has not configured any API Keys.");
      return AI_ERROR_BLOCKED;
    }
    console.log("👤 [AI Request] Using USER API Key");
  } else {
    // SYSTEM CONTEXT (Onboarding): Fallback allowed
    geminiKey = process.env.API_KEY || "";
    console.log("🏢 [AI Request] Using SYSTEM API Key (Onboarding)");
  }

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

  // 2. TRY OPENAI (FALLBACK) - Only if user provided it
  if (openAiKey) {
    try {
      console.log("🔄 Switching to OpenAI Fallback...");
      
      // Adapt Prompt for OpenAI
      let finalSystemPrompt = systemInstruction;
      if (jsonMode) {
        finalSystemPrompt += `\n\nIMPORTANT: You MUST return strictly valid JSON.`;
        if (responseSchema) {
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
  if (result === AI_ERROR_BLOCKED) throw new Error(AI_ERROR_BLOCKED);
  if (!result) return null;
  
  try {
    return JSON.parse(result) as ParsedInvoiceData;
  } catch (e) {
    console.error("JSON Parse Error", e);
    return null;
  }
};

export const parseExpenseImage = async (
  imageBase64: string, 
  mimeType: string, 
  keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {
  
  if (keys) {
    if (!keys.gemini) {
      console.warn("BLOCKED: Vision requires Gemini Key");
      throw new Error(AI_ERROR_BLOCKED);
    }
  }

  const geminiKey = keys?.gemini || process.env.API_KEY;
  if (!geminiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
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
          { inlineData: { data: imageBase64, mimeType: mimeType } },
          { text: "Analiza esta imagen de recibo/factura y extrae los datos clave en JSON. Si no es legible, devuelve null." }
        ]
      },
      config: { responseMimeType: "application/json", responseSchema: schema }
    });

    if (response.text) {
       const data = JSON.parse(response.text);
       return { ...data, detectedType: 'Expense' } as ParsedInvoiceData;
    }
    return null;

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return null;
  }
};

export const askSupportBot = async (query: string, keys?: AiKeys): Promise<string> => {
  const systemPrompt = `Eres 'ZenBot', el agente de soporte nivel 1 de Kônsul Bills. 
  Tu tono es súper amigable, simple y empático. 
  Mantén las respuestas cortas y usa emojis. Responde siempre en Español.`;

  const result = await generateWithFallback(query, systemPrompt, undefined, keys, false);
  if (result === AI_ERROR_BLOCKED) return "⚠️ Mis funciones de IA están en pausa. Por favor configura tu API Key en Ajustes para reactivarme.";
  return result || "Lo siento, no pude procesar eso.";
};

export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys): Promise<CatalogItem[]> => {
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: { name: { type: Type.STRING }, price: { type: Type.NUMBER } }
    }
  };
  const systemPrompt = `Genera 3 ítems de servicios/productos estándar para el negocio descrito.`;
  const result = await generateWithFallback(businessDescription, systemPrompt, schema, keys, true);
  if (result === AI_ERROR_BLOCKED) return [];
  if (!result) return [];

  try {
    const items = JSON.parse(result) as any[];
    return items.map((item, idx) => ({
      id: `cat-${idx}-${Date.now()}`,
      name: item.name,
      price: item.price
    }));
  } catch (e) { return []; }
};

export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', keys?: AiKeys): Promise<string> => {
  const prompt = tone === 'Formal' 
    ? "Genera un cuerpo de email en Español, breve y profesional, para enviar factura. Placeholder: [Cliente]."
    : "Genera un cuerpo de email en Español, breve y amigable, para enviar factura. Placeholder: [Cliente].";
  const result = await generateWithFallback(prompt, "Eres un redactor.", undefined, keys, false);
  return result || "Adjunto encontrarás la factura.";
};

export const generateFinancialAnalysis = async (financialSummary: string, keys?: AiKeys): Promise<FinancialAnalysisResult | null> => {
  const schema: Schema = {
     type: Type.OBJECT,
     properties: {
       healthScore: { type: Type.INTEGER, description: "0-100 score based on margins and growth" },
       healthStatus: { type: Type.STRING, enum: ['Excellent', 'Good', 'Fair', 'Critical'] },
       diagnosis: { type: Type.STRING, description: "Breve resumen ejecutivo de la situación (2 frases)." },
       actionableTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 acciones concretas y numéricas para mejorar." },
       projection: { type: Type.STRING, description: "Predicción corta a 3 meses." }
     },
     required: ["healthScore", "healthStatus", "diagnosis", "actionableTips", "projection"]
  };
  const systemPrompt = `Actúa como un CFO (Director Financiero) experto para PyMES y autónomos. 
  Analiza los siguientes datos financieros reales del usuario. 
  Sé crítico pero constructivo. No uses generalidades, basa tus consejos en los números proporcionados.
  Si los gastos son altos, sugiere cortes. Si el margen es bajo, sugiere subir precios.`;
  
  const result = await generateWithFallback(financialSummary, systemPrompt, schema, keys, true);
  if (result === AI_ERROR_BLOCKED) throw new Error(AI_ERROR_BLOCKED);
  if (!result) return null;
  try { return JSON.parse(result) as FinancialAnalysisResult; } catch (e) { return null; }
};

export const generateDeepDiveReport = async (chartTitle: string, dataContext: string, keys?: AiKeys): Promise<DeepDiveReport | null> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      chartTitle: { type: Type.STRING },
      executiveSummary: { type: Type.STRING, description: "Explicación breve de qué muestra este gráfico realmente." },
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
      strategicInsight: { type: Type.STRING, description: "Análisis profundo de la causa raíz de estos números." },
      recommendation: { type: Type.STRING, description: "Una acción táctica inmediata para mejorar estos resultados." }
    },
    required: ["executiveSummary", "keyMetrics", "strategicInsight", "recommendation"]
  };
  
  const systemPrompt = `Eres un Auditor Financiero Senior. 
  Analiza el dataset proporcionado para el gráfico "${chartTitle}".
  Identifica patrones ocultos, anomalías o éxitos.
  Tu respuesta debe ser muy específica a los datos (menciona meses, clientes o montos si es relevante).
  No inventes datos, usa solo lo provisto en el contexto.`;

  const result = await generateWithFallback(`Contexto: "${dataContext}"`, systemPrompt, schema, keys, true);
  if (result === AI_ERROR_BLOCKED) throw new Error(AI_ERROR_BLOCKED);
  if (!result) return null;
  try { return { ...JSON.parse(result), chartTitle } as DeepDiveReport; } catch (e) { return null; }
};

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
  const result = await generateWithFallback(`Producto: "${productName}". País: "${country}".`, "Eres un analista de mercado.", schema, keys, true);
  if (result === AI_ERROR_BLOCKED) throw new Error(AI_ERROR_BLOCKED);
  if (!result) return null;
  try { return JSON.parse(result) as PriceAnalysisResult; } catch (e) { return null; }
};

export const enhanceProductDescription = async (currentDesc: string, productName: string, format: 'paragraph' | 'bullets', keys?: AiKeys): Promise<string> => {
  const result = await generateWithFallback(`Producto: "${productName}". Borrador: "${currentDesc}". Formato: ${format}.`, "Actúa como copywriter.", undefined, keys, false);
  if (result === AI_ERROR_BLOCKED) return "⚠️ Error: Configura tu API Key en Ajustes para usar esta función.";
  return result || currentDesc;
};
