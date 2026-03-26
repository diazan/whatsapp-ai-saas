// backend/api/oauth/callback.ts
import express, { Request, Response } from "express";
import axios from "axios";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).json({ error: "No se recibió el code" });

    const redirect_uri = "https://www.kerbo.co/api/oauth/callback";

    // Intercambiar code por access_token
    const tokenResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri,
        code,
      },
    });

    const access_token: string = tokenResponse.data.access_token;

    // Obtener WABA asociado
    const wabaResponse = await axios.get("https://graph.facebook.com/v19.0/me/businesses", {
      params: { access_token },
    });

    const waba_id: string | undefined = wabaResponse.data.data?.[0]?.id;
    if (!waba_id) return res.status(400).json({ error: "No se encontró WABA" });

    // Obtener Phone Number ID
    const phoneResponse = await axios.get(`https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`, {
      params: { access_token },
    });

    const phone_number_id: string | undefined = phoneResponse.data.data?.[0]?.id;
    if (!phone_number_id)
      return res.status(400).json({ error: "No se encontró número de teléfono del WABA" });

    return res.json({ access_token, waba_id, phone_number_id });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error("Error Axios OAuth:", err.response?.data || err.message);
      return res.status(500).json({ error: "Error en flujo OAuth", details: err.response?.data || err.message });
    } else if (err instanceof Error) {
      console.error("Error OAuth:", err.message);
      return res.status(500).json({ error: "Error en flujo OAuth", details: err.message });
    } else {
      console.error("Error OAuth desconocido:", err);
      return res.status(500).json({ error: "Error en flujo OAuth", details: "Error desconocido" });
    }
  }
});

export default router;