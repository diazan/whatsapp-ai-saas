// backend/api/oauth/callback.ts
import express, { Request, Response } from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const code = req.body.code as string | undefined;
    if (!code) {
      return res.status(400).json({ error: "No se recibió el code" });
    }

    console.log("Code recibido:", code);

    // ✅ Sin redirect_uri — el flujo es por popup, no por redirect real
    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          code,
        },
      }
    );

    const access_token: string = tokenResponse.data.access_token;
    console.log("Access token obtenido:", access_token.slice(0, 20) + "...");

    // ✅ Endpoint correcto para WABAs vinculadas al token
    const wabaResponse = await axios.get(
      "https://graph.facebook.com/v19.0/me/whatsapp_business_accounts",
      {
        params: { access_token },
      }
    );

    console.log("WABAs encontradas:", JSON.stringify(wabaResponse.data, null, 2));

    const waba_id: string | undefined = wabaResponse.data.data?.[0]?.id;
    if (!waba_id) {
      return res.status(400).json({
        error: "No se encontró WABA",
        // Devuelve el raw para que puedas debuggear qué llegó
        raw: wabaResponse.data,
      });
    }

    // Obtener Phone Number ID
    const phoneResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`,
      {
        params: { access_token },
      }
    );

    console.log("Números encontrados:", JSON.stringify(phoneResponse.data, null, 2));

    const phone_number_id: string | undefined =
      phoneResponse.data.data?.[0]?.id;
    if (!phone_number_id) {
      return res.status(400).json({
        error: "No se encontró número de teléfono del WABA",
        raw: phoneResponse.data,
      });
    }

    return res.json({ access_token, waba_id, phone_number_id });

  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      // ✅ Log completo para debuggear errores de Graph API
      console.error(
        "Error Graph API:",
        JSON.stringify(err.response?.data, null, 2) || err.message
      );
      return res.status(500).json({
        error: "Error en flujo OAuth",
        details: err.response?.data || err.message,
      });
    }

    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Error OAuth:", message);
    return res.status(500).json({ error: "Error en flujo OAuth", details: message });
  }
});

export default router;