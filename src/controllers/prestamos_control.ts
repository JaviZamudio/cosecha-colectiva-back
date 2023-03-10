import db from "../config/database";
import { pagarPrestamo, generar_prestamo } from "../services/Prestamos.services";
import { formatearFecha, getCommonError } from "../utils/utils";
import { obtener_caja_sesion, obtenerSesionActual } from "../services/Sesiones.services";
import { obtenerAcuerdoActual } from "../services/Acuerdos.services";
import { prestamos_multiples, limite_credito, campos_incompletos, Fecha_actual } from "../utils/validaciones";
import { AdminRequest } from "../types/misc";

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
    const { Monto_prestamo, Num_sesiones, Observaciones, Estatus_ampliacion, Prestamo_original_id } = req.body;
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);

    if (campos_incompletos({ Monto_prestamo, Num_sesiones, Observaciones, Estatus_ampliacion, Prestamo_original_id, Grupo_id, Socio_id })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    console.log("este es el id: " + Prestamo_original_id);
    
    const con = await db.getConnection();
    try {

        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        const sesionActual = await obtenerSesionActual(Grupo_id);

        const campos_prestamo: Prestamo = {
            Monto_prestamo,
            Num_sesiones,
            Observaciones,
            Acuerdos_id: acuerdoActual.Acuerdo_id!,
            Estatus_ampliacion,
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

        // Verificar que el socio pueda generar un prestamo normal
        if (!Estatus_ampliacion) {
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
            // return res.status(200).json({ code: 200, message: "Prestamo creado" });
        } else {
            // Verificar que el socio pueda generar un prestamo ampliado
            if (!acuerdoActual.Ampliacion_prestamos) {
                return res.status(400).json({ code: 400, message: "No se permiten ampliar prestamos" })
            }

            console.log("este es el id2: " + Prestamo_original_id);
            //Verificar que el prestamo no haya sido ampliado anteriormente
            let query_pres_am = "SELECT * FROM prestamos WHERE Prestamo_original_id = ?  OR Prestamo_id = ? AND Estatus_ampliacion = 1"
            const [prestamo_amp] = await db.query(query_pres_am, [Prestamo_original_id, Prestamo_original_id]) as [Prestamo[], any];

            if (prestamo_amp.length !== 0) {
                return res.status(400).json({ code: 400, message: "Este prestamo ya fue ampliado una vez" });
            }

            let query_prestamo = "SELECT * FROM prestamos WHERE Prestamo_id = ? "
            const [prestamo_original] = await db.query(query_prestamo, [Prestamo_original_id]) as [Prestamo[], any];

            //Asegurarse de que el monto sea igual o mayor a la cantidad faltante de pagar que el prestamo original
            let faltante = (prestamo_original[0].Monto_prestamo - prestamo_original[0].Monto_pagado) + (prestamo_original[0].Interes_generado - prestamo_original[0].Interes_pagado);
            if (Monto_prestamo < faltante) {
                return res.status(400).json({ code: 400, message: "La cantidad no cubre el faltante del prestamo original" });
            }

            // let dinero_extra = Monto_prestamo - faltante; //Preguntar que si no hay un espacio en la pantalla para ver lo que en realidad se da en dinero fisico
            //Pagar el prestamo original
            await pagarPrestamo(Prestamo_original_id!, faltante, con);

            //Asegurarse de que no rebase su limite de credito
            let limite = limite_credito(Socio_id, Grupo_id, null, null, null);
            if (limite[0] === 0) {
                // return res.status(400).json({ code: 400, message: "La cantidad solicitada rebasa su limite de credito" });
                throw "La cantidad solicitada rebasa su limite de credito";
            }

            // Generar prestamo ampliado
            await generar_prestamo(Grupo_id, campos_prestamo, con);
        }

        await con.commit();
        // return res.status(200).json({ code: 200, message: "Ampliacion hecha" });
        return res.status(200).json({ code: 200, message: "Listo (:" });
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

        res.status(200).json({ code: 200, message: 'Pagos realizados' });
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

        return res.status(200).json({ code: 200, message: 'Prestamos obtenidos', data : prestamos});
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}