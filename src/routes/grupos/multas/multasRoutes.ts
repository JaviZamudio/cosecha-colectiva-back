import { Router } from "express";
import { pagar_multas, get_multas_activas_por_grupo, multas_sesion_socio,get_multas_socio_sesion } from "../../../controllers/multas_control";
import { authAdmin, authSocioGrupo } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/multas
const router = Router({ mergeParams: true });

//Ver multas por sesion por socio por grupo
router.get("/", authSocioGrupo, multas_sesion_socio);
router.get("/:Sesion_id", authSocioGrupo, get_multas_socio_sesion);
//Ver multas por grupo
router.post("/", authAdmin, get_multas_activas_por_grupo);

// Pagar multas
router.patch("/", authAdmin, pagar_multas);

export { router as multasRoutes };