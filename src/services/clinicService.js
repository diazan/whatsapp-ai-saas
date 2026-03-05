const prisma = require("../lib/prisma");

const getClinicByPhoneNumberId = async (phoneNumberId) => {
  return prisma.clinic.findUnique({
    where: { phoneNumberId }
  });
};

module.exports = {
  getClinicByPhoneNumberId,
};