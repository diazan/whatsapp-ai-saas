const handleSalesBotMessage = async ({
  clinic,
  message,
  patientPhone,
  sendMessage
}) => {

  const text = message.toLowerCase().trim();

  if (text === "hola" || text === "inicio") {
    return sendMessage(
      "👋 Hola, soy el asistente virtual.\n\n" +
      "¿Qué te gustaría hacer?\n\n" +
      "1️⃣ Ver cómo funciona el sistema\n" +
      "2️⃣ Agendar una demo\n" +
      "3️⃣ Hablar con un asesor"
    );
  }

  if (text === "1") {
    return sendMessage(
      "Nuestro sistema permite:\n\n" +
      "✅ Agendamiento automático 24/7\n" +
      "✅ Recordatorios automáticos\n" +
      "✅ Confirmación y cancelación por WhatsApp\n" +
      "✅ Panel de control con métricas\n\n" +
      "Escribe *inicio* para volver al menú."
    );
  }

  if (text === "2") {
    return sendMessage(
      "Perfecto ✅\n\n" +
      "Para agendar una demo personalizada, responde con:\n\n" +
      "📅 La fecha deseada (DD/MM/AAAA)"
    );
  }

  if (text === "3") {
    return sendMessage(
      "Un asesor se pondrá en contacto contigo pronto ✅"
    );
  }

  return sendMessage(
    "Escribe *inicio* para comenzar."
  );
};

module.exports = {
  handleSalesBotMessage
};