import { Router } from "express";
import { crear_sesion, enviar_inasistencias_sesion, finalizar_sesion, registrar_retardos, agendar_sesion, get_lista_socios, get_conteo_dinero, get_sesiones_grupo, recoger_firma, get_firma } from "../../../controllers/sesiones_control";
import { authAdmin, authSocioGrupo } from "../../../middleware/auth";
import { get_info_his_mul } from "../../../controllers/multas_control";
import { get_info_his_pres } from "../../../controllers/prestamos_control";

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
// Informacion historica sobre las multas que a tenido un socio en un grupo
router.get("/sesiones/multas", authSocioGrupo, get_info_his_mul );
// Informacion historica sobre los prestamos que a tenido un socio en un grupo
router.get("/sesiones/prestamos", authSocioGrupo, get_info_his_pres );
// Registrar retardos de la sesion activa
router.post("/retardos", authAdmin, registrar_retardos);
// finalizar sesion activa
router.post("/finalizar", authAdmin, finalizar_sesion);
// Agendar sesion
router.post("/agendar", authAdmin, agendar_sesion);
// Recoger firma de usuario en la sesion
router.post("/socios/:Socio_id/firma", authAdmin, recoger_firma);
// Obtener una firma de usuario en una sesion
router.get("/:Sesion_id/socios/:Socio_id/firma", authAdmin, get_firma);

export { router as sesionesRoutes };