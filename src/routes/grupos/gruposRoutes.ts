import { Router } from "express";
import { crear_grupo, get_info_grupo, num_telefono } from "../../controllers/grupos_control";
import { authSocio, authSocioGrupo } from "../../middleware/auth";
import { sociosRoutes } from "./socios/sociosRoutes";
import { acuerdosRoutes } from "./acuerdos/acuerdosRoutes";
import { multasRoutes } from "./multas/multasRoutes";
import { sesionesRoutes } from "./sesiones/sesionesRoutes";
import { prestamosRoutes } from "./prestamos/prestamosRoutes";
import { accionesRoutes } from "./acciones/accionesRoutes";

const router = Router({ mergeParams: true });

// Crear un grupo
router.post("/", authSocio, crear_grupo);
//obtener telefono
router.get("/telefono", authSocio, num_telefono);
// Obten un grupo
router.get("/:Grupo_id", authSocioGrupo, get_info_grupo);

// Sub-Recursos
router.use("/:Grupo_id/acuerdos", acuerdosRoutes);
router.use("/:Grupo_id/multas", multasRoutes);
router.use("/:Grupo_id/sesiones", sesionesRoutes);
router.use("/:Grupo_id/socios", sociosRoutes);
router.use("/:Grupo_id/prestamos", prestamosRoutes);
router.use("/:Grupo_id/acciones", accionesRoutes);

export { router as gruposRoutes };