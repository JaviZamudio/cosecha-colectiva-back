import { Pool, PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { obtenerSociosGrupo } from "./Grupos.services";
import { existeSesion, obtenerSesionActual, obtener_sesion } from "./Sesiones.services";

/**
 * Obtener las ganancias acumuladas de una sesion
 * @param Sesion_id id de la sesion
 * @returns Ganancias acumuladas de la sesion
 * @throws Si ocurre un error
 */
export async function obtenerGananciasSesion(Sesion_id: number, opcionales?: { sesion?: Sesion }) {
    const sesion = opcionales?.sesion || (await obtener_sesion(Sesion_id))!;
    return sesion.Ganancias;
}

/**
 * Funcion para obtener las ganancias acumuladas de un socio en un grupo.
 * @param Grupo_id Id del grupo.
 * @param Socio_id Id del socio.
 * @returns El total de ganancias en dinero de un socio en un grupo.
 * @throws Error si los datos no son validos.
 */
export async function obtenerGananciasAcumuladasGrupoSocio(Grupo_id: number, Socio_id: number): Promise<number> {
    let query = `
    Select sum(Monto_ganancia) as Ganancias
    From ganancias
    Where Grupo_id = ? and Socio_id = ? and Status = 1 and Entregada = 0
    `;

    const ganancias = (await db.query(query, [Grupo_id, Socio_id]) as [{ Ganancia: number }[], any])[0][0];

    console.log(ganancias); // TODO: eliminar

    return ganancias.Ganancia;
}

/**
 * Funcion para asignar las ganancias de la sesion actual.
 * @param Grupo_id Id del grupo.
 * @param opcionales Objetos con datos para evitar hacer consultas innecesarias.
 * @param con Conexion a la base de datos. Ideal para una transaccion.
 * @returns void
 * @throws Error si los datos no son validos.
 */
export async function asignarGananciasSesion(Grupo_id: number, opcionales?: { sesionActual?: Sesion, sociosEnGrupo?: GrupoSocio[] }, con?: PoolConnection | Pool): Promise<void> {
    const sesionActual = opcionales?.sesionActual || await obtenerSesionActual(Grupo_id); 
    const sociosEnGrupo = opcionales?.sociosEnGrupo || await obtenerSociosGrupo(Grupo_id); 
    const gananciasSesion = sesionActual.Ganancias;

    con = con || db;

    for (const grupoSocio of sociosEnGrupo) {
        const camposGanancia: Ganancias = {
            Socio_id: grupoSocio.Socio_id,
            Monto_ganancia: (gananciasSesion / sesionActual.Acciones) * grupoSocio.Acciones!,
            Sesion_id: sesionActual.Sesion_id!,
            Entregada: 0,
            Ganancia_accion: gananciasSesion / sesionActual.Acciones,
        };

        await con.query("INSERT INTO ganancias SET ?", camposGanancia);
    }
}