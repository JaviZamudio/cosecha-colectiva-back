import * as bcrypt from "bcrypt";
import { secret } from "../config/config";
import db from "../config/database";
import { campos_incompletos, catch_common_error, existe_socio, Fecha_actual, validar_password } from "../utils/validaciones";
import * as jwt from "jsonwebtoken";
import { OkPacket, RowDataPacket } from "mysql2";
import { getCommonError, validarCurp, validarFecha } from "../utils/utils";
import { AdminRequest, CustomJwtPayload, SocioRequest } from "../types/misc";
import { existeGrupo } from "../services/Grupos.services";
import { PoolConnection } from "mysql2/promise";
import { actualizaPassword, actualizaPreguntaSocio, crearPreguntaSocio, existeCurp, existeSocio, existeUsername, grupos_del_socio, obtenerGrupoSocio, socioEnGrupo, validarPregunta } from "../services/Socios.services";
import { obtenerAcuerdoActual } from "../services/Acuerdos.services";
import { comprar_acciones } from "../services/Acciones.services";
import { Response } from "express";
import { obtenerSesionActual } from "../services/Sesiones.services";

export const register = async (req, res, next) => {
    // Recoger los datos del body
    const { Pregunta_id, Respuesta } = req.body;

    const campos_usuario = {
        Nombres: req.body.Nombres,
        Apellidos: req.body.Apellidos,
        CURP: req.body.CURP,
        Fecha_nac: req.body.Fecha_nac,
        Nacionalidad: req.body.Nacionalidad,
        Sexo: req.body.Sexo,
        Escolaridad: req.body.Escolaridad,
        Ocupacion: req.body.Ocupacion,
        Estado_civil: req.body.Estado_civil,
        Hijos: req.body.Hijos,
        Telefono: req.body.Telefono,
        Email: req.body.Email,
        Localidad: req.body.Localidad,
        Municipio: req.body.Municipio,
        Estado: req.body.Estado,
        CP: req.body.CP,
        Pais: req.body.Pais,
        Foto_perfil: req.body.Foto_perfil,
        Fecha_reg: Fecha_actual(),
        Username: req.body.Username.toLowerCase(),
        Password: req.body.Password,
    };

    try {
        if (campos_incompletos({ ...campos_usuario, Pregunta_id, Respuesta })) {
            throw { code: 400, message: 'Campos incompletos' };
        }

        //comprobar que el socio no exista
        let query = "SELECT * FROM socios WHERE Username = ?";
        const [rows] = await db.query(query, [campos_usuario.Username]) as [RowDataPacket[], any];

        if (rows.length > 0) {
            throw { code: 400, message: `El nombre de usuario ${campos_usuario.Username} ya existe` };
        }

        //comprobar que el curp sea valido
        if (!validarCurp(campos_usuario.CURP)) {
            throw { code: 400, message: 'El curp no es valido' };
        }

        if (!validarFecha(campos_usuario.Fecha_nac)) {
            throw { code: 400, message: 'La fecha de nacimiento no es valida, debe ser aaaa-mm-dd' };
        }

        //comprobar que el curp sea unico
        query = "SELECT * FROM socios WHERE CURP like ?";
        const [curpsIguales] = await db.query(query, [campos_usuario.CURP]) as [RowDataPacket[], any];

        if (curpsIguales.length > 0) {
            throw { code: 400, message: 'El curp ya existe' };
        }

        //encriptar el password
        campos_usuario.Password = bcrypt.hashSync(campos_usuario.Password, 10);

        let con: PoolConnection = {} as PoolConnection;
        try {
            con = await db.getConnection();
            await con.beginTransaction();

            //insertar el socio
            query = "INSERT INTO socios SET ?";
            const [result] = await con.query(query, campos_usuario) as [OkPacket, any];

            //insertar la pregunta
            await crearPreguntaSocio({ Pregunta_id, Respuesta, Socio_id: result.insertId }, con);

            await con.commit();
        } catch (error) {
            await con.rollback();
            throw error;
        } finally {
            con.release();
        }

        return res.status(200).json({ message: 'Socio creado correctamente' });

    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }

}

//Funcion para enviar las preguntas de seguridad
export const enviar_preguntas_seguridad = async (req, res) => {
    try {
        let query = "SELECT * FROM preguntas_seguridad";
        const [preguntasSeguridad] = await db.query(query) as [PreguntaSeguridad[], any];
        return res.status(200).json(preguntasSeguridad);
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const cambiar_pregunta_seguridad = async (req: SocioRequest<any>, res) => {
    const { id_socio_actual } = req;
    const { Pregunta_id, Respuesta } = req.body;

    // verificar campos incompletos
    if (campos_incompletos({ Pregunta_id, Respuesta })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    try {
        await actualizaPreguntaSocio({
            Pregunta_id,
            Respuesta,
            Socio_id: id_socio_actual!
        });

        return res.status(200).json({ message: 'Pregunta de seguridad actualizada correctamente' });
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

//funcion para login
export const login = async (req, res) => {
    const { Username, Password } = req.body;
    if (Username && Password) {
        let query = "SELECT * FROM socios WHERE Username = ?";
        let [result] = await db.query(query, [Username.toLowerCase()]) as [Socio[], any];

        //validar que existe el usuario
        if (result.length > 0) {
            //validar que la contraseña sea correcta
            if (await validar_password(result[0].Socio_id, Password)) {
                //generar token
                const token = jwt.sign({
                    Username: result[0].Username,
                    Socio_id: result[0].Socio_id
                } as CustomJwtPayload, secret);

                //mandando token por el header
                return res.status(200).json({ code: 200, message: 'Usuario autenticado', token, data: { Socio_id: result[0].Socio_id, Username: result[0].Username, Nombres: result[0].Nombres } });
            }
            else {
                return res.status(401).json({ code: 400, message: 'Contraseña incorrecta' });
            }
        }
        else {
            //usuario no existe
            return res.status(400).json({ code: 400, message: 'Usuario no existe' });
        }
    } else {
        //campos incompletos
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }
}

// Funcion para cambiar la contraseña
export const cambiar_password = async (req: SocioRequest<any>, res) => {
    const { id_socio_actual } = req;
    const { Password } = req.body;

    if (campos_incompletos({ Password })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    try {
        await actualizaPassword(id_socio_actual!, Password);
        return res.status(200).json({ code: 200, message: 'Contraseña actualizada' });
    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

//funcion para Recuperar Contraseña
export const recuperar_password = async (req, res) => {
    const { Username, Pregunta_id, Respuesta, Password } = req.body;

    if (campos_incompletos({ Username, Pregunta_id, Respuesta, Password })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    try {
        //validar que existe el usuario
        const socio = await existe_socio(Username);
        //validar que la pregunta es correcta
        await validarPregunta(socio.Socio_id!, Pregunta_id, Respuesta);
        //validar que la contraseña sea correcta
        await validar_password(socio.Socio_id, Password);

        //cambiar la contraseña
        let query = "UPDATE socios SET Password = ? WHERE Username = ?";
        await db.query(query, [bcrypt.hashSync(Password, 10), Username]);
        return res.status(200).json({ code: 200, message: 'Contraseña cambiada' });
    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// controlador para validar pregunta de seguridad
export const validar_pregunta_seguridad = async (req: SocioRequest<any>, res) => {
    const { Username, Pregunta_id, Respuesta } = req.body;

    if (campos_incompletos({ Username, Pregunta_id, Respuesta })) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    try {
        //validar que existe el usuario
        const socio = await existe_socio(Username);
        //validar que la pregunta es correcta
        await validarPregunta(socio.Socio_id!, Pregunta_id, Respuesta);

        return res.status(200).json({ code: 200, message: 'Datos correctos' });
    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }

}

// controlador para unirse a grupo
export const unirse_grupo = async (req: SocioRequest<any>, res) => {
    // si el socio no esta en el grupo, se agrega
    // si el socio ya esta en el grupo, error.
    // Si el grupo es nuevo (no tiene acuerdos) solo se agrega al socio
    // Si el grupo ya tiene acuerdos, se agrega al socio y se asignan las acciones **error

    const { id_socio_actual } = req;
    const { Codigo_grupo } = req.body;

    if (campos_incompletos({ Codigo_grupo })) {
        return res.status(400).json({ code: 400, message: "campos incompletos" });
    }

    const con = await db.getConnection();
    try {
        await con.beginTransaction();

        // validar que el grupo exista
        const grupo = await existeGrupo(Codigo_grupo);

        let query = "SELECT * FROM grupo_socio WHERE Socio_id = ? AND Grupo_id = ?";
        const [grupo_socio] = await con.query(query, [id_socio_actual, grupo.Grupo_id]) as [GrupoSocio[], any];


        // si el socio ya esta en el grupo
        if (grupo_socio.length != 0) {
            return res.status(400).json({ code: 400, message: "El socio ya está en el grupo" });
        }

        const campos_grupo_socio: GrupoSocio = {
            Socio_id: id_socio_actual!,
            Grupo_id: grupo.Grupo_id!,
            Acciones: 0,
            Status: 1,
            Tipo_socio: "SOCIO",
        };

        query = "INSERT INTO grupo_socio SET ?";
        const [resultado_socio] = await con.query(query, campos_grupo_socio) as [OkPacket, any];
        console.log(resultado_socio)
        let query2 = "SELECT * FROM acuerdos WHERE Grupo_id = ? and Status = 1";
        const acuerdo = (await con.query(query2, [grupo.Grupo_id]))[0][0] as Acuerdo;
        // AQUI ES DONDE COMPRA LAS ACCIONES
        // si hay acuerdo actual, se le asignan las acciones
        // para este caso permitir null en la sesion porq no necesita de una sesion para comprar acciones si se esta uniendo
        //o como deberia funcionar en persona??
        if (acuerdo !== undefined) {
            comprar_acciones(id_socio_actual!, grupo.Grupo_id, acuerdo.Minimo_aportacion, con,true);
        }
        con.commit();
        
        return res.status(200).json({ code: 200, message: "El socio se ha unido correctamente", Grupo_id: grupo.Grupo_id });
    } catch (error) {
        con.rollback();
        const { message, code } = catch_common_error(error);
        return res.status(code).json({ code, message });
    }
}

// controlador para retirar ganancias del socio en el grupo
// obtiene el id del socio de los parametros y del grupo del req
export const retirar_ganancias = async (req: AdminRequest<any>, res) => {
    const Socio_id = Number(req.params.Socio_id);
    const { id_grupo_actual } = req;

    try {
        // validar que el socio pertenezca al grupo
        const grupo_socio = await socioEnGrupo(Socio_id, id_grupo_actual!);

        // marcar ganancias como retiradas
        let query = `
        UPDATE ganancias
        SET ganancias.Entregada = 1
        WHERE Socio_id = ? -- de cierto socio
        AND ganancias.Sesion_id IN (
            SELECT sesiones.Sesion_id
            FROM sesiones
            WHERE sesiones.Grupo_id = ? -- de cierto grupo
        )
        `

        await db.query(query, [Socio_id, id_grupo_actual]);

        // enviar respuesta
        return res.status(200).json({ code: 200, message: "Ganancias retiradas" });
    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const enviar_grupos_socio = async (req: SocioRequest<any>, res) => {
    const { id_socio_actual } = req;

    try {
        const grupos: Grupo[] = await grupos_del_socio(id_socio_actual!);
        const data: { Grupo_id: number, Nombre: string, Rol_socio: "ADMIN" | "SOCIO" | "SUPLENTE" | "CREADOR" }[] = [];
        for (const grupo of grupos) {
            data.push({
                Grupo_id: grupo.Grupo_id!,
                Nombre: grupo.Nombre_grupo,
                Rol_socio: (await obtenerGrupoSocio(id_socio_actual!, grupo.Grupo_id!)).Tipo_socio,
            });
        }

        return res.status(200).json({ code: 200, message: "Información de los grupos", data });

    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const enviar_socio = async (req: SocioRequest<any>, res) => {
    const { id_socio_actual } = req;

    try {
        const socio = await existeSocio(id_socio_actual!);
        return res.status(200).json({
            code: 200, message: "Información del socio", data: {
                Nombres: socio.Nombres,
                Apellidos: socio.Apellidos,
                CURP: socio.CURP,
                Fecha_nac: socio.Fecha_nac,
                Nacionalidad: socio.Nacionalidad,
                Sexo: socio.Sexo,
                Escolaridad: socio.Escolaridad,
                Ocupacion: socio.Ocupacion,
                Estado_civil: socio.Estado_civil,
                Hijos: socio.Hijos,
                Telefono: socio.Telefono,
                Email: socio.Email,
                Localidad: socio.Localidad,
                Municipio: socio.Municipio,
                Estado: socio.Estado,
                CP: socio.CP,
                Pais: socio.Pais,
                Foto_perfil: socio.Foto_perfil,
                Username: socio.Username
            }
        });

    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const modificar_socio = async (req: SocioRequest<any>, res: Response) => {
    const { id_socio_actual } = req;

    const campos = ["Nombres", "Apellidos", "CURP", "Fecha_nac", "Nacionalidad", "Sexo", "Escolaridad", "Ocupacion", "Estado_civil", "Hijos", "Telefono", "Email", "Localidad", "Municipio", "Estado", "CP", "Pais", "Foto_perfil", "Username"];

    // Extraer los campos existentes del req.body
    let campos_socio: any = {};
    for (let campo in req.body) {
        if (campos.includes(campo)) {
            campos_socio[campo] = req.body[campo];
        } else {
            return res.status(400).json({ message: `El campo '${campo}', no existe o no se puede modificar` })
        }
    }

    try {
        const socio = await existeSocio(id_socio_actual!);

        // validar que haya al menos un campo
        if (Object.keys(campos_socio).length == 0) {
            return res.status(400).json({ code: 400, message: "No se ha enviado ningún campo" });
        }

        // validar que el username no exista
        if (campos_socio.Username && campos_socio.Username != socio.Username) {
            if (await existeUsername(campos_socio.Username)) {
                return res.status(400).json({ code: 400, message: "El username ya existe" });
            }
        }

        // validar que el CURP no exista
        if (campos_socio.CURP && campos_socio.CURP != socio.CURP) {
            if (await existeCurp(campos_socio.CURP)) {
                return res.status(400).json({ code: 400, message: "El CURP ya existe" });
            }

            // validar que el CURP sea valido
            if (!validarCurp(campos_socio.CURP)) {
                return res.status(400).json({ code: 400, message: "El CURP no es valido" });
            }
        }

        // modificar los datos del socio
        let query = "UPDATE socios SET ? WHERE Socio_id = ?";
        await db.query(query, [campos_socio, id_socio_actual]);

        return res.status(200).json({ code: 200, message: "Socio modificado" });
    } catch (error) {
        const { message, code } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const get_usuario_ganancias = async (req: AdminRequest<Grupo>, res) => {
    const Grupo_id = Number(req.id_grupo_actual);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);
        const acuerdo = await obtenerAcuerdoActual(Grupo_id);

        //Total de ganancias que puede retirar un socio
        let query = `SELECT ganancias.Socio_id, socios.Nombres, socios.Apellidos, SUM(ganancias.Monto_ganancia) as Ganancias
        FROM ganancias
        JOIN socios ON socios.Socio_id = ganancias.Socio_id
        JOIN sesiones ON sesiones.Sesion_id = ganancias.Sesion_id
        JOIN grupo_socio ON grupo_socio.Socio_id = socios.Socio_id
        WHERE sesiones.Grupo_id = ? AND ganancias.Entregada = 0 AND grupo_socio.Status = 1 AND sesiones.Fecha <= (SELECT Fecha FROM sesiones WHERE Tipo_sesion = 1 AND Grupo_id = ? ORDER BY Sesion_id DESC LIMIT 1)
        group by ganancias.Socio_id`;
        const [ganancias] = await db.query(query, [Grupo_id, Grupo_id]);

        return res.status(200).json({ code: 200, message: 'Ganancias obtenidas', data: ganancias });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const get_usuario_status = async (req: AdminRequest<Grupo>, res) => {
    const Grupo_id = Number(req.id_grupo_actual);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        //Obetener el nombre y apellidos de los socios y su status en el grupo
        let query = "SELECT so.Socio_id, CONCAT(so.Nombres, ' ', so.Apellidos) AS Nombre, gs.Status FROM socios so JOIN grupo_socio gs ON so.Socio_id = gs.Socio_id WHERE gs.Grupo_id = ? AND gs.Status != 2";
        const [socios] = await db.query(query, [Grupo_id]);


        return res.status(200).json({ code: 200, message: 'Socios obtenidos', socios: socios });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const post_usuario_status = async (req: AdminRequest<GrupoSocio>, res) => {
    const Grupo_id = Number(req.id_grupo_actual);
    const Socio_id = req.params.Socio_id
    const Status = req.body.Status

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id);

        //Actualizar el status de un socio dentro de un grupo
        let query = "UPDATE grupo_socio SET Status = ? WHERE Socio_id = ? AND Grupo_id = ?";
        await db.query(query, [Status, Socio_id, Grupo_id]);

        return res.status(200).json({ code: 200, message: 'Status de socio actualizado' });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

// ResBody = 
/**
 *
prestamosPagados
multas pagadas
accionesCompradas
accionesRetiradas
 */
export const miniResumen = async (req: AdminRequest<any>, res) => {
    const { id_grupo_actual: Grupo_id } = req;
    const Socio_id = Number(req.params.Socio_id);

    try {
        // Validar que haya una sesion activa
        const sesionActual = await obtenerSesionActual(Grupo_id!);
        const socioGrupo = socioEnGrupo(Socio_id, Grupo_id!);

        // Calcular el total de prestamos pagados en la sesion por medio de las transacciones
        // select cuenta de prestamos en los que la sesion sea la sesion actual, el socio sea el socio actual y el Catalogo_id = "ABONO_PRESTAMO"
        let query = `
        SELECT COUNT(*) as prestamosPagados
        FROM transacciones
        where transacciones.Sesion_id = ?
        AND transacciones.Socio_id = ?
        AND transacciones.Catalogo_id = 'ABONO_PRESTAMO'
        `;
        const { prestamosPagados } = (await db.query<RowDataPacket[]>(query, [sesionActual.Sesion_id, Socio_id]))[0][0];

        // Calcular el total de multas pagadas en la sesion por medio de las transacciones
        // catalogo_id = 'PAGO_MULTA'
        query = `
        SELECT COUNT(*) as multasPagadas
        FROM transacciones
        where transacciones.Sesion_id = ?
        AND transacciones.Socio_id = ?
        AND transacciones.Catalogo_id = 'PAGO_MULTA'
        `;
        const { multasPagadas } = (await db.query<RowDataPacket[]>(query, [sesionActual.Sesion_id, Socio_id]))[0][0];

        // Calcular el total de acciones compradas en la sesion por medio de las transacciones
        // catalogo_id = 'COMPRA_ACCION', obtener la suma de transaccion.Cantidad_movimiento
        query = `
        SELECT SUM(transacciones.Cantidad_movimiento) as accionesCompradas
        FROM transacciones
        where transacciones.Socio_id = ?
        AND transacciones.Catalogo_id = 'COMPRA_ACCION'
        AND transacciones.Sesion_id = ?
        `;
        const { accionesCompradas } = (await db.query<RowDataPacket[]>(query, [Socio_id, sesionActual.Sesion_id]))[0][0];

        // Calcular el total de acciones retiradas en la sesion por medio de las transacciones
        // catalogo_id = 'RETIRO_ACCION', obtener la suma de transaccion.Cantidad_movimiento
        query = `
        SELECT SUM(transacciones.Cantidad_movimiento) as accionesRetiradas
        FROM transacciones
        where transacciones.Socio_id = ?
        AND transacciones.Catalogo_id = 'RETIRO_ACCION'
        AND transacciones.Sesion_id = ?
        `;
        const { accionesRetiradas } = (await db.query<RowDataPacket[]>(query, [Socio_id, sesionActual.Sesion_id]))[0][0];

        return res.status(200).json({ code: 200, message: 'Resumen obtenido', data: { prestamosPagados, multasPagadas, accionesCompradas: Number(accionesCompradas), accionesRetiradas: Number(accionesRetiradas) } });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}