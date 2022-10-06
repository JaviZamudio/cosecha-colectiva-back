import { Pool, PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { catch_common_error, existe_socio, obtener_sesion_activa, socio_en_grupo } from "../utils/validaciones";

/**
 * Obtiene la sesion activa de un grupo si es que hay una.
 * @param Grupo_id Id del grupo que tiene la sesion
 * @returns Un objeto de tipo Sesion. TRHOWS COMMON ERROR
 */
export const obtenerSesionActual = async (Grupo_id: number, con?: PoolConnection | Pool) => {
    if (con === undefined) con = db;

    let query = "SELECT * FROM sesiones WHERE sesiones.Activa = TRUE AND sesiones.Grupo_id = ? ORDER BY sesiones.Sesion_id DESC LIMIT 1";
    const sesion = (await con.query(query, Grupo_id))[0][0] as Sesion;

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

export const registrar_asistencias = async (Grupo_id, Socios) => {
    try {
        // VERIFICACIONES
        // Verificar que la sesion existe
        const sesion = await obtener_sesion_activa(Grupo_id);

        //registrar asistencias
        const asistencias_con_error: {Socio_id: number, error: string}[] = [];
        for (let i = 0; i < Socios.length; i++) {
            try {
                // Verificar que el socio existe
                const socio = await existe_socio(Socios[i].Socio_id);
                // Verificar que el socio pertenezca al grupo
                await socio_en_grupo(socio.Socio_id, Grupo_id);

                // INSERCION
                let query = "INSERT INTO asistencias (Presente, Sesion_id, Socio_id) VALUES (?, ?, ?)";
                await db.query(query, [Socios[i].Presente, sesion.Sesion_id, Socios[i].Socio_id]);
            } catch (error) {
                const { message } = catch_common_error(error)
                asistencias_con_error.push({
                    Socio_id: Socios[i].Socio_id,
                    error: message
                });
            }
        }

        if (asistencias_con_error.length > 0) {
            // return res.json({ code: 400, message: 'Asistencias con error', data: asistencias_con_error }).status(400);
            throw { code: 400, message: 'Asistencias con error', data: asistencias_con_error };
        }

        // throw { code: 200, message: 'Asistencias registradas' };
    } catch (error) {
        const { code, message } = catch_common_error(error);
        throw { code, message };
    }
}



/**
 * Verifica si existe una sesion
 * @param Sesion_id Id de la sesion a verificar.
 * @returns Objeto de tipo Sesion.
 * @throws Si no existe una sesion con el id dado.
 */
export const existeSesion = async (Sesion_id: number) => {
    const sesion = (await db.query(
        "Select * From sesiones where Sesion_id = ?",
        Sesion_id
    ))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion;
    }

    throw { code: 400, message: "No existe una sesion con el id " + Sesion_id };
}