import { Pool, PoolConnection } from "mysql2/promise";
import db from "../config/database";
import { catch_common_error, existe_socio, obtener_sesion_activa, socio_en_grupo } from "../utils/validaciones";
import { obtenerAcuerdoActual } from "./Acuerdos.services";
import { getCommonError } from "../utils/utils";

/**
 * Obtiene la sesion activa de un grupo si es que hay una.
 * @param Grupo_id Id del grupo que tiene la sesion
 * @returns Un objeto de tipo Sesion. TRHOWS COMMON ERROR
 */
export const obtenerSesionActual = async (Grupo_id: number, con?: PoolConnection | Pool) => {
    if (con === undefined) con = db;

    let query = "SELECT * FROM sesiones WHERE sesiones.Activa = TRUE AND sesiones.Grupo_id = ? ORDER BY sesiones.Sesion_id DESC LIMIT 1";
    const sesion = (await con.query(query, Grupo_id))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion;
    }

    throw { code: 400, message: "No hay una sesion en curso para el grupo " + Grupo_id };
}

/**
 * Obtiene una sesion en base a su id.
 * @param Sesion_id Id de la sesion a obtener.
 * @returns Un objeto de tipo sesion.
 */
export const obtener_sesion = async (Sesion_id: number) => {
    const sesion = (await db.query(
        "Select * From sesiones where Sesion_id = ?",
        Sesion_id
    ))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion
    }
}

/**
 * Regresa la cantidad de dinero que hay en un grupo al momento de la sesion.
 * @param sesion Puede ser el id de una sesion a buscar o un objeto de tipo Sesion.
 * @returns El campo "caja" de una sesion.
 */
export const obtener_caja_sesion = async (sesion: number | Sesion) => {
    if (typeof sesion === "number") {
        sesion = (await obtener_sesion(sesion))!;
    }

    return sesion.Caja;
}

export const registrar_asistencias = async (Grupo_id, Socios) => {
    // VERIFICACIONES
    // Verificar que la sesion existe
    const sesion = await obtener_sesion_activa(Grupo_id);

    //registrar asistencias
    const asistencias_con_error: { Socio_id: number, error: string }[] = [];
    for (let i = 0; i < Socios.length; i++) {
        try {
            // Verificar que el socio existe
            const socio = await existe_socio(Socios[i].Socio_id);
            // Verificar que el socio pertenezca al grupo
            await socio_en_grupo(socio.Socio_id, Grupo_id);

            // INSERCION
            let query = "INSERT INTO asistencias (Presente, Sesion_id, Socio_id) VALUES (?, ?, ?)";
            await db.query(query, [Socios[i].Presente, sesion.Sesion_id, Socios[i].Socio_id]);
        } catch (error) {
            const { message } = catch_common_error(error)
            asistencias_con_error.push({
                Socio_id: Socios[i].Socio_id,
                error: message
            });
        }
    }

    if (asistencias_con_error.length > 0) {
        // return res.json({ code: 400, message: 'Asistencias con error', data: asistencias_con_error }).status(400);
        throw { code: 400, message: 'Asistencias con error: ' + JSON.stringify(asistencias_con_error) };
    }
}



/**
 * Verifica si existe una sesion
 * @param Sesion_id Id de la sesion a verificar.
 * @returns Objeto de tipo Sesion.
 * @throws Si no existe una sesion con el id dado.
 */
export const existeSesion = async (Sesion_id: number) => {
    const sesion = (await db.query(
        "Select * From sesiones where Sesion_id = ?",
        Sesion_id
    ))[0][0] as Sesion;

    if (sesion !== undefined) {
        return sesion;
    }

    throw { code: 400, message: "No existe una sesion con el id " + Sesion_id };
}

export const disminuir_sesiones = async (Grupo_id: number) => {
    if (!Grupo_id) {
        throw { code: 400, message: "Datos incompletos" };
    }

    const query = `
    UPDATE prestamos 
    INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id 
    SET prestamos.Sesiones_restantes = (prestamos.Sesiones_restantes - 1 ) 
    WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0`;
    await db.query(query, [Grupo_id]);

    return;
}

export const actualizar_intereses = async (Grupo_id: number) => {
    if (!Grupo_id) {
        throw { code: 400, message: "Datos incompletos" };
    }

    //intereses normales --- Tasa_interes --- %
    const query = "UPDATE prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id SET prestamos.Interes_generado = prestamos.Interes_generado + ((prestamos.Monto_prestamo*acuerdos.Tasa_interes)/100) WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 0 AND prestamos.Sesiones_restantes >= 0 AND prestamos.Prestamo_original_id IS NULL AND socios.`Status` = 1;";
    await db.query(query, [Grupo_id]);
    //intereses morosidad --- Interes_morosidad --- %
    const query2 = "UPDATE prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id SET prestamos.Interes_generado = prestamos.Interes_generado + ((prestamos.Monto_prestamo*(acuerdos.Interes_morosidad + acuerdos.Tasa_interes))/100) WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 0 AND prestamos.Sesiones_restantes < 0 AND prestamos.Prestamo_original_id IS NULL AND socios.`Status` = 1;";
    await db.query(query2, [Grupo_id]);
    //intereses ampliacion --- Interes_ampliacion --- %
    const query3 = "UPDATE prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id SET prestamos.Interes_generado = prestamos.Interes_generado + ((prestamos.Monto_prestamo*(acuerdos.Interes_ampliacion + acuerdos.Tasa_interes))/100) WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 1 AND prestamos.Sesiones_restantes >= 0 AND prestamos.Prestamo_original_id IS NOT NULL AND socios.`Status` = 1;";
    await db.query(query3, [Grupo_id]);
    //intereses ampliacion con morosidad --- Interes_ampliacion + Interes_morosidad--- %
    const query4 = "UPDATE prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id SET prestamos.Interes_generado = prestamos.Interes_generado + ((prestamos.Monto_prestamo*(acuerdos.Interes_ampliacion+acuerdos.Interes_morosidad + acuerdos.Tasa_interes))/100) WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 1 AND prestamos.Sesiones_restantes < 0 AND prestamos.Prestamo_original_id IS NOT NULL AND socios.`Status` = 1;";
    await db.query(query4, [Grupo_id]);
}

export const agregar_interes_prestamo = async (Grupo_id: number) => {
    if (!Grupo_id) {
        throw { code: 400, message: "Datos incompletos" };
    }
    //obtener sesion actual
    let sesion = await obtenerSesionActual(Grupo_id);

    try {
        //intereses normales --- Tasa_interes --- %
        const query = "SELECT Prestamo_id, (prestamos.Monto_prestamo*acuerdos.Tasa_interes)/100 as interesGenerado FROM prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 0 AND prestamos.Sesiones_restantes >= 0 AND prestamos.Prestamo_original_id IS NULL AND socios.`Status` = 1;";
        let uno = (await db.query(query, [Grupo_id]))[0];
        
        console.log(uno);
        await Promise.all(JSON.parse(JSON.stringify(uno)).map(async (prestamo) => {
            let ins1 = "INSERT INTO interes_prestamo (Prestamo_id, Sesion_id, Monto_interes, Tipo_interes) VALUES (?, ?, ?, ?)";
            let prestamoRounded = (Math.round(prestamo.interesGenerado*2)) /2
            let res = await db.query(ins1, [prestamo.Prestamo_id, sesion.Sesion_id, prestamoRounded, 0])[0];
            return res;
        }));

        //intereses morosidad --- Interes_morosidad --- %
        const query2 = "SELECT Prestamo_id, (prestamos.Monto_prestamo*(acuerdos.Interes_morosidad + acuerdos.Tasa_interes))/100 as interesGenerado FROM prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 0 AND prestamos.Sesiones_restantes < 0 AND prestamos.Prestamo_original_id IS NULL AND socios.`Status` = 1;";
        let dos = (await db.query(query2, [Grupo_id]))[0];
        await Promise.all(JSON.parse(JSON.stringify(dos)).map(async (prestamo) => {
            let ins2 = "INSERT INTO interes_prestamo (Prestamo_id, Sesion_id, Monto_interes, Tipo_interes) VALUES (?, ?, ?, ?)";
            let res2 = await db.query(ins2, [prestamo.Prestamo_id, sesion.Sesion_id, prestamo.interesGenerado, 1])[0];
            return res2;
        }));

        //intereses ampliacion --- Interes_ampliacion --- %
        const query3 = "SELECT Prestamo_id, (prestamos.Monto_prestamo*(acuerdos.Interes_ampliacion + acuerdos.Tasa_interes))/100 as interesGenerado FROM prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 1 AND prestamos.Sesiones_restantes >= 0 AND prestamos.Prestamo_original_id IS NOT NULL AND socios.`Status` = 1;";
        let tres = (await db.query(query3, [Grupo_id]))[0];
        console.log(tres);
        await Promise.all(JSON.parse(JSON.stringify(tres)).map(async (prestamo) => {
            let ins3 = "INSERT INTO interes_prestamo (Prestamo_id, Sesion_id, Monto_interes, Tipo_interes) VALUES (?, ?, ?, ?)";
            let res3 = await db.query(ins3, [prestamo.Prestamo_id, sesion.Sesion_id, prestamo.interesGenerado, 2])[0];
            return res3;
        }));

        //intereses ampliacion con morosidad --- Interes_ampliacion + Interes_morosidad--- %
        const query4 = "SELECT Prestamo_id, (prestamos.Monto_prestamo*(acuerdos.Interes_ampliacion + acuerdos.Interes_morosidad + acuerdos.Tasa_interes))/100 as interesGenerado FROM prestamos INNER JOIN sesiones ON prestamos.Sesion_id = sesiones.Sesion_id INNER JOIN socios ON prestamos.Socio_id = socios.Socio_id INNER JOIN acuerdos ON prestamos.Acuerdos_id = Acuerdos.Acuerdo_id WHERE sesiones.Grupo_id = ? AND prestamos.Estatus_prestamo = 0 AND prestamos.Estatus_ampliacion = 1 AND prestamos.Sesiones_restantes < 0 AND prestamos.Prestamo_original_id IS NOT NULL AND socios.`Status` = 1;";
        let cuatro = (await db.query(query4, [Grupo_id]))[0];
        console.log(cuatro);
        await Promise.all(JSON.parse(JSON.stringify(cuatro)).map(async (prestamo) => {
            let ins4 = "INSERT INTO interes_prestamo (Prestamo_id, Sesion_id, Monto_interes, Tipo_interes) VALUES (?, ?, ?, ?)";
            let res4 = await db.query(ins4, [prestamo.Prestamo_id, sesion.Sesion_id, prestamo.interesGenerado, 3])[0];
            return res4;
        }));
    } catch (error) {
        const { code, message } = catch_common_error(error);
        throw { code, message };
    }
}

/**
 * Calcula las sesiones entre la fecha de creacion de acuerdos y la fecha de finalizacion de acuerdos
 * @param Grupo_id
 * @returns Numero de sesiones
 */
export async function calcularSesionesEntreAcuerdos(Grupo_id: number) {
    try {
        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);

        const fechaInicio = new Date(acuerdoActual.Fecha_acuerdos); // 2021-01-01
        const fechaFin = new Date(acuerdoActual.Fecha_acuerdos_fin); // 2021-01-01
        const periodoReuniones = acuerdoActual.Periodo_reuniones; // 4 semanas

        const sesionesEntreAcuerdos = Math.round((fechaFin.getTime() - fechaInicio.getTime()) / (periodoReuniones * 7 * 24 * 60 * 60 * 1000));

        return sesionesEntreAcuerdos;
    } catch (error) {
        const { code, message } = catch_common_error(error);
        throw { code, message };
    }
}

/**
 * Calcula las sesiones restantes entre la fecha actual y la fecha de finalizacion de acuerdos
 * @param Grupo_id
 * @returns Numero de sesiones
 * @returns 0 si ya no hay sesiones restantes
 */
export async function calcularSesionesParaAcuerdosFin(Grupo_id: number) {
    try {
        const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);

        const fechaFin = new Date(acuerdoActual.Fecha_acuerdos_fin); // 2021-01-01
        const periodoReuniones = acuerdoActual.Periodo_reuniones; // 4 semanas

        const sesionesEntreAcuerdos = Math.round((fechaFin.getTime() - Date.now()) / (periodoReuniones * 7 * 24 * 60 * 60 * 1000));

        return sesionesEntreAcuerdos;
    } catch (error) {
        const { code, message } = catch_common_error(error);
        throw { code, message };
    }
}