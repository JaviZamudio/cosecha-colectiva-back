import db from "../config/database";

/**
 * Busca el Acuerdo activo para un grupo.
 * @param Grupo_id Id del grupo en base al cual buscar el acuerdo.
 * @returns Objeto de tipo Acuerdo. THROWS COMMON ERROR
 */
export const obtenerAcuerdoActual = async (Grupo_id: number) => {
    let query = "SELECT * FROM acuerdos WHERE Grupo_id = ? and Status = 1";
    const acuerdo = (await db.query(query, [Grupo_id]))[0][0] as Acuerdo;

    if (acuerdo !== undefined) {
        return acuerdo;
    }

    throw {code: 400, message: "No hay un acuerdo vigente para este grupo"};
}