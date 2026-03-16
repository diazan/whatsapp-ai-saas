const axios = require("axios");

const GRAPH_API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const sendWhatsAppMessage = async ({
  accessToken,
  phoneNumberId,
  to,
  message,
}) => {
    console.log("==== TOKEN DEBUG ====");
  console.log("accessToken VALUE:", accessToken);
  console.log("accessToken LENGTH:", accessToken?.length);
  console.log("=====================");
  try {
    // ✅ Validaciones básicas para evitar errores silenciosos
    if (!accessToken) {
      console.error("❌ Missing accessToken");
      return { success: false, error: "Missing accessToken" };
    }

    if (!phoneNumberId) {
      console.error("❌ Missing phoneNumberId");
      return { success: false, error: "Missing phoneNumberId" };
    }

    if (!to) {
      console.error("❌ Missing recipient number (to)");
      return { success: false, error: "Missing recipient number" };
    }

    if (!message) {
      console.error("❌ Missing message body");
      return { success: false, error: "Missing message body" };
    }

    const response = await axios.post(
      `${BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // ✅ evita colgar el server si Meta no responde
      }
    );

    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // ✅ Manejo seguro del error (NUNCA throw)
    const metaError = error.response?.data;
    const status = error.response?.status;

    console.error("❌ WhatsApp API Error:");
    console.error("Status:", status);
    console.error("Response:", metaError || error.message);

    return {
      success: false,
      status,
      error: metaError || error.message,
    };
  }
};


module.exports = {
  sendWhatsAppMessage,
};