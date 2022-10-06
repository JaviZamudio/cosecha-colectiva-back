import { OkPacket, RowDataPacket } from "mysql2";
import db from "../config/database";

/**
 * Devuelve un grupo en base al id o codigo del grupo.
 * @param identificador Puede ser el id o el codigo del grupo
 * @returns Objeto de tipo Grupo.
 * @throws Si no existe el grupo con el id o el codigo.
 */
export const existeGrupo = async (identificador: number | string) => {
    const grupo = await obtenerGrupo(identificador)
    if(grupo !== undefined) {
        return grupo;
    }

    throw "No existe el grupo con el id o el codigo: " + identificador;
};

/**
 * Funcion para saber si un grupo está vacio.
 * @param grupo Objeto de tipo Grupo, o identificador del grupo (id o codigo).
 * @returns true si está vacio, false si no está vacio.
 */
export const grupoVacio = async (grupo: Grupo | number | string) => {
    if (typeof grupo !== "number") {
        if (typeof grupo === "string") {
            grupo = await obtenerGrupo(grupo) as Grupo;
        }

        if (typeof grupo !== "string") {
            grupo = grupo.Grupo_id!;
        }
    }

    let query = "SELECT * FROM grupo_socio WHERE Grupo_id = ? and Status = 1";
    const grupo_socio = (await db.query(query, [grupo]))[0] as GrupoSocio[];

    if (grupo_socio.length == 0) {
        return true;
    }

    return false;
}

/**
 * Funcion para obtener un grupo en base al id o codigo del grupo.
 * @param identificador Puede ser el id o el codigo del grupo
 * @returns Objeto de tipo Grupo o undefined si no existe el grupo.
 */
export const obtenerGrupo = async (identificador: number | string): Promise<Grupo | undefined> => {
    let query = "SELECT * FROM grupos WHERE Codigo_grupo = ? or Grupo_id = ?";
    const grupo = (await db.query(query, [identificador, identificador]))[0][0] as Grupo;

    return grupo;
}

export async function crearGrupo(grupo: Grupo) {
    const query = "INSERT INTO grupos SET ?";
    const [result] = await db.query(query, [grupo]) as [OkPacket, any];

    return result;
};

/**
 * Devuelve los codigos de los grupos a los que no pertenece el socio.
 * @param Socio Objeto de tipo Socio o id del socio.
 * @returns Array de numeros con los codigos de los grupos.
 */
export const grupos_sin_socio = async (Socio: Socio | number): Promise<number[]> => {
    // Asegurarse de que Socio es numero
    if (typeof Socio !== "number") {
        Socio = Socio.Socio_id!;
    }

    return (await db.query(`
    SELECT * 
    FROM grupos 
    WHERE grupos.Grupo_id NOT IN (
        SELECT grupo_socio.Grupo_id 
        FROM grupo_socio
        WHERE grupo_socio.Socio_id = ?
    )
    `, [Socio]) as [RowDataPacket[], any])[0].map((row: RowDataPacket) => row.Codigo_grupo);
}

/**
 * Obtiene las relaciones grupo-socio de un grupo.
 * @param Grupo_id Id del grupo.
 * @returns Array de objetos de tipo GrupoSocio.
 * @throws Si los datos no son validos.
 */
 export async function obtenerSociosGrupo(Grupo_id: number): Promise<GrupoSocio[]> {
    const query = "SELECT * FROM grupo_socio WHERE Grupo_id = ? and Status = 1";
    const grupo_socio = (await db.query(query, [Grupo_id]))[0] as GrupoSocio[];

    if (grupo_socio.length == 0) {
        throw "No existe el grupo con el id: " + Grupo_id;
    }

    return grupo_socio;
}