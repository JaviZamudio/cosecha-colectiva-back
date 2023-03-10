import { Router } from "express";
import { authSocioGrupo } from "../../../middleware/auth";
import { enviar_costo_acciones, acciones_sesion_socio } from "../../../controllers/acciones_control";

// Router empezando en /api/grupos/:Grupo_id/acciones
const router = Router({ mergeParams: true });

router.get("/costo", enviar_costo_acciones)
//Obtener acciones de un socio por sesion
router.get("/acciones", authSocioGrupo, acciones_sesion_socio)

export { router as accionesRoutes };