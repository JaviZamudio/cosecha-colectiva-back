import { OkPacket } from "mysql2";
import { Connection, Pool, PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { existeGrupo } from "./Grupos.services";
import { obtener_sesion } from "./Sesiones.services";
import { existeSocio } from "./Socios.services";
import { crear_transaccion } from "./Transacciones.services";

/**
 * Busca un prestamo en base a su id.
 * @param Prestamo_id Id del prestamo a obtener.
 * @returns Objeto de tipo Prestamo o nada, si no lo encuentra.
 */
export const obtener_prestamo = async (Prestamo_id: number) => {
    let query = "Select * from prestamos where Prestamo_id = ?";
    return (await db.query(query, Prestamo_id) as [Prestamo[] | undefined[], any])[0][0];
}

/**
 * Busca un prestamo en base a su id.
 * @param Prestamo_id Id del prestamo a obtener.
 * @returns Objeto de tipo Prestamo.
 * @throws Si no lo encuentra, arroja un error.
 */
export const existe_prestamo = async (Prestamo_id: number): Promise<Prestamo> => {
    const prestamo = await obtener_prestamo(Prestamo_id);
    if (prestamo !== undefined) return prestamo;

    throw "No existe el prestamo con el id " + Prestamo_id;
}

/**
 * Determina si un prestamo es pagable o no.
 * @param Prestamo Puede ser el id del prestamo, o un objeto tipo prestamo.
 * @returns Retorna true si el prestamo es pagable. Si no es pagable.
 * @throws Si el prestamo no es pagable
 */
export const prestamo_es_pagable = async (Prestamo: number | Prestamo): Promise<boolean> => {
    if (typeof Prestamo === "number") {
        Prestamo = await existe_prestamo(Prestamo) as Prestamo;
    }

    if (Prestamo.Estatus_prestamo !== 0)
        throw "El prestamo con id " + Prestamo.Prestamo_id + " no es pagable (estatus = 0). Estatus: " + Prestamo.Estatus_prestamo;

    return true;
}

/**
 * Funcion para obtener prestamos ampliabes de un socio en un grupo.
 * @param Grupo_id Id del grupo.
 * @param Socio_id Id del socio.
 * @returns Array de objetos de tipo Prestamo.
 * @throws Error si no existe el socio o el grupo.
 */
export const obtener_prestamos_ampliables = async (Grupo_id: number, Socio_id: number): Promise<Prestamo[]> => {
    const socio = await existeSocio(Socio_id);
    const grupo = await existeGrupo(Grupo_id);

    const query = `
    SELECT prestamos.*
    FROM prestamos
    JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id
    JOIN grupos ON grupos.Grupo_id = sesiones.Grupo_id
    JOIN acuerdos ON acuerdos.Grupo_id = grupos.Grupo_id
    WHERE prestamos.Estatus_ampliacion = 0 -- Que no estén ampliados ya
        AND prestamos.Estatus_prestamo = 0 -- Que no estén pagados
        AND grupos.Grupo_id = ? -- De cierto grupo
        AND prestamos.Socio_id = ? -- De cierto socio
        AND acuerdos.Ampliacion_prestamos = 1 -- Que los acuerdos lo permitan;
    `;

    return (await db.query(query, [Grupo_id, Socio_id]) as [Prestamo[], any])[0];
}

/**
 * Funcion para obtener prestamos pagables de un socio en un grupo.
 * @param Grupo_id Id del grupo.
 * @param Socio_id Id del socio.
 * @returns Array de objetos de tipo Prestamo.
 * @throws Error si no existe el socio o el grupo.
 */
export const obtener_prestamos_pagables = async (Grupo_id: number, Socio_id: number): Promise<Prestamo[]> => {
    const socio = await existeSocio(Socio_id);
    const grupo = await existeGrupo(Grupo_id);

    const query = `
    SELECT prestamos.*
    FROM prestamos
    JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id
    JOIN grupos ON grupos.Grupo_id = sesiones.Grupo_id
    JOIN acuerdos ON acuerdos.Grupo_id = grupos.Grupo_id and acuerdos.\`Status\` = 1
    WHERE prestamos.Estatus_prestamo = 0 -- Que no estén pagados ya
        AND grupos.Grupo_id = ? -- De cierto grupo
        AND prestamos.Socio_id = ? -- De cierto socio
    `;

    return (await db.query(query, [Grupo_id, Socio_id]) as [Prestamo[], any])[0];
}

/**
 * Funcion para pagar un prestamo.
 * @param Prestamo_id Id del prestamo a pagar.
 * @param Monto_abono Monto del abono.
 * @throws Error si el prestamo no se pudo pagar.
 */
export const pagarPrestamo = async (Prestamo_id: number, Monto_abono: number, con?: PoolConnection | Pool) => {
    if (con === undefined) con = db;

    const prestamo = await existe_prestamo(Prestamo_id) as Prestamo;
    const sesion = await obtener_sesion(prestamo.Sesion_id);
    const deudaInteres = prestamo.Interes_generado - prestamo.Interes_pagado;
    const deudaPrestamo = prestamo.Monto_prestamo - prestamo.Monto_pagado;

    await prestamo_es_pagable(prestamo);
    const Monto_abono_prestamo = Monto_abono <= deudaInteres ? 0 : Monto_abono - deudaInteres;
    const Monto_abono_interes = Monto_abono - Monto_abono_prestamo;

    if (Monto_abono > deudaPrestamo + deudaInteres) {
        throw `Lo abonado al prestamo (${Monto_abono_prestamo}) es mayor que la deuda por prestamo (${prestamo.Monto_prestamo - prestamo.Monto_pagado})`;
    }

    // Crear Transaccion
    const transaccion = await crear_transaccion({
        Cantidad_movimiento: Monto_abono_prestamo + Monto_abono_interes,
        Socio_id: prestamo.Socio_id,
        Catalogo_id: "ABONO_PRESTAMO",
        Grupo_id: sesion?.Grupo_id,
    }, con);

    // Crear registro en Transaccion_prestamos
    let query = "INSERT INTO transaccion_prestamos (Prestamo_id, Transaccion_id, Monto_abono_prestamo, Monto_abono_interes) VALUES (?, ?, ?, ?)";
    await con.query(query, [Prestamo_id, transaccion.Transaccion_id, Monto_abono_prestamo, Monto_abono_interes]);

    // Actualizar campos en el prestamo
    prestamo.Interes_pagado += Monto_abono_interes;
    prestamo.Monto_pagado += Monto_abono_prestamo;

    const nuevaDeudaPrestamo = prestamo.Monto_prestamo - prestamo.Monto_pagado;
    const nuevaDeudaInteres = prestamo.Interes_generado - prestamo.Interes_pagado;

    prestamo.Estatus_prestamo = nuevaDeudaPrestamo === 0 && nuevaDeudaInteres === 0 ? 1 : 0;

    query = "Update prestamos SET Interes_pagado = ?, Monto_pagado = ?, Estatus_prestamo = ? WHERE Prestamo_id = ?";
    await con.query(query, [prestamo.Interes_pagado, prestamo.Monto_pagado, prestamo.Estatus_prestamo, Prestamo_id]);
}