import { Router } from "express";
import { get_prestamos_socio_sesion, info_prestamos_general, pagar_prestamos, get_prestamos_nopagados, get_historial_pres_socio_ses } from "../../../controllers/prestamos_control";
import { authAdmin, authSocio } from "../../../middleware/auth";
import { authSocioGrupo } from "../../../middleware/auth";

// Router empezando en /api/grupos/prestamos
const router = Router({ mergeParams: true });

// get obtener el historial de un prestamo en una sesion
router.get("/:Prestamo_id/:Sesion_id", authSocioGrupo, get_prestamos_socio_sesion);

// Pagar prestamos
router.patch("/", authAdmin, pagar_prestamos);

// Obtener la información de un usuario sobre sus prestamos en una sesión
router.patch("/", authSocio, get_prestamos_socio_sesion);
// Obtener Info Prestamos del grupo
router.get("/", authAdmin, info_prestamos_general);
router.get("/socios", authAdmin, get_prestamos_nopagados);
router.get("/:Sesion_id", authAdmin, get_historial_pres_socio_ses);

export { router as prestamosRoutes };
