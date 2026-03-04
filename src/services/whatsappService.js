const axios = require("axios");

const sendWhatsAppMessage = async ({
  accessToken,
  phoneNumberId,
  to,
  message,
}) => {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
};

module.exports = {
  sendWhatsAppMessage,
};