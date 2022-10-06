import { Router } from "express";
import { crear_sesion, enviar_inasistencias_sesion, finalizar_sesion, registrar_retardos } from "../../../controllers/sesiones_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/sesiones
const router = Router({ mergeParams: true });

// Crear una sesion
router.post("/", authAdmin, crear_sesion);
// Obtener inasistencias de la sesion activa
router.get("/inasistencias", authAdmin, enviar_inasistencias_sesion );
// Registrar retardos de la sesion activa
router.post("/retardos", authAdmin, registrar_retardos);
// finalizar sesion activa
router.post("/finalizar", authAdmin, finalizar_sesion);

export { router as sesionesRoutes };