import express, { Request, Response } from "express";
import axios from "axios";

const router = express.Router();

// Definimos la forma del body que esperamos
interface OAuthRequestBody {
  code?: string;
}

router.post("/", async (req: Request<{}, {}, OAuthRequestBody>, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "No se recibió code" });
    }

    const redirect_uri = "https://www.kerbo.co/api/oauth/callback";

    // Intercambiamos el code por access_token
    const tokenResponse = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri,
        code,
      },
    });

    const access_token = tokenResponse.data.access_token as string;

    // Obtenemos WABA del usuario
    const wabaResponse = await axios.get(`https://graph.facebook.com/v19.0/me/businesses`, {
      params: { access_token },
    });

    const waba_id = wabaResponse.data.data?.[0]?.id as string | undefined;
    if (!waba_id) {
      return res.status(400).json({ error: "No se encontró WABA asociado al usuario" });
    }

    // Obtenemos phone_number_id
    const phoneResponse = await axios.get(`https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`, {
      params: { access_token },
    });

    const phone_number_id = phoneResponse.data.data?.[0]?.id as string | undefined;
    if (!phone_number_id) {
      return res.status(400).json({ error: "No se encontró número de teléfono asociado al WABA" });
    }

    return res.json({ access_token, waba_id, phone_number_id });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error("Error OAuth Axios:", err.response?.data || err.message);
      return res.status(500).json({
        error: "Error en flujo OAuth",
        details: err.response?.data || err.message,
      });
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