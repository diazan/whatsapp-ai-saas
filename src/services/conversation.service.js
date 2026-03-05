const prisma = require("../lib/prisma");

const EXPIRATION_MINUTES = 30;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

const getOrCreateConversation = async ({
  clinicId,
  patientPhone,
  patientName
}) => {
  const now = new Date();

  let conversation = await prisma.conversation.findFirst({
    where: {
      clinicId,
      patientPhone,
      active: true
    }
  });

  // Si existe pero expiró
  if (conversation && conversation.expiresAt < now) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        active: false,
        state: "CANCELLED"
      }
    });
    conversation = null;
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        clinicId,
        patientPhone,
        patientName,
        state: "IDLE",
        expiresAt: addMinutes(now, EXPIRATION_MINUTES)
      }
    });
  }

  return conversation;
};

const updateConversation = async (id, data) => {
  return prisma.conversation.update({
    where: { id },
    data: {
      ...data,
      lastMessageAt: new Date(),
      expiresAt: addMinutes(new Date(), EXPIRATION_MINUTES)
    }
  });
};

const closeConversation = async (id, finalState) => {
  return prisma.conversation.update({
    where: { id },
    data: {
      state: finalState,
      active: false
    }
  });
};

module.exports = {
  getOrCreateConversation,
  updateConversation,
  closeConversation
};