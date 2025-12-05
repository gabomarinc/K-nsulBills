
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedInvoiceData, CatalogItem, FinancialAnalysisResult, PriceAnalysisResult, DeepDiveReport } from "../types";

const modelId = "gemini-2.5-flash";

const getAiClient = (apiKey?: string) => {
  // Use user provided key or fallback to system env key
  const key = apiKey || process.env.API_KEY;
  if (!key) {
    console.warn("No API Key available for Gemini Service");
  }
  return new GoogleGenAI({ apiKey: key });
};

// --- OPEN AI HELPER ---
const callOpenAI = async (query: string, apiKey: string): Promise<string> => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Use a standard model
        messages: [
          {
            role: "system",
            content: "Eres 'ZenBot', el agente de soporte nivel 1 de FacturaZen. Tu tono es súper amigable, simple y empático. FacturaZen tiene: Offline-first, Smart AI Wizard. Si el usuario menciona 'error', 'caída', 'AFIP', 'SAT' o 'impuestos', sugiere el botón 'Hablar con Humano' inmediatamente. Mantén las respuestas cortas y usa emojis. Responde siempre en Español."
          },
          { role: "user", content: query }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("OpenAI Error:", error);
    throw error;
  }
};

/**
 * Parses natural language input into structured data, detecting intent (Invoice vs Quote).
 * currently prioritizes Gemini for structured JSON output capabilities.
 */
export const parseInvoiceRequest = async (input: string, apiKey?: string): Promise<ParsedInvoiceData | null> => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Eres un asistente contable experto. Analiza esta solicitud: "${input}". 
      Extrae los detalles de la transacción.
      
      Reglas:
      1. Si el usuario menciona "cotización", "presupuesto", o "quote", define detectedType como 'Quote'. De lo contrario 'Invoice'.
      2. Si falta la moneda, infiérela del contexto (ej. 'pesos' -> MXN/ARS según lo común, '$' -> USD). Default USD.
      3. Resume el concepto claramente en Español.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING, description: "Nombre del cliente/empresa. Si no se sabe, dejar vacío." },
            concept: { type: Type.STRING, description: "Descripción clara del servicio/producto." },
            amount: { type: Type.NUMBER, description: "Monto total. Si no se sabe, usar 0." },
            currency: { type: Type.STRING, description: "Código de moneda ej. USD, EUR, MXN" },
            detectedType: { type: Type.STRING, enum: ['Invoice', 'Quote', 'Expense'] }
          },
          required: ["clientName", "amount", "concept", "detectedType"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedInvoiceData;
  } catch (error) {
    console.error("Error parsing with Gemini:", error);
    return null;
  }
};

/**
 * Level 1 Support Bot with Fallback Strategy.
 * Priority: 
 * 1. Gemini (User Key or System Key)
 * 2. OpenAI (User Key)
 */
export const askSupportBot = async (query: string, apiKeys?: { gemini?: string, openai?: string }): Promise<string> => {
  let errorLog = [];

  // STRATEGY 1: TRY GEMINI (Primary)
  try {
    const geminiKey = apiKeys?.gemini || process.env.API_KEY;
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: query,
        config: {
          systemInstruction: `Eres 'ZenBot', el agente de soporte nivel 1 de FacturaZen. 
          Tu tono es súper amigable, simple y empático. 
          Características de FacturaZen: Offline-first, Asistente IA Inteligente.
          Si el usuario menciona "error", "crash", "AFIP", "SAT", o "impuestos", sugiere el botón "Hablar con Humano" inmediatamente.
          Mantén las respuestas cortas y usa emojis. Responde siempre en Español.`,
        }
      });
      if (response.text) return response.text;
    }
  } catch (error) {
    console.warn("Gemini Failed, attempting fallback...", error);
    errorLog.push("Gemini Error");
  }

  // STRATEGY 2: TRY OPENAI (Fallback)
  if (apiKeys?.openai) {
    try {
      console.log("Attempting OpenAI Fallback...");
      return await callOpenAI(query, apiKeys.openai);
    } catch (error) {
      console.warn("OpenAI Failed", error);
      errorLog.push("OpenAI Error");
    }
  }

  // FAILURE
  return "Lo siento 😓. Mis circuitos de IA (Google y OpenAI) están saturados o no configurados. Por favor intenta más tarde o usa el botón de emergencia.";
};

/**
 * Suggest catalog items based on business description.
 */
export const suggestCatalogItems = async (businessDescription: string, apiKey?: string): Promise<CatalogItem[]> => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Genera 3 ítems de servicios o productos estándar para un negocio descrito como: "${businessDescription}". 
      Retorna los nombres en Español y precios razonables en USD.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER }
            }
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) return [];
    
    const items = JSON.parse(text) as any[];
    return items.map((item, idx) => ({
      id: `cat-${idx}-${Date.now()}`,
      name: item.name,
      price: item.price
    }));

  } catch (error) {
    console.error("Catalog suggestion error:", error);
    return [];
  }
};

/**
 * Generate email templates based on tone.
 */
export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', apiKey?: string): Promise<string> => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = tone === 'Formal' 
      ? "Genera un único ejemplo de cuerpo de correo electrónico en Español, muy breve y profesional, para enviar una factura adjunta. Usa [Cliente] como placeholder. No incluyas asunto, solo el mensaje."
      : "Genera un único ejemplo de cuerpo de correo electrónico en Español, breve, amigable y con emojis, para enviar una factura adjunta. Usa [Cliente] como placeholder. No incluyas asunto, solo el mensaje.";

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Hola [Cliente], aquí tienes tu factura.";
  } catch (error) {
    return "Adjunto encontrarás la factura correspondiente.";
  }
};

/**
 * Generate comprehensive financial analysis based on data summary.
 * Returns structured JSON for visual rendering.
 */
export const generateFinancialAnalysis = async (financialSummary: string, apiKey?: string): Promise<FinancialAnalysisResult | null> => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Eres un CFO Virtual experto para pequeñas empresas. Analiza este resumen financiero:
      "${financialSummary}"
      
      Genera un análisis estructurado en JSON en Español.
      - healthScore: Entero de 0 a 100.
      - healthStatus: Uno de 'Excellent', 'Good', 'Fair', 'Critical'.
      - diagnosis: Una frase corta e impactante resumiendo la situación.
      - actionableTips: Array de 3 consejos específicos y cortos.
      - projection: Una predicción corta para el próximo mes.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
        }
      }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as FinancialAnalysisResult;

  } catch (error) {
    console.error("Financial Analysis Error:", error);
    return null;
  }
};

/**
 * Generates a specific, deep-dive report for a single chart.
 */
export const generateDeepDiveReport = async (
  chartTitle: string, 
  dataContext: string, 
  apiKey?: string
): Promise<DeepDiveReport | null> => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Actúa como Analista Financiero Senior. Analiza los siguientes datos específicos del gráfico "${chartTitle}":
      "${dataContext}"
      
      Genera un reporte ejecutivo detallado pero conciso en JSON (Español).
      - executiveSummary: Párrafo de 3-4 líneas resumiendo lo observado.
      - keyMetrics: Array de 3 métricas clave extraídas o calculadas (label, value, trend: 'up'|'down'|'neutral').
      - strategicInsight: Un insight profundo sobre qué significa esto para el negocio.
      - recommendation: Una acción concreta y estratégica.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return { ...JSON.parse(text), chartTitle } as DeepDiveReport; // Ensure title matches

  } catch (error) {
    console.error("Deep Dive Report Error:", error);
    return null;
  }
};

/**
 * Analyzes market prices for a specific product/service in a given location.
 */
export const analyzePriceMarket = async (productName: string, country: string, apiKey?: string): Promise<PriceAnalysisResult | null> => {
  try {
    const ai = getAiClient(apiKey);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Eres un analista de mercado experto. 
      Estima el rango de precios para el producto/servicio: "${productName}" en el país: "${country}".
      Usa datos reales aproximados del mercado actual.
      Devuelve los precios en la moneda local de ${country} o en USD si es volátil.
      
      Output JSON:
      - minPrice: Precio bajo mercado.
      - maxPrice: Precio alto mercado.
      - avgPrice: Precio promedio recomendado.
      - currency: Código de moneda (MXN, USD, EUR, etc).
      - reasoning: Explicación muy breve (máx 15 palabras) de por qué ese precio.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            minPrice: { type: Type.NUMBER },
            maxPrice: { type: Type.NUMBER },
            avgPrice: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["minPrice", "maxPrice", "avgPrice", "currency", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as PriceAnalysisResult;

  } catch (error) {
    console.error("Price Analysis Error:", error);
    return null;
  }
};

/**
 * Enhances a product description using AI to make it professional and persuasive.
 */
export const enhanceProductDescription = async (
  currentDesc: string, 
  productName: string, 
  format: 'paragraph' | 'bullets' = 'paragraph', 
  apiKey?: string
): Promise<string> => {
  try {
    const ai = getAiClient(apiKey);
    const prompt = `Actúa como un copywriter de ventas profesional.
      Reescribe y mejora la siguiente descripción para un presupuesto/factura.
      Producto: "${productName}".
      Borrador actual: "${currentDesc}".
      Formato deseado: "${format === 'bullets' ? 'Lista de viñetas (bullets) con caracteristicas clave' : 'Párrafo persuasivo corto'}".
      
      Instrucciones:
      - Hazlo profesional, persuasivo y claro.
      - Si es lista, usa guiones o bullets unicode bonitos.
      - Si es párrafo, máximo 3 oraciones.
      - En Español neutro.
      - Devuelve SOLO el texto mejorado, sin comillas ni introducciones.`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || currentDesc;
  } catch (error) {
    console.error("Description enhancement error:", error);
    return currentDesc;
  }
};
