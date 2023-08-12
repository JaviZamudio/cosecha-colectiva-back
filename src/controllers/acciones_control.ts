import { Response } from "express";
import db from "../config/database";
import { comprar_acciones, obtener_costo_accion } from "../services/Acciones.services";
import { obtenerAcuerdoActual } from "../services/Acuerdos.services";
import { existeGrupo } from "../services/Grupos.services";
import { obtenerSesionActual } from "../services/Sesiones.services";
import { existeSocio, obtenerLimiteCreditoDisponible, socioEnGrupo } from "../services/Socios.services";
import { crear_transaccion } from "../services/Transacciones.services";
import { AdminRequest } from "../types/misc";
import { camposIncompletos, getCommonError } from "../utils/utils";
import { OkPacket, RowDataPacket } from "mysql2";

export const registrar_compra_acciones = async (req: AdminRequest<{ Cantidad: number }>, res: Response) => {
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);
    const { Cantidad } = req.body;

    if (camposIncompletos({ Cantidad })) {
        return res.status(400).json({ error: "Campos incompletos" });
    }

    let con = await db.getConnection();
    try {
        con.beginTransaction();

        // Validar que el socio exista
        const socio = await existeSocio(Socio_id);
        // Validar que el grupo exista
        const grupo = await existeGrupo(Grupo_id);
        // Validar que el socio pertenezca al grupo
        const grupoSocio = await socioEnGrupo(Socio_id, Grupo_id);
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        // comprobar que el socio no vaya a tener mas del 50% de las acciones del grupo
        if (grupoSocio.Acciones! + Cantidad > (sesionActual.Acciones + Cantidad) / 2) {
            return res.status(400).json({ error: "El socio no puede tener mas del 50% de las acciones del grupo" });
        }

        // Verificar que la cantidad sea divisible por el costo de una accion
        const costo_accion = await obtener_costo_accion(Grupo_id);
        if (Cantidad % costo_accion !== 0) {
            throw `La cantidad de acciones no es divisible por el costo de una accion(${costo_accion})`;
        }

        // Comprar acciones
        comprar_acciones(Socio_id, Grupo_id, Cantidad, con);

        con.commit();
        return res.status(200).json({ code: 200, message: "Acciones compradas" });
    } catch (error) {
        con.rollback();
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    } finally {
        con.release();
    }
}

export const retiro_acciones = async (req: AdminRequest<{ Cantidad: number }>, res: Response) => {
    const Grupo_id = Number(req.params.Grupo_id);
    const Socio_id = Number(req.params.Socio_id);
    const { Cantidad } = req.body;

    if (camposIncompletos({ Cantidad })) {
        return res.status(400).json({ code: 400, message: "Campos incompletos" });
    }

    let con = await db.getConnection();
    try {
        con.beginTransaction();

        // Validar que el socio exista
        const socio = await existeSocio(Socio_id);

        // Validar que el socio pertenezca al grupo
        const grupoSocio = await socioEnGrupo(Socio_id, Grupo_id);

        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);

        // Validar que el socio tenga mas acciones que las que quiere retirar y sea mayor al minimo de aportacion
        if (grupoSocio.Acciones! - Cantidad < acuerdoActual.Minimo_aportacion) {
            return res.status(400).json({ code: 400, message: `El socio no puede retirar esa cantidad de acciones. Tiene ${grupoSocio.Acciones} acciones y el minimo de aportacion es ${acuerdoActual.Minimo_aportacion}` });
        }

        // Validar que las acciones no estén comprometidas en algun prestamo
        const limiteCreditoDisponible = await obtenerLimiteCreditoDisponible(Socio_id, Grupo_id); // limite de credito total - cantidad ocupada en prestamos
        if (limiteCreditoDisponible <= Cantidad) {
            return res.status(400).json({ code: 400, message: "El socio está ocupando esas acciones en prestamos" });
        }

        // Retirar la accion a la relacion socio-grupo
        let query = "UPDATE grupo_socio SET acciones = acciones - ? WHERE Socio_id = ? AND Grupo_id = ?";
        await con.query(query, [Cantidad, Socio_id, Grupo_id]);

        // Actualizar la cantidad de acciones del grupo en la sesion
        query = `UPDATE sesiones
        SET Acciones = Acciones - ?
        WHERE Grupo_id = ?
        AND Activa = 1`;
        await con.query(query, [Cantidad, Grupo_id]);

        // Registrar la transaccion (cantidad_movimiento es negativo)
        await crear_transaccion({
            Cantidad_movimiento: -Cantidad,
            Catalogo_id: "RETIRO_ACCION",
            Socio_id,
            Grupo_id,
        }, con);

        con.commit();
        return res.status(200).json({ code: 200, message: "Acciones retiradas" });
    } catch (error) {
        con.rollback();
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    } finally {
        con.release();
    }
}

export const enviar_costo_acciones = async (req: AdminRequest<any>, res: Response) => {
    const Grupo_id = Number(req.params.Grupo_id);

    try {
        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        return res.status(200).json({ code: 200, message: "Costo de acciones", data: { Costo: acuerdoActual.Costo_acciones } });
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// export const acciones_sesion_socio = async (req: AdminRequest<Grupo>, res) => {
    export const acciones_sesion_socio = async (req, res) => {
    const Grupo_id = req.params.Grupo_id;
    const Sesion_id = req.params.Sesion_id;

    const { id_socio_actual } = req;
    
    try {
        // precio de la accion
        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        //Sacar el nombre del grupo
        let query = "SELECT Nombre_grupo FROM grupos WHERE Grupo_id = ?";
        const [nombre] = await db.query(query, Grupo_id);
        //Devolver el Sesion_id y la Fecha
        let query2 = "SELECT Sesion_id, Fecha FROM sesiones WHERE Sesion_id = ?";
        const [sesion] = await db.query(query2, Sesion_id);
        //Total de acciones que tiene el socio en el grupo
        let query3 = "SELECT Acciones FROM grupo_socio WHERE Grupo_id = ? AND Socio_id = ?";
        const [accionesT] = await db.query(query3, [Grupo_id, id_socio_actual]);
        //Total de acciones compradas en esa sesion
        let query4 = "SELECT Cantidad_movimiento FROM transacciones WHERE Sesion_id = ? AND Socio_id = ? AND Catalogo_id = 'COMPRA_ACCION'";
        const [accionesC] = await db.query(query4, [Sesion_id, id_socio_actual]);
        //Total de acciones retiradas en esa sesion
        let query5 = "SELECT Cantidad_movimiento FROM transacciones WHERE Sesion_id = ? AND Socio_id = ? AND Catalogo_id = 'RETIRO_ACCION'";
        const [accionesR] = await db.query(query5, [Sesion_id, id_socio_actual]);
        
        let query6 = `
        SELECT SUM(Cantidad_movimiento) AS prestamosPagados
        FROM transacciones
        where transacciones.Sesion_id = ?
        AND transacciones.Socio_id = ?
        AND transacciones.Catalogo_id = 'ABONO_PRESTAMO'
        `;
        let { prestamosPagados } = (await db.query<RowDataPacket[]>(query6, [Sesion_id, id_socio_actual]))[0][0];

        // Calcular el total de multas pagadas en la sesion por medio de las transacciones
        // catalogo_id = 'PAGO_MULTA'
        let query7 = `
        SELECT SUM(Cantidad_movimiento) AS multasPagadas
        FROM transacciones
        where transacciones.Sesion_id = ?
        AND transacciones.Socio_id =?
        AND transacciones.Catalogo_id = 'PAGO_MULTA'
        `;
        let { multasPagadas } = (await db.query<RowDataPacket[]>(query7, [Sesion_id, id_socio_actual]))[0][0];
        if(prestamosPagados==null) prestamosPagados = 0
        if(multasPagadas==null) multasPagadas = 0
        
        console.log(prestamosPagados,multasPagadas)
        return res.status(200).json({ 
            nombreDelGrupo: nombre, 
            sesion: sesion, 
            numAccionesT: accionesT, 
            numAccionesC: accionesC, 
            numAccionesR: accionesR,
            prestamosPagados,
            multasPagadas,
            Costo: acuerdoActual.Costo_acciones 
        });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// Obtener el numero de acciones que tiene el socio en el grupo y cuantas puede retirar
export const acciones_socio = async (req: AdminRequest<Grupo>, res: Response) => {
    const Grupo_id = Number(req.id_grupo_actual);
    const id_socio_actual = req.id_socio_actual!;

    // data: {
    //     Socio_id: Number,
    //     Nombres: String,
    //     Apellidos: String,
    //     AccionesRetirar: Number, // cantidad que el socio puede retirar
    //   }[]
    try {
        const obtenerInfoSociosGrupo = async (Grupo_id: number) => {
            const query = `SELECT socios.Socio_id as Socio_id, Nombres, Apellidos, Acciones FROM grupo_socio
            INNER JOIN socios ON grupo_socio.Socio_id = socios.Socio_id
            WHERE Grupo_id = ?`;
            const [socios] = await db.query(query, Grupo_id);
            return socios as {
                Socio_id: number,
                Nombres: string,
                Apellidos: string,
                Acciones: number,
            }[];
        }

        const socios = await obtenerInfoSociosGrupo(Grupo_id);
        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
        
        const data = await Promise.all(socios.map(async socio => {
            const totalSinLimiteAportacion = socio.Acciones! - acuerdoActual.Minimo_aportacion;
            const limiteCreditoDisponible = await obtenerLimiteCreditoDisponible(id_socio_actual, Grupo_id); // limite de credito total - cantidad ocupada en prestamos
            const accionesLibres = limiteCreditoDisponible / acuerdoActual.Limite_credito;

            console.log({
                "Socio_id": socio.Socio_id,
                "Acciones totales": socio.Acciones,
                "Minimo aportacion": acuerdoActual.Minimo_aportacion,
                "Limite credito": acuerdoActual.Limite_credito,
                "Limite de credito total": acuerdoActual.Limite_credito * socio.Acciones,
                "Limite credito disponible": limiteCreditoDisponible,
                "Acciones libres": accionesLibres,
                "TSLA": totalSinLimiteAportacion,
            })

            /* 
            Acciones Totales = 100
            Minimo aportacion = 10
            Limite credito = 1.5
            Limite de credito total = 100 * 1.5 = 150
            Prestamos vigentes Total = 30
            TSLA = AT - MA = 100 - 10 = 90

            LCT = AT * LC = 100 * 1.5 = 150
            LCD = LCT - PVT = 150 - 30 = 120
            AL = LCD / LC = 120 / 1.5 = 80
            LCD = (AT * LC) - PVT = (100 * 1.5) - 30 = 120
            AL = ((AT * LC) - PVT) / LC = ((100 * 1.5) - 30) / 1.5 = 80
            */

            return {
                Socio_id: socio.Socio_id,
                Nombres: socio.Nombres,
                Apellidos: socio.Apellidos,
                Acciones: socio.Acciones,
                AccionesRetirar: Math.min(socio.Acciones!, totalSinLimiteAportacion, accionesLibres),
            }
        }));

        return res.status(200).json({
            code: 200,
            message: "Acciones del socio",
            data,
        });
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}