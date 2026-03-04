const prisma = require("../lib/prisma");

const getClinicByPhoneNumberId = async (phoneNumberId) => {
  return await prisma.clinic.findUnique({
    where: {
      phoneNumberId,
    },
  });
};

module.exports = {
  getClinicByPhoneNumberId,
};