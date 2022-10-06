import db from "../config/database";
import { existe_prestamo, pagarPrestamo, prestamo_es_pagable } from "../services/Prestamos.services";
import { crear_transaccion } from "../services/Transacciones.services";
import { formatearFecha, getCommonError } from "../utils/utils";
import { obtener_caja_sesion, obtenerSesionActual } from "../services/Sesiones.services";
import { obtenerAcuerdoActual } from "../services/Acuerdos.services";
import { prestamos_multiples, campos_incompletos, Fecha_actual, obtener_acuerdos_activos } from "../utils/validaciones";
import { AdminRequest } from "../types/misc";
import { existeGrupo } from "../services/Grupos.services";

export const enviar_socios_prestamo = async (req, res) => {
    const { Grupo_id } = req.body;
    if (!Grupo_id) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    let query = "SELECT * FROM grupo_socio WHERE Grupo_id = ?";
    const [socios] = await db.query(query, [Grupo_id]) as [GrupoSocio[], any];
    console.log(prestamos_multiples(Grupo_id, socios));
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

    if (campos_incompletos({ Monto_prestamo, Num_sesiones, Observaciones, Estatus_ampliacion, Prestamo_original_id })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }
    /* // Validaciones
        //Verificar si se permiten prestamos multiples
            //si no, verificar si no tiene ningun otro prestamo
        //verificar cantidad maxima que puede pedir el socio (cantidad de dinero en acciones * Limite credito de acuerdos)
        //Calcular el monto acumulado en prestamos vigentes (si esta cantidad rebasa su limite no puede proceder)
        let Lista_socios_validacion = await prestamos_multiples(campos_prestamo.Grupo_id, Lista_socios_query);
    
        Lista_socios_validacion.forEach(socio => {
            if(socio.puede_pedir){
                Lista_socios_permiso.push({ "Socio_id": socio.Socio_id, "Limite_credito_disponible" : socio.Limite_credito_disponible!})
            }else{
                prestamos_con_error.push({ Socio_id: socio.Socio_id, motivo: "No cumple con los requisitos el solicitante" });
            }
        });
    //Verificar que la cantidad que solicita no sobrepase su limite
    // campos_prestamo.Lista_socios.forEach(async(socio_general) =>{
    for ( let socio_general of campos_prestamo.Lista_socios){
        // Lista_socios_permiso.forEach(async(socio_permiso) =>
        for ( let socio_permiso of Lista_socios_permiso)
            {
                if(socio_general.Socio_id == socio_permiso.Socio_id ){
                    if(socio_general.cantidad_prestamo <= socio_permiso.Limite_credito_disponible ){
                        //Verificar si hay esa cantidad disponible en la caja
                            //Obtener la caja de la sesion activa
                            let caja = await obtener_caja_sesion(Sesion_id);
                        if(caja >= socio_permiso.Limite_credito_disponible){
                            // Crear Registro en prestamos
                            let query = "INSERT INTO prestamos (Socio_id, Sesion_id, Acuerdos_id, Monto_prestamo, Fecha_inicial, Fecha_final, Observaciones, Num_sesiones, Sesiones_restantes, Estatus_prestamo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                            await db.query(query, [socio_permiso.Socio_id, Sesion_id, acuerdos_activos.Acuerdos_id, socio_general.cantidad_prestamo, fecha, socio_general.fecha_probable, socio_general.observaciones, socio_general.num_sesiones, socio_general.num_sesiones, 0]);
                            // Registrar salida de dinero de la caja de la sesion
                            let caja_nueva = caja - socio_general.cantidad_prestamo;
                            query = "Update sesiones set caja = ? where Sesion_id = ?";
                            await db.query(query, [caja_nueva, Sesion_id]);
                            // Crear la transaccion de tipo "PRESTAMO"
                            let query2 = "Insert into transacciones SET ?";
                            //const resultado_registro_transaccion = (await con.query(query2, campos_transaccion))[0] as OkPacket;

                        }else{
                            prestamos_con_error.push({ Socio_id: socio_permiso.Socio_id, motivo: "No hay suficiente cantidad en la caja" });
                        }
                    }else{
                        prestamos_con_error.push({ Socio_id: socio_permiso.Socio_id, motivo: "La cantidad solicitada rebasa su limite de credito" });
                    }
                }
            }
        } */
    

    const con = await db.getConnection();
    try {
        await con.beginTransaction();

        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        const sesionActual = await obtenerSesionActual(Grupo_id);

        if (!Estatus_ampliacion) {
            // Verificar que el socio pueda generar un prestamo normal
            // TODO: verificar que el socio pueda generar un prestamo normal

            // Generar prestamo normal
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

            const result = await con.query('INSERT INTO prestamos SET ?', campos_prestamo);

            // Registrar transaccion
        } else {
            // Verificar que el socio pueda generar un prestamo ampliado
            // TODO: verificar que el socio pueda generar un prestamo ampliado

            // Generar prestamo ampliado
            // TODO: Generar prestamo ampliado

            // Pagar prestamo original
            // TODO: Pagar prestamo original

            // Registrar transaccion
            // TODO: Registrar transaccion
        }

        await con.commit();
    } catch (error) {
        await con.rollback();
        console.log(error);
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