import { Router } from "express";
import { registrar_compra_acciones, retiro_acciones } from "../../../controllers/acciones_control";
import { crear_multa } from "../../../controllers/multas_control";
import { crear_prestamo, get_prestamos_nopagados_socio } from "../../../controllers/prestamos_control";
import { retirar_ganancias } from "../../../controllers/socios_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/socios
const router = Router({ mergeParams: true });

// Obtener los prestamos no pagados de un socio
router.get("/:Socio_id/prestamos", authAdmin, get_prestamos_nopagados_socio);
// Crear multa a un socio
router.post("/:Socio_id/multas", authAdmin, crear_multa);
// Crear prestamo a un socio
router.post("/:Socio_id/prestamos", authAdmin, crear_prestamo);
// Comprar acciones
router.post("/:Socio_id/acciones", authAdmin, registrar_compra_acciones);
// Retirar acciones
router.post("/:Socio_id/acciones/retirar", authAdmin, retiro_acciones);
// Retirar ganancias
router.patch("/:Socio_id/ganancias", authAdmin, retirar_ganancias)

export { router as sociosRoutes }