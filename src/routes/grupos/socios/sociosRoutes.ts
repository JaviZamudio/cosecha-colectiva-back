import { Router } from "express";
import { acciones_socio, registrar_compra_acciones, retiro_acciones } from "../../../controllers/acciones_control";
import { crear_multa } from "../../../controllers/multas_control";
import { ampliar_prestamo, crear_prestamo, get_prestamos_nopagados_socio, info_prestamos_ampliables, info_prestamos_socio } from "../../../controllers/prestamos_control";
import { retirar_ganancias, get_usuario_ganancias } from "../../../controllers/socios_control";
import { authAdmin } from "../../../middleware/auth";

// Router empezando en /api/grupos/socios
const router = Router({ mergeParams: true });

// Obtener las ganancias no pagados de un socio
router.get("/ganancias", authAdmin, get_usuario_ganancias);
// Obtener acciones de los socios
router.get("/acciones/retirar", authAdmin, acciones_socio);
// Obtener los prestamos no pagados de un socio
router.get("/:Socio_id/prestamos", authAdmin, get_prestamos_nopagados_socio);
// Obtener info de los prestamos de un socio
router.get("/:Socio_id/prestamos/info", authAdmin, info_prestamos_socio);
// Crear multa a un socio
router.post("/:Socio_id/multas", authAdmin, crear_multa);
// Crear prestamo a un socio
router.post("/:Socio_id/prestamos", authAdmin, crear_prestamo);
// Ampliar un prestamo a un socio
router.post("/:Socio_id/prestamos/prestamos", authAdmin, ampliar_prestamo);
// Obtener los prestamos ampliables de un socio
router.get("/:Socio_id/prestamos/ampliables", authAdmin, info_prestamos_ampliables); // TODO implementar
// Comprar acciones
router.post("/:Socio_id/acciones", authAdmin, registrar_compra_acciones);
// Retirar acciones
router.post("/:Socio_id/acciones/retirar", authAdmin, retiro_acciones);
// Retirar ganancias
router.patch("/:Socio_id/ganancias", authAdmin, retirar_ganancias)

export { router as sociosRoutes }