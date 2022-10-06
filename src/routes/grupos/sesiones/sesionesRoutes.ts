import { Router } from "express";
import { crear_sesion, enviar_inasistencias_sesion, registrar_asistencias, registrar_retardos } from "../../../controllers/sesiones_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/sesiones
const router = Router({ mergeParams: true });

// Crear una sesion
router.post("", authAdmin, crear_sesion);
// Obtener inasistencias de la sesion activa
router.get("/inasistencias", authAdmin, enviar_inasistencias_sesion );
// Registrar retardos de la sesion activa
router.post("/retardos", authAdmin, registrar_retardos);

export { router as sesionesRoutes };