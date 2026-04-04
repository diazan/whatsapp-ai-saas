const axios = require("axios");

function stripEmojis(text) {
  return text.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
}

/**
 * Obtiene todos los productos del catálogo de Meta
 */
async function getCatalogProducts({ catalogId, accessToken }) {
  const url = `https://graph.facebook.com/v19.0/${catalogId}/products`;

  const response = await axios.get(url, {
    params: {
      fields: "id,name,retailer_id",
      access_token: accessToken
    }
  });

  return response.data.data; // array de productos
}

/**
 * Envía el catálogo completo como product_list al usuario
 */
async function sendCatalogMessage({ clinic, to, sendMessage }) {
  try {
    const products = await getCatalogProducts({
      catalogId: clinic.catalogId,
      accessToken: clinic.accessToken
    });

    console.log("Productos obtenidos:", JSON.stringify(products, null, 2));

    if (!products || products.length === 0) {
      return sendMessage(
        "No hay productos disponibles en el catálogo en este momento.\n\n" +
        "0️⃣ Volver al menú principal"
      );
    }

    const title = clinic.servicesTitle || "📦 Nuestros servicios";
    const titleClean = stripEmojis(title);

    // product_list requiere al menos 1 sección con al menos 1 producto
    const productItems = products.map(p => ({
      product_retailer_id: p.retailer_id
    }));

    const body = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: title
        },
        body: {
          text: clinic.catalogDescription || "Explora nuestros productos y servicios disponibles 👇"
        },
        action: {
          catalog_id: clinic.catalogId,
          sections: [
            {
              title: clinic.name || "Nuestros servicios",
              product_items: productItems
            }
          ]
        }
      }
    };

    const url = `https://graph.facebook.com/v19.0/${clinic.phoneNumberId}/messages`;

    console.log("Body enviado a Meta:", JSON.stringify(body, null, 2));

    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${clinic.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.data?.messages?.[0]?.id) {
      throw new Error("Meta no confirmó el envío del catálogo");
    }

    return; // sendMessage no se usa — axios envía directamente

  } catch (error) {
    console.error("❌ Error enviando catálogo:", error?.response?.data || error.message);

    return sendMessage(
      "Ocurrió un error al cargar el catálogo. Intenta nuevamente más tarde.\n\n" +
      "0️⃣ Volver al menú principal"
    );
  }
}

module.exports = { sendCatalogMessage };