import { Router } from "express";
import { pagar_multas, get_multas_activas_por_grupo } from "../../../controllers/multas_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/multas
const router = Router({ mergeParams: true });

//Ver multas por grupo
router.get("/", authAdmin, get_multas_activas_por_grupo);

// Pagar multas
router.patch("/", authAdmin, pagar_multas);

export { router as multasRoutes };