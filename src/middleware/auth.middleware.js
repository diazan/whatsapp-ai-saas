const { verifyToken } = require("../lib/jwt");
const prisma = require("../lib/prisma");

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token);

    if (!decoded || !decoded.clinicId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // ✅ Validar que la clínica siga activa
    const clinic = await prisma.clinic.findUnique({
      where: { id: decoded.clinicId },
    });

    if (!clinic || clinic.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // ✅ Inyectar clínica en request
    req.clinic = clinic;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = {
  authenticateAdmin,
};