console.log("🔥 CLINIC SERVICE FILE CARGADO");

const prisma = require("../lib/prisma");

const getClinicByPhoneNumberId = async (phoneNumberId) => {

  console.log("🔍 incomingPhoneNumberId:", phoneNumberId);
  console.log("🔍 typeof incomingPhoneNumberId:", typeof phoneNumberId);

  const clinic = await prisma.clinic.findUnique({
    where: { phoneNumberId }
  });

  console.log("🔎 Clinic result:", clinic);

  return clinic;
};

module.exports = {
  getClinicByPhoneNumberId,
};