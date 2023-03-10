import { Router } from "express";
import { pagar_multas, get_multas_activas_por_grupo, multas_sesion_socio } from "../../../controllers/multas_control";
import { authAdmin, authSocioGrupo } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/multas
const router = Router({ mergeParams: true });

//Ver multas por sesion por socio por grupo
router.get("/", authSocioGrupo, multas_sesion_socio);
//Ver multas por grupo
router.post("/", authAdmin, get_multas_activas_por_grupo);

// Pagar multas
router.patch("/", authAdmin, pagar_multas);

export { router as multasRoutes };