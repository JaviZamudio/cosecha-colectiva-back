import { Router } from "express";
import { crear_acuerdos, crear_acuerdo_secundario,obtener_acuerdos } from "../../../controllers/acuerdos_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/:Grupo_id/acuerdos
const router = Router({ mergeParams: true });

router.get("/", authAdmin, obtener_acuerdos);
// Crear acuerdos para un grupo
router.post("/", authAdmin, crear_acuerdos);
// Crear acuerdos secundarios para un grupo
router.post("/secundarios", authAdmin, crear_acuerdo_secundario);

export { router as acuerdosRoutes };