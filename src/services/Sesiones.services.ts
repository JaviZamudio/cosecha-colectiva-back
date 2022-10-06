import db from "../config/database";

/**
 * Obtiene la sesion activa de un grupo si es que hay una.
 * @param Grupo_id Id del grupo que tiene la sesion
 * @returns Un objeto de tipo Sesion. TRHOWS COMMON ERROR
 */
export const obtenerSesionActual = async (Grupo_id: number) => {
    let query = "SELECT * FROM sesiones WHERE sesiones.Activa = TRUE AND sesiones.Grupo_id = ? ORDER BY sesiones.Sesion_id DESC LIMIT 1";
    const sesion = (await db.query(query, Grupo_id))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion;
    }

    throw { code: 400, message: "No hay una sesion en curso para el grupo " + Grupo_id };
}

/**
 * Obtiene una sesion en base a su id.
 * @param Sesion_id Id de la sesion a obtener.
 * @returns Un objeto de tipo sesion.
 */
export const obtener_sesion = async (Sesion_id: number) => {
    const sesion = (await db.query(
        "Select * From sesiones where Sesion_id = ?",
        Sesion_id
    ))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion
    }
}

/**
 * Regresa la cantidad de dinero que hay en un grupo al momento de la sesion.
 * @param sesion Puede ser el id de una sesion a buscar o un objeto de tipo Sesion.
 * @returns El campo "caja" de una sesion.
 */
export const obtener_caja_sesion = async (sesion: number | Sesion) => {
    if (typeof sesion === "number") {
        sesion = (await obtener_sesion(sesion))!;
    }

    return sesion.Caja;
}