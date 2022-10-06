import { PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { obtener_acuerdos_activos } from "../utils/validaciones";
import { obtenerAcuerdoActual } from "./Acuerdos.services";
import { crear_transaccion } from "./Transacciones.services";

/**
 * Funcion para comprar acciones para un socio en un grupo
 * @param Socio_id id del socio que quiere comprar acciones
 * @param Grupo_id id del grupo en el que se compraran las acciones
 * @param Cantidad cantidad de acciones en dinero que quiere comprar
 * @returns Objeto de tipo OkPacket
 * @throws Error si no se puede comprar las acciones
 */
export const comprar_acciones = async (Socio_id, Grupo_id, Cantidad, con?: PoolConnection) => {
    if(!con) {
        con = await db.getConnection();
    }

    // Agregar la accion a la relacion socio-grupo
    let query = "UPDATE grupo_socio SET acciones = acciones + ? WHERE Socio_id = ? AND Grupo_id = ?";
    await con.query(query, [Cantidad, Socio_id, Grupo_id]);

    // Actualizar la cantidad de acciones del grupo en la sesion
    query = `UPDATE sesiones
    SET Acciones = Acciones + ?
    WHERE Grupo_id = ?
    ORDER BY Sesion_id DESC
    LIMIT 1`;
    await con.query(query, [Cantidad, Grupo_id]);

    // Registrar la transaccion
    await crear_transaccion({
        Cantidad_movimiento: Cantidad,
        Catalogo_id: "COMPRA_ACCION",
        Socio_id,
        Grupo_id,
    }, con);
}

/**
 * Funcion para obtener el costo de una accion en un grupo segun los acuerdos actuales
 * @param Grupo_id id del grupo en el que se compraran las acciones
 * @returns costo de una accion
 * @throws Error si no se puede obtener el costo de una accion
 */
export async function obtener_costo_accion(Grupo_id: any) {
    const acuerdos = await obtenerAcuerdoActual(Grupo_id);
    return acuerdos.Costo_acciones;
}
