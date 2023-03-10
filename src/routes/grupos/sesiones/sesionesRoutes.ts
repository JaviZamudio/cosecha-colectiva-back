import { Router } from "express";
import { crear_sesion, enviar_inasistencias_sesion, finalizar_sesion, registrar_retardos, agendar_sesion, get_lista_socios, get_conteo_dinero, get_sesiones_grupo, recoger_firma } from "../../../controllers/sesiones_control";
import { authAdmin, authSocioGrupo } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/sesiones
const router = Router({ mergeParams: true });

// Crear una sesion
router.post("/", authAdmin, crear_sesion);
// Obtener inasistencias de la sesion activa
router.get("/lista", authAdmin, get_lista_socios);
// Obtener inasistencias de la sesion activa
router.get("/inasistencias", authAdmin, enviar_inasistencias_sesion );
// Obtener inasistencias de la sesion activa
router.get("/conteo", authAdmin, get_conteo_dinero );
// Obtener las sesiones por grupo
router.get("/sesiones", authSocioGrupo, get_sesiones_grupo );
// Registrar retardos de la sesion activa
router.post("/retardos", authAdmin, registrar_retardos);
// finalizar sesion activa
router.post("/finalizar", authAdmin, finalizar_sesion);
// Agendar sesion
router.post("/agendar", authAdmin, agendar_sesion);
// Recoger firma de usuario en la sesion
router.post("/socios/:Socio_id/firma", authAdmin, recoger_firma);

export { router as sesionesRoutes };