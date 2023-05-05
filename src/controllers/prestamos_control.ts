import db from "../config/database";
import { pagarPrestamo, generar_prestamo, obtener_prestamos_ampliables, obtenerPrestamosVigentes, existe_prestamo } from "../services/Prestamos.services";
import { formatearFecha, getCommonError } from "../utils/utils";
import { obtener_caja_sesion, obtenerSesionActual, obtener_sesion } from "../services/Sesiones.services";
import { obtenerAcuerdoActual } from "../services/Acuerdos.services";
import { prestamos_multiples, limite_credito, campos_incompletos, Fecha_actual } from "../utils/validaciones";
import { AdminRequest } from "../types/misc";
import { obtenerSociosGrupo } from "../services/Grupos.services";
import { RowDataPacket } from "mysql2";
import { existeSocio, obtenerLimiteCreditoDisponible } from "../services/Socios.services";

export const enviar_socios_prestamo = async (req, res) => {
    const { Grupo_id } = req.body;
    if (!Grupo_id) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    let query = "SELECT * FROM grupo_socio WHERE Grupo_id = ?";
    const [socios] = await db.query(query, [Grupo_id]) as [GrupoSocio[], any];
    const socios_prestamos = await prestamos_multiples(Grupo_id, socios);
    if (socios_prestamos.length > 0) {
        return res.json({ code: 200, message: 'Socios obtenidos', data: socios_prestamos });
    } else {
        return res.status(500).json({ code: 500, message: 'Error en el servidor' });
    }
}

interface PayloadCrearPrestamos {
    Monto_prestamo: number;
    Num_sesiones: number;
    Observaciones: string;
    Estatus_ampliacion: 0 | 1;
    Prestamo_original_id: number | null;
}
export const crear_prestamo = async (req: AdminRequest<PayloadCrearPrestamos>, res) => {
    const { Monto_prestamo, Num_sesiones, Observaciones } = req.body;
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);

    if (campos_incompletos({ Monto_prestamo, Num_sesiones, Observaciones, Grupo_id, Socio_id })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }


    const con = await db.getConnection();
    try {

        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        const sesionActual = await obtenerSesionActual(Grupo_id);

        const campos_prestamo: Prestamo = {
            Monto_prestamo,
            Num_sesiones,
            Observaciones,
            Acuerdos_id: acuerdoActual.Acuerdo_id!,
            Estatus_ampliacion: 0,
            Prestamo_original_id: null,
            Estatus_prestamo: 0,
            Fecha_final: formatearFecha(new Date(Date.now() + (Num_sesiones * acuerdoActual.Periodo_reuniones * 7 * 24 * 60 * 60 * 1000))),
            Fecha_inicial: Fecha_actual(),
            Interes_generado: 0,
            Interes_pagado: 0,
            Monto_pagado: 0,
            Sesion_id: sesionActual.Sesion_id!,
            Sesiones_restantes: Num_sesiones,
            Socio_id: Socio_id,
        }

        await con.beginTransaction();

        // Validaciones
        //Verificar si se permiten prestamos multiples
        //si no, verificar si no tiene ningun otro prestamo
        //verificar cantidad maxima que puede pedir el socio (cantidad de dinero en acciones * Limite credito de acuerdos)
        //Calcular el monto acumulado en prestamos vigentes (si esta cantidad rebasa su limite no puede proceder)
        //Para hacer las validaciones anteriores necesitamos los datos del socio
        let query = "SELECT * FROM grupo_socio WHERE Socio_id = ? and Grupo_id = ?";
        const [socio] = await db.query(query, [Socio_id, Grupo_id]) as [GrupoSocio[], any];
        let Lista_socios_validacion = await prestamos_multiples(Grupo_id, [socio]);
        if (!Lista_socios_validacion[0].puede_pedir) {
            return res.status(400).json({ code: 400, message: "El socio " + Lista_socios_validacion[0].Nombres + " " + Lista_socios_validacion[0].message });
        }
        //Verificar que la cantidad solicitada sea menor a su limite
        if (Monto_prestamo > Lista_socios_validacion[0].Limite_credito_disponible!) {
            return res.status(400).json({ code: 400, message: "La cantidad solicitada rebsasa su limite de credito" });
        }
        //Verificar si hay esa cantidad disponible en la caja
        //Obtener la caja de la sesion activa
        let caja = await obtener_caja_sesion(sesionActual.Sesion_id!);
        if (caja < Monto_prestamo) {
            return res.status(400).json({ code: 400, message: "No hay suficiente cantidad en la caja" });
        }
        campos_prestamo.Prestamo_original_id = null;
        // Crear Registro en prestamos
        await generar_prestamo(Grupo_id, campos_prestamo, con);
        await con.commit();
        return res.status(200).json({ code: 200, message: "Prestamo creado" });
    } catch (error) {
        console.log('holiwi')
        await con.rollback();
        console.log("Este es el error: " + error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    } finally {
        con.release();
    }
}

export const ampliar_prestamo = async (req: AdminRequest<PayloadCrearPrestamos>, res) => {
    const { Monto_prestamo, Num_sesiones, Observaciones, Prestamo_original_id } = req.body;
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);

    if (campos_incompletos({ Monto_prestamo, Num_sesiones, Observaciones, Prestamo_original_id, Grupo_id, Socio_id })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    const con = await db.getConnection();
    try {

        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        const sesionActual = await obtenerSesionActual(Grupo_id);

        const campos_prestamo: Prestamo = {
            Monto_prestamo,
            Num_sesiones,
            Observaciones,
            Acuerdos_id: acuerdoActual.Acuerdo_id!,
            Estatus_ampliacion: 1,
            Prestamo_original_id,
            Estatus_prestamo: 0,
            Fecha_final: formatearFecha(new Date(Date.now() + (Num_sesiones * acuerdoActual.Periodo_reuniones * 7 * 24 * 60 * 60 * 1000))),
            Fecha_inicial: Fecha_actual(),
            Interes_generado: 0,
            Interes_pagado: 0,
            Monto_pagado: 0,
            Sesion_id: sesionActual.Sesion_id!,
            Sesiones_restantes: Num_sesiones,
            Socio_id: Socio_id,
        }

        await con.beginTransaction();

        // Verificar que el socio pueda generar un prestamo ampliado
        if (!acuerdoActual.Ampliacion_prestamos) {
            return res.status(400).json({ code: 400, message: "No se permiten ampliar prestamos" })
        }

        //Verificar que el prestamo no haya sido ampliado anteriormente
        let query_pres_am = "SELECT * FROM prestamos WHERE Prestamo_original_id = ?  OR Prestamo_id = ? AND Estatus_ampliacion = 1"
        const [prestamo_amp] = await db.query(query_pres_am, [Prestamo_original_id, Prestamo_original_id]) as [Prestamo[], any];

        if (prestamo_amp.length !== 0) {
            return res.status(400).json({ code: 400, message: "Este prestamo ya fue ampliado una vez" });
        }

        let query_prestamo = "SELECT * FROM prestamos WHERE Prestamo_id = ? ";
        const [prestamo_original] = await db.query(query_prestamo, [Prestamo_original_id]) as [Prestamo[], any];
        //Asegurarse de que el monto sea igual o mayor a la cantidad faltante de pagar que el prestamo original
        let faltante = (prestamo_original[0].Monto_prestamo - prestamo_original[0].Monto_pagado) + (prestamo_original[0].Interes_generado - prestamo_original[0].Interes_pagado);

        if (Monto_prestamo < faltante) {
            return res.status(400).json({ code: 400, message: "La cantidad no cubre el faltante del prestamo original" });
        }

        let dinero_extra = Monto_prestamo - faltante; //Preguntar que si no hay un espacio en la pantalla para ver lo que en realidad se da en dinero fisico

        //Asegurarse de que no rebase su limite de credito
        let limite = limite_credito(Socio_id, Grupo_id, null, null, null);
        if (limite[0] === 0) {
            // return res.status(400).json({ code: 400, message: "La cantidad solicitada rebasa su limite de credito" });
            throw "La cantidad solicitada rebasa su limite de credito";
        }
        //Obtener la caja de la sesion activa
        let caja = await obtener_caja_sesion(sesionActual.Sesion_id!);
        if (caja < dinero_extra) {
            return res.status(400).json({ code: 400, message: "No hay suficiente cantidad en la caja" });
        }
        //Pagar el prestamo original
        await pagarPrestamo(Prestamo_original_id!, faltante, con);
        // Generar prestamo ampliado
        await generar_prestamo(Grupo_id, campos_prestamo, con);
        await con.commit();
        return res.status(200).json({ code: 200, message: "Ampliacion hecha" });
    } catch (error) {
        console.log('holiwi')
        await con.rollback();
        console.log("Este es el error: " + error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    } finally {
        con.release();
    }
}

export interface PayloadPagarPrestamos {
    Prestamos: {
        Prestamo_id: number,
        Monto_abono: number,
    }[]
}
export const pagar_prestamos = async (req: AdminRequest<PayloadPagarPrestamos>, res) => {
    const Grupo_id = Number(req.params.Grupo_id);
    const { Prestamos } = req.body;

    if (campos_incompletos({ Prestamos })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    const con = await db.getConnection();
    await con.beginTransaction();
    try {
        for (let pago_prestamo in Prestamos) {
            const { Prestamo_id, Monto_abono } = Prestamos[pago_prestamo];
            await pagarPrestamo(Prestamo_id, Monto_abono, con);
        }

        await con.commit();

        return res.status(200).json({ code: 200, message: 'Pagos realizados' });
    } catch (error) {
        console.log(error);
        await con.rollback();
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    } finally {
        con.release();
    }
}

export const get_prestamos_nopagados_socio = async (req: AdminRequest<Grupo>, res) => {
    const Grupo_id = Number(req.id_grupo_actual);
    const Socio_id = Number(req.params.Socio_id);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        //Total de prestamos no pagados de un socio
        let query = "SELECT prestamos.Prestamo_id, prestamos.Fecha_inicial AS Fecha, (prestamos.Interes_generado - prestamos.Interes_pagado) AS Interes, prestamos.Monto_prestamo AS Total, prestamos.Monto_pagado AS Pagado FROM prestamos JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id WHERE Socio_id = ? AND Estatus_prestamo = 0 AND sesiones.Grupo_id = ?;";
        const [prestamos] = await db.query(query, [Socio_id, Grupo_id]);

        return res.status(200).json({ code: 200, message: 'Prestamos obtenidos', data: prestamos });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// controlador para obtener informacion de los prestamos de todos los socios
// informacion por socio: id, nombre, # prestamos vigentes, # prestamos ampliables, limite de prestamos ✅
export const info_prestamos_general = async (req: AdminRequest<any>, res) => {
    const Grupo_id = Number(req.id_grupo_actual);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        // Obtener todos los socios del grupo
        const sociosGrupo = await obtenerSociosGrupo(Grupo_id);

        // Obtener la informacion de los acuerdos actuales
        const { Creditos_simultaneos: Limite_prestamos } = await obtenerAcuerdoActual(Grupo_id);

        const promises = sociosGrupo.map(async socioGrupo => {
            // const { Prestamos_vigentes } = (await db.query(query, [socioGrupo.Socio_id, Grupo_id]) as RowDataPacket[])[0] as { Prestamos_vigentes: number };
            const Prestamos_vigentes = await obtenerPrestamosVigentes(Grupo_id, socioGrupo.Socio_id);

            const Prestamos_ampliables = await obtener_prestamos_ampliables(Grupo_id, socioGrupo.Socio_id);

            const socio = await existeSocio(socioGrupo.Socio_id);

            return {
                Socio_id: socioGrupo.Socio_id,
                Nombre: socio.Nombres,
                Prestamos_vigentes: Prestamos_vigentes.length,
                Prestamos_ampliables: Prestamos_ampliables.length,
                Limite_prestamos
            }
        });

        const data = await Promise.all(promises);

        return res.status(200).json({ code: 200, message: 'Informacion obtenida', data: data });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const get_prestamos_socio_sesion = async (req: AdminRequest<Grupo>, res) => {
    // const Socio_id = Number(req.id_socio_actual);
    const Sesion_id = Number(req.params.Sesion_id);
    const Prestamo_id = Number(req.params.Prestamo_id);

    if (!Sesion_id || !Prestamo_id) {
        console.log(Sesion_id);
        console.log(Prestamo_id);
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    try {

        //Pagó esta sesión
        let query1 = "SELECT SUM(t.Cantidad_movimiento) as pagoEstaSesion FROM transaccion_prestamos tp INNER JOIN transacciones t ON tp.Transaccion_id = t.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id = ?";
        const [pago_sesion] = await db.query(query1, [Prestamo_id, Sesion_id]);

        //Interes acumulado e Interes generado en esta sesion
        let query2 = "SELECT SUM(Monto_interes) - (SELECT SUM(tp.Monto_abono_interes) FROM transaccion_prestamos tp INNER JOIN transacciones t ON t.Transaccion_id = tp.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id < ?) as interesAcumulado, Monto_interes as interesGeneradoEstaSesion FROM interes_prestamo WHERE Prestamo_id = ? AND Sesion_id < ?";
        const [intereses] = await db.query(query2, [Prestamo_id, Sesion_id, Prestamo_id, Sesion_id]);

        //Interes Total
        let interesTotal = intereses[0].interesAcumulado + intereses[0].interesGeneradoEstaSesion;

        //Interes Pagado esta sesion
        let query3 = "SELECT SUM(tp.Monto_abono_interes) as interesPagado FROM transaccion_prestamos tp INNER JOIN transacciones t ON t.Transaccion_id = tp.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id = ?";
        const [interes_pagado] = await db.query(query3, [Prestamo_id, Sesion_id]);

        //Interes Restante
        let interesRestante = interesTotal - interes_pagado[0].interesPagado;

        //Dinero Restante

        //Monto oiriginal
        let query4 = "SELECT Monto_prestamo, Fecha_inicial FROM prestamos WHERE Prestamo_id = ?";
        const [prestamo] = await db.query(query4, [Prestamo_id]);

        //Monto antes del pago de hoy
        let query5 = "SELECT ? - SUM(tp.Monto_abono_prestamo) as montoAntesPagoHoy FROM transaccion_prestamos tp INNER JOIN transacciones t ON t.Transaccion_id = tp.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id < ?";
        const [montoAntes] = await db.query(query5, [prestamo[0].Monto_prestamo, Prestamo_id, Sesion_id]);

        //Monto Restante

        //Dinero Total Pagado
        let query6 = "SELECT SUM(tp.Monto_abono_prestamo) as montoTotalPagado FROM transaccion_prestamos tp INNER JOIN transacciones t ON t.Transaccion_id = tp.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id <= ?";
        const [montoTotalPagado] = await db.query(query6, [Prestamo_id, Sesion_id]);

        //Interes Total Pagado
        let query7 = "SELECT SUM(tp.Monto_abono_interes) as interesTotalPagado FROM transaccion_prestamos tp INNER JOIN transacciones t ON t.Transaccion_id = tp.Transaccion_id WHERE tp.Prestamo_id = ? AND t.Sesion_id <= ?";
        const [interesTotalPagado] = await db.query(query7, [Prestamo_id, Sesion_id]);

        return res.status(200).json({
            code: 200, message: 'Datos prestamo obtenido',
            pagosEstaSesion: {
                pagoEstaSesion: pago_sesion[0].pagoEstaSesion,
                interesAcumulado: intereses[0].interesAcumulado,
                interesGeneradoEstaSesion: intereses[0].interesGeneradoEstaSesion,
                interesTotal: interesTotal,
                interesRestante: interesRestante,
                dineroRestante: pago_sesion[0].pagoEstaSesion - interesTotal,
                montoAntesPagoHoy: montoAntes[0].montoAntesPagoHoy,
                MontoRestante: montoAntes[0].montoAntesPagoHoy - (pago_sesion[0].pagoEstaSesion - interesTotal),
            },
            informacionGeneral: {
                inicioDelPrestamo: prestamo[0].Fecha_inicial,
                dineroTotalPagado: montoTotalPagado[0].montoTotalPagado,
                interesTotalPagado: interesTotalPagado[0].interesTotalPagado,
                dineroRestante: montoTotalPagado[0].montoTotalPagado - interesTotalPagado[0].interesTotalPagado,
                montoOriginal: prestamo[0].Monto_prestamo,
                montoTotalRestante: prestamo[0].Monto_prestamo - (montoTotalPagado[0].montoTotalPagado - interesTotalPagado[0].interesTotalPagado),
            }
        });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// controlador para obtener la inforacion general de prestamos de un socio en el grupo
// res.body = { Nombres, Prestamos_vigentes, Limite_prestamos, Limite_credito }
export const info_prestamos_socio = async (req: AdminRequest<any>, res) => {
    const Socio_id = Number(req.params.Socio_id);
    const Grupo_id = Number(req.params.Grupo_id);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        // Obtener todos los socios del grupo
        const sociosGrupo = await obtenerSociosGrupo(Grupo_id);

        // Obtener la informacion de los acuerdos actuales
        const { Creditos_simultaneos: Limite_prestamos, Tasa_interes } = await obtenerAcuerdoActual(Grupo_id);

        const Prestamos_vigentes = await obtenerPrestamosVigentes(Grupo_id, Socio_id);

        const Limite_credito = await obtenerLimiteCreditoDisponible(Socio_id, Grupo_id);

        const socio = await existeSocio(Socio_id);

        const data = {
            Nombres: socio.Nombres,
            Prestamos_vigentes: Prestamos_vigentes.length,
            Limite_prestamos,
            Limite_credito,
            Tasa_interes 
        }

        return res.status(200).json({ code: 200, message: 'Informacion obtenida', data: data });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

/**
 * Obtener la informacion general de los prestamos ampliables de un socio
 * Envia algo como 
 * {
 *  Prestamo_id: number,
 *  Fecha_emision: Date, 
 *  Interes_actual: number, // interes acumulado no pagado
 *  Monto_prestamo: number, // monto original del prestamo
 * }[]
 */
export const info_prestamos_ampliables = async (req: AdminRequest<any>, res) => {
    const Socio_id = Number(req.params.Socio_id);
    const Grupo_id = Number(req.params.Grupo_id);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        const prestamos = await obtener_prestamos_ampliables(Grupo_id, Socio_id);

        const data = prestamos.map((prestamo) => {
            const { Prestamo_id, Fecha_inicial, Interes_generado, Interes_pagado, Monto_prestamo  } = prestamo;
            return {
                Prestamo_id,
                // Fecha_emision YYYY-MM-DD
                Fecha_emision: new Date(Fecha_inicial).toISOString().split('T')[0],
                Interes_actual: Interes_generado - Interes_pagado,
                Monto_prestamo,
            }
        })

        return res.status(200).json({ code: 200, message: 'Informacion obtenida', data: data });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// controlador para obtener la informacion de un prestamo
// res.body = { Prestamo_id, Prestamos_vigentes, Limite_prestamos, Limite_credito_actual, Deuda_actual }
export const info_prestamo = async (req: AdminRequest<any>, res) => {
    const Prestamo_id = Number(req.params.Prestamo_id);
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        // Obtener la informacion de los acuerdos actuales
        const { Creditos_simultaneos: Limite_prestamos } = await obtenerAcuerdoActual(Grupo_id);

        const Prestamos_vigentes = await obtenerPrestamosVigentes(Grupo_id, Socio_id);

        const Limite_credito_actual = await obtenerLimiteCreditoDisponible(Socio_id, Grupo_id)

        const prestamo = await existe_prestamo(Prestamo_id);

        const Deuda_actual = prestamo.Monto_prestamo - prestamo.Monto_pagado;

        const socio = await existeSocio(Socio_id);

        const data = {
            Prestamo_id,
            Prestamos_vigentes: Prestamos_vigentes.length,
            Limite_prestamos,
            Limite_credito_actual,
            Deuda_actual,
            Nombres: socio.Nombres + " " + socio.Apellidos,
        }

        return res.status(200).json({ code: 200, message: 'Informacion obtenida', data: data });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const get_info_his_pres = async (req: AdminRequest<any>, res) => {
    const Grupo_id = req.id_grupo_actual!;
    const Socio_id = req.id_socio_actual!;

    try {
        let query = "SELECT Prestamo_id, sesiones.Fecha AS date, Monto_prestamo AS total, Monto_prestamo - Monto_pagado AS restante, Estatus_prestamo AS estatus FROM prestamos JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id WHERE Socio_id = ? AND Grupo_id = ?";
        const [prestamos] = await db.query(query, [Socio_id, Grupo_id]);
        return res.status(200).json({ code: 200, data: prestamos });
    } catch (error) {
        console.log(error);
        const { message, code } = getCommonError(error)
        return res.json({ code, message }).status(code);
    }
}