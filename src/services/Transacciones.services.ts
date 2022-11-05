import { Connection, OkPacket, Pool, PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { obtenerAcuerdoActual } from "./Acuerdos.services";
import { obtenerSesionActual, obtener_caja_sesion } from "./Sesiones.services";

/**
 * Toma un objeto de tipo Transaccion, se inserta en la DB y se actualiza la caja de la sesion.
 * @param campos_transaccion Objeto de tipo transaccion con los campos listos para insertarse.
 * @param con Conexion para hacer queries, para transacciones.
 * @returns El objeto de transaccion resultante
 */
export async function crear_transaccion({Cantidad_movimiento, Catalogo_id, Socio_id, Grupo_id}: {Cantidad_movimiento: number, Catalogo_id: string, Socio_id: number, Grupo_id: number}, con?: PoolConnection | Pool) {
    // Hacer con = db si es que no es undefined
    if (con === undefined) {
        con = db;
    }

    const acuerdoActual = await obtenerAcuerdoActual(Grupo_id, con);
    const sesionActual = await obtenerSesionActual(Grupo_id, con);
    
    if(sesionActual.Caja + Cantidad_movimiento < 0) {
        throw "La caja no puede quedar menor a 0";
    }

    const campos_transaccion: Transaccion = {
        Cantidad_movimiento,
        Catalogo_id,
        Socio_id,
        Acuerdo_id: acuerdoActual.Acuerdo_id!,
        // Caja: sesionActual.Caja + Cantidad_movimiento // caja como numero
        Caja: Number(sesionActual.Caja) + Number(Cantidad_movimiento), // caja como string
        Sesion_id: sesionActual.Sesion_id!,
    }

    // Insertar Transaccion
    let query = "Insert into transacciones SET ?";
    const resultado_registro_transaccion = (await con.query(query, campos_transaccion))[0] as OkPacket;
    campos_transaccion.Transaccion_id = resultado_registro_transaccion.insertId;

    // Actualizar caja
    query = "Update sesiones set caja = ? where Sesion_id = ?";
    await con.query(query, [campos_transaccion.Caja, campos_transaccion.Sesion_id]);

    return campos_transaccion;
}