# 🔌 Guía de Integración API: KônsulBills + LeadsHUB (Suite de IA & CRM)

KônsulBills cuenta con una **API REST pública y flexible** expuesta a través de Vercel Serverless Functions (`/api/v1/...`). Esta API permite a **LeadsHUB** (tu hub de chatbots con IA, CRM y WhatsApp), así como a cualquier otra herramienta externa (Zapier, n8n, scripts, etc.), consultar, crear y gestionar facturas, cotizaciones, clientes, catálogo y métricas sin ninguna restricción.

---

## 🔐 Autenticación

Todas las solicitudes deben incluir la clave de API (API Key) o el ID de usuario mediante alguno de los siguientes métodos en los Headers HTTP:

- **Header HTTP Recomendado:** `x-api-key: TU_API_KEY`
- **Header Authorization:** `Authorization: Bearer TU_API_KEY`
- **Header Opcional para Usuario:** `x-user-id: ID_DEL_USUARIO` (Por defecto utiliza el perfil activo del workspace).

> **Nota:** Puedes configurar la variable de entorno `KONSUL_API_KEY` en Vercel/.env. Si estás en modo desarrollo o demo, responderá usando el usuario principal.

---

## 🚀 Endpoints Disponibles

### 1. Documentos (Facturas, Cotizaciones y Gastos)

#### **`POST /api/v1/invoices`** (Crear Factura o Cotización)
Ideal para que tu Agente de IA en LeadsHUB genere una cotización o factura directamente desde un chat de WhatsApp o Webchat.

**Ejemplo de Payload Simplificado (Para Agentes de IA):**
```json
{
  "clientName": "Juan Pérez",
  "clientEmail": "juan@empresa.com",
  "total": 150.00,
  "concept": "Diseño de Landing Page y Agente de IA",
  "type": "Invoice", 
  "status": "Creada",
  "currency": "USD"
}
```

**Ejemplo de Payload Completo (Con Ítems y Recurrencia):**
```json
{
  "clientName": "Acme Corp",
  "clientTaxId": "155700-1-12345",
  "clientEmail": "contacto@acme.com",
  "type": "Invoice",
  "status": "Enviada",
  "currency": "USD",
  "items": [
    { "description": "Licencia Mensual LeadsHUB", "quantity": 1, "price": 200, "tax": 14 }
  ],
  "isRecurrent": true,
  "frequency": "MONTHLY",
  "totalCycles": 12
}
```

#### **`GET /api/v1/invoices`** (Consultar Documentos)
Permite buscar facturas por cliente, estado o tipo.
- Query Parameters: `?status=Creada&type=Invoice&search=Juan&limit=20`

#### **`PUT /api/v1/invoices`** (Actualizar Estado)
Permite marcar una factura como `Pagada`, `Aceptada` o `Incobrable` desde LeadsHUB.
```json
{
  "id": "FAC-0001",
  "status": "Pagada"
}
```

---

### 2. Clientes y Prospectos (CRM Sync)

#### **`POST /api/v1/clients`** (Crear o Actualizar Cliente / Prospecto)
Permite que LeadsHUB registre automáticamente un prospecto de WhatsApp en KônsulBills.
```json
{
  "name": "María Rodríguez",
  "email": "maria@cliente.com",
  "phone": "+50761234567",
  "status": "PROSPECT",
  "tags": "VIP, WhatsApp Lead",
  "notes": "Cliente interesado en agente de ventas"
}
```

#### **`GET /api/v1/clients`** (Consultar Lista de Clientes)
- Query Parameters: `?status=CLIENT` o `?search=María`

---

### 3. Catálogo de Productos y Servicios

#### **`GET /api/v1/catalog`**
Obtiene todos los servicios y precios configurados en KônsulBills para que el Agente de IA sepa cuánto cotizar.

#### **`POST /api/v1/catalog`**
Agrega o actualiza un ítem en el catálogo.

---

### 4. Resumen y Métricas Financieras (Para Consultas de IA)

#### **`GET /api/v1/summary`**
Devuelve las métricas consolidadas en tiempo real:
```json
{
  "success": true,
  "summary": {
    "totalInvoiced": 4500.00,
    "totalPaid": 3200.00,
    "totalPending": 1300.00,
    "totalQuoted": 800.00,
    "totalExpenses": 450.00,
    "netBalance": 2750.00,
    "counts": {
      "invoicesCount": 12,
      "quotesCount": 3,
      "clientsCount": 15
    }
  }
}
```

---

### 5. Webhook e Integración Directa con LeadsHUB

#### **`POST /api/v1/leadshub`**
Puedes configurar esta URL (`https://tu-dominio-konsulbills.com/api/v1/leadshub`) como Webhook en LeadsHUB o Meta/WhatsApp.

Recibe eventos automáticos:
- `lead.created` -> Crea un prospecto automáticamente en KônsulBills.
- `invoice.create` -> Genera la factura en tiempo real.

---

## 🤖 Ejemplo de Integración en LeadsHUB (Next.js / OpenAI Function Calling)

Agrega esta herramienta en tu proyecto `chatbot-v2-interno` dentro del contexto del Agente de IA para que pueda facturar de forma autónoma:

```typescript
// lib/tools/konsulBillsTool.ts en LeadsHUB
export const konsulBillsTools = [
  {
    name: "create_invoice",
    description: "Crea una factura o cotización para un cliente en KônsulBills",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Nombre del cliente" },
        clientEmail: { type: "string", description: "Correo electrónico" },
        amount: { type: "number", description: "Monto total a cobrar" },
        concept: { type: "string", description: "Concepto o descripción del servicio" },
        type: { type: "string", enum: ["Invoice", "Quote"], description: "Invoice para factura, Quote para cotización" }
      },
      required: ["clientName", "amount", "concept"]
    }
  }
];

export async function executeKonsulBillsTool(name: string, args: any) {
  if (name === "create_invoice") {
    const res = await fetch("https://tu-konsulbills.vercel.app/api/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.KONSUL_API_KEY || ""
      },
      body: JSON.stringify({
        clientName: args.clientName,
        clientEmail: args.clientEmail,
        total: args.amount,
        concept: args.concept,
        type: args.type || "Invoice",
        status: "Creada"
      })
    });
    return await res.json();
  }
}
```

---

## 🛠️ Comprobación y Despliegue

Todos los endpoints han sido construidos usando funciones Serverless de Vercel y son desplegados automáticamente con cada push a la rama `main`.
