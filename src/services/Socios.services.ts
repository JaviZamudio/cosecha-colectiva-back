import { compareSync, hashSync } from "bcrypt";
import { OkPacket, PoolConnection, RowDataPacket } from "mysql2";
import { Connection, Pool } from "mysql2/promise";
import db from "../config/database";
import { aplanar_respuesta, existe_pregunta } from "../utils/validaciones";
import { obtenerAcuerdoActual } from "./Acuerdos.services";
import { existeGrupo, grupoVacio } from "./Grupos.services";
import { obtenerPrestamosVigentes } from "./Prestamos.services";

/**
 * Funcion para verificar si un socio es administrador de un grupo.
 * 
 * @param Socio_id id del socio a verificar.
 * @param Grupo_id id del grupo a verificar.
 * @returns true si el socio es administrador del grupo
 * @throws Si el socio no es administrador del grupo.
 */
export const socio_es_admin = async (Socio_id: number, Grupo_id: number) => {
    // Verificar que el socio existe
    await existeSocio(Socio_id);
    // Verificar que el grupo existe
    await existeGrupo(Grupo_id);

    // Consultar si el socio es administrador del grupo
    const query = "SELECT * FROM grupo_socio WHERE grupo_socio.Grupo_id = ? AND grupo_socio.Socio_id = ? AND grupo_socio.Tipo_socio = 'ADMIN'";
    const [rows] = (await db.query(query, [Grupo_id, Socio_id]) as [GrupoSocio[], any]);

    // Si el socio no es administrador del grupo, lanzar error
    if (rows.length === 0) {
        throw { code: 403, message: "El socio no es administrador del grupo" };
    }

    return true;
}

/**
 * Funcion para verificar si un socio es socio de un grupo.
 * 
 * @param Socio_id id del socio a verificar.
 * @param Grupo_id id del grupo a verificar.
 * @returns true si el socio es socio del grupo
 * @throws Si el socio no es socio del grupo.
 */
export const socio_es_socio = async (Socio_id: number, Grupo_id: number) => {
    // Verificar que el socio existe
    await existeSocio(Socio_id);
    // Verificar que el grupo existe
    await existeGrupo(Grupo_id);

    // Consultar si el socio es socio del grupo
    const query = "SELECT * FROM grupo_socio WHERE grupo_socio.Grupo_id = ? AND grupo_socio.Socio_id = ?";
    const [rows] = (await db.query(query, [Grupo_id, Socio_id]) as [GrupoSocio[], any]);

    // Si el socio no es socio del grupo, lanzar error
    if (rows.length === 0) {
        throw { code: 403, message: "La persona no es socio del grupo" };
    }

    return true;
}

/**
 * Funcion para agregar un socio a un grupo.
 * 
 * @param Socio_id id del socio que agrega al grupo.
 * @param Codigo_grupo codigo del grupo al que se agrega el socio.
 * @throws Si ocurre un error.
 */
export async function agregarSocioGrupo(Socio_id: number, Codigo_grupo: string) {
    const grupo = await existeGrupo(Codigo_grupo);

    let query = "SELECT * FROM grupo_socio WHERE Socio_id = ? AND Grupo_id = ?";
    const [grupo_socio] = await db.query(query, [Socio_id, grupo.Grupo_id]) as [GrupoSocio[], any];

    // Si el socio está activo o congelado en el grupo
    if (grupo_socio.length > 0 && grupo_socio[0].Status != 0) {
        throw "El socio ya está en el grupo";
    }

    // agregar el socio al grupo
    const campos_grupo_socio: GrupoSocio = {
        Tipo_socio: await grupoVacio(grupo.Grupo_id!) ? "ADMIN" : "SOCIO",
        Grupo_id: grupo.Grupo_id!,
        Socio_id: Socio_id
    };

    query = "INSERT INTO grupo_socio SET ?";
    return (await db.query(query, [campos_grupo_socio]) as [OkPacket, any])[0];
}

/**
 * Comprueba si un socio existe en la base de datos.
 * @param Socio Objeto de tipo Socio o id del socio.
 * @returns Objeto de tipo Socio.
 * @throws Si no existe el socio.
 */
export const existeSocio = async (Socio: Socio | number): Promise<Socio> => {
    // Asegurarse de que Socio es numero
    if (typeof Socio !== "number") {
        Socio = Socio.Socio_id!;
    }

    const socio = (await db.query("SELECT * FROM socios WHERE Socio_id = ?", [Socio]) as [RowDataPacket[], any])[0][0] as Socio | undefined;

    if (socio !== undefined) {
        return socio;
    }

    throw `No existe el Socio con el id: ${Socio}`;
}

/**
 * Regresa una lista de Grupos de los que el socio es miembro.
 * @param Socio Objeto de tipo Socio o id del socio.
 * @returns Array de objetos de tipo Grupo.
 */
export const grupos_del_socio = async (Socio: Socio | number): Promise<Grupo[]> => {
    // Asegurarse de que Socio es numero
    if (typeof Socio !== "number") {
        Socio = Socio.Socio_id!;
    }

    return (await db.query(`
    SELECT *
    FROM grupos
    JOIN grupo_socio ON grupo_socio.Grupo_id = grupos.Grupo_id
    WHERE grupo_socio.Socio_id = ?
    `, [Socio]) as [RowDataPacket[], any])[0].map((row) => row as Grupo);
}

/**
 * Comprueba si el socio pertenece al grupo.
 * @param Socio Objeto de tipo Socio o id del socio.
 * @param Grupo Objeto de tipo Grupo o id del grupo.
 * @returns Objeto de tipo GrupoSocio.
 * @throws Si el socio no pertenece al grupo.
 */
export const socioEnGrupo = async (Socio: Socio | number, Grupo: Grupo | number) => {
    // Asegurarse de que Socio es numero
    if (typeof Socio !== "number") {
        Socio = Socio.Socio_id!;
    }
    // Asegurarse de que Grupo es numero
    if (typeof Grupo !== "number") {
        Grupo = Grupo.Grupo_id!;
    }

    const result = (await db.query("SELECT * FROM grupo_socio WHERE Socio_id = ? and Grupo_id = ?", [Socio, Grupo]) as [RowDataPacket[], any])[0];

    if (result.length === 0) {
        throw "El socio no pertenece al grupo";
    }

    return result[0] as GrupoSocio;
}

/**
 * Comprueba que la pregunta de seguridad sea correcta.
 * @param Socio Objeto de tipo Socio o id del socio.
 * @param Pregunta_id id de la pregunta de seguridad.
 * @param Respuesta respuesta de la pregunta de seguridad.
 * @returns True si la respuesta es correcta.
 * @throws Si la respuesta es incorrecta.
 */
export const validarPregunta = async (Socio: Socio | number, Pregunta_id: number, Respuesta: string) => {
    // Asegurarse de que Socio es numero
    if (typeof Socio !== "number") {
        Socio = Socio.Socio_id!;
    }

    await existeSocio(Socio);
    await existe_pregunta(Pregunta_id);

    // aplanar la respuesta
    Respuesta = aplanar_respuesta(Respuesta);

    const query = "SELECT * FROM preguntas_socios WHERE Socio_id = ? AND Pregunta_id = ?";
    const [preguntas_socios] = await db.query(query, [Socio, Pregunta_id]) as [PreguntaSocio[], any];

    let respuesta_es_correcta = false;
    if (preguntas_socios.length !== 0) {
        respuesta_es_correcta = compareSync(Respuesta, preguntas_socios[0]?.Respuesta);
    }

    if (!respuesta_es_correcta) {
        throw "Pregunta y/o Respuesta incorrectas";
    }
}

/**
 * Valida que el Password sea correcto
 * @param Socio_id El id del socio
 * @param Password Password del socio
 * @returns True si el socio existe y su password es correcto
 * @throws Error si el socio no existe o el password es incorrecto
 */
export const validarPassword = async (Socio_id: number, Password: string) => {
    const socio = await existeSocio(Socio_id);
    const password_es_correcto = compareSync(Password, socio.Password);

    if (!password_es_correcto) {
        throw "Password incorrecto";
    }

    return true;
}

/**
 * Funcion para actualizar el password del socio
 * @param Socio_id El id del socio
 * @param Password El nuevo password del socio
 * @returns Un objeto de tipo OkPacket
 * @throws Error si el socio no existe
 */
export const actualizaPassword = async (Socio_id: number, Password: string) => {
    const socio = await existeSocio(Socio_id);
    Password = hashSync(Password, 10);

    const query = "UPDATE socios SET Password = ? WHERE Socio_id = ?";
    const [result] = await db.query(query, [Password, Socio_id]) as [OkPacket, any];

    return result;
}

/**
 * Funcion para crear una pregunta de seguridad para un socio
 * @param preguntaSocio Objeto de tipo PreguntaSocio
 * @returns Un objeto de tipo OkPacket
 */
export const crearPreguntaSocio = async (preguntaSocio: PreguntaSocio, con?: Connection | Pool) => {
    if (con === undefined) {
        con = db;
    }

    const pregunta = await existe_pregunta(preguntaSocio.Pregunta_id);

    // aplanar la respuesta
    preguntaSocio.Respuesta = aplanar_respuesta(preguntaSocio.Respuesta);
    // encriptar la respuesta
    preguntaSocio.Respuesta = hashSync(preguntaSocio.Respuesta, 10);

    const query = "INSERT INTO preguntas_socios SET ?";
    const [result] = await con.query(query, [preguntaSocio]) as [OkPacket, any];

    return result;
}

/**
 * Funcion para actualizar una pregunta de seguridad para un socio
 * @param preguntaSocio Objeto de tipo PreguntaSocio
 * @returns Un objeto de tipo OkPacket
 */
export const actualizaPreguntaSocio = async (preguntaSocio: PreguntaSocio, con?: Connection | Pool) => {
    if (con === undefined) {
        con = db;
    }

    const socio = await existeSocio(preguntaSocio.Socio_id);
    const pregunta = await existe_pregunta(preguntaSocio.Pregunta_id);

    // Aplanar la respuesta
    preguntaSocio.Respuesta = aplanar_respuesta(preguntaSocio.Respuesta);
    // Encriptar la respuesta
    preguntaSocio.Respuesta = hashSync(preguntaSocio.Respuesta, 10);

    const query = "UPDATE preguntas_socios SET ? WHERE Socio_id = ?";
    const [result] = await con.query(query, [preguntaSocio, preguntaSocio.Socio_id]) as [OkPacket, any];

    return result;
}

/**
 * Funcion para obtener objeto una relacion grupo-socio. Para sabe
 * @param Socio_id El id del socio
 * @param Grupo_id El id del grupo
 * @returns Un objeto de tipo GrupoSocio
 * @throws Si los datos no son validos
 */
export const obtenerGrupoSocio = async (Socio_id: number, Grupo_id: number) => {
    const query = "SELECT * FROM grupo_socio WHERE Socio_id = ? AND Grupo_id = ?";
    const [result] = await db.query(query, [Socio_id, Grupo_id]) as [GrupoSocio[], any];

    if (result.length === 0) {
        throw "El socio no pertenece al grupo";
    }

    return result[0] as GrupoSocio;
}

/**
 * Funcion para obtener el limite de credito disponible para un socio
 * @param Socio_id El id del socio
 * @param Grupo_id El id del grupo
 * @returns El limite de credito disponible
 * @throws Si hay algun error
 */
export const obtenerLimiteCreditoDisponible = async (Socio_id: number, Grupo_id: number) => {
    const grupoSocio = await socioEnGrupo(Socio_id, Grupo_id);
    const acuerdoActual = await obtenerAcuerdoActual(Grupo_id);
    const prestamosVigentes = await obtenerPrestamosVigentes(Grupo_id, Socio_id);
    const prestamosVigentesTotal = prestamosVigentes.reduce((total, prestamo) => total + (prestamo.Monto_prestamo), 0);
    const limiteCreditoTotal = acuerdoActual.Limite_credito * grupoSocio.Acciones!;

    return limiteCreditoTotal - prestamosVigentesTotal;
}

/**
 * Funcion para saber si un Username ya existe
 * @param Username El username a buscar
 * @returns True o false dependiendo si el username ya existe
 * @throws Si hay algun error
 */
export const existeUsername = async (Username: string) => {
    const query = "SELECT * FROM socios WHERE Username = ?";
    const [result] = await db.query(query, [Username]) as [Socio[], any];

    if (result.length === 0) {
        return false;
    }

    return true;
}

/**
 * Funcion para saber si un Curp ya existe
 * @param Curp El curp a buscar
 * @returns True o false dependiendo si el curp ya existe
 */
export const existeCurp = async (Curp: string) => {
    const query = "SELECT * FROM socios WHERE Curp = ?";
    const [result] = await db.query(query, [Curp]) as [Socio[], any];

    if (result.length === 0) {
        return false;
    }

    return true;
}