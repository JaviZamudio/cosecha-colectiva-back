import { Router } from "express";
import { registrar_compra_acciones } from "../../../controllers/acciones_control";
import { crear_multa } from "../../../controllers/multas_control";
import { crear_prestamo } from "../../../controllers/prestamos_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/socios
const router = Router({ mergeParams: true });

// Crear multa a un socio
router.post("/:Socio_id/multas", authAdmin, crear_multa);
// Crear prestamo a un socio
router.post("/:Socio_id/prestamos", authAdmin, crear_prestamo);
// Comprar acciones
router.post("/:Socio_id/acciones", authAdmin, registrar_compra_acciones);

export { router as sociosRoutes }