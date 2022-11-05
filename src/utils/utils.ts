import { node_env } from "../config/config";
import { CommonError } from "../types/misc";

/**
 * Recibe un error y lo convierte en uno listo para el front
 * @param error El error obtenido del catch
 * @returns Un error formateado como CommonError
 */
export const getCommonError = (error: string | CommonError | Error | any): CommonError => {
    console.log(error);
    if (typeof (error) === "string") {
        return { code: 400, message: error };
    }

    if ("code" in error && "message" in error && typeof (error["code"]) === "number") {
        return error;
    }

    return { message: "Error interno del servidor", code: 500 };
}

export const validarCurp = function (curp: string) {
    const regex = /^([A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d])(\d)$/;
    if (regex.test(curp) || node_env === "DEV" || node_env === "test") {
        return true;
    } else {
        return false;
    }
}

export const formatearFecha = function (date: Date) {
    var year = date.getFullYear();
    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month; //agrega un 0 si es menor a 10. ej: 9 => 09
    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day; //agrega un 0 si es menor a 10. ej: 9 => 09
    return year + '-' + month + '-' + day;
}

export const eleccion = (...values) => {
    const num = Math.random();

    let index = 0;

    values.forEach((value, ind) => {
      if ((num >= ind / values.length && num <= (ind + 1) / values.length))
      index = ind;
      return ind;
    })

    return values[index];
}

export const fechaActual = function () {
    var now = new Date();
    return formatearFecha(now);
}

// Funcion para saber si un json tiene campos como undefined
export const camposIncompletos = ( objeto: object) => {
    for (let key in objeto) {
        if (objeto[key] === undefined) {
            console.log(key);
            return true;
        }
    }

    return false;
}

/**
 * Funcion para validar fecha
 * @param fecha La fecha a validar
 * @returns true si es valida, false si no lo es
 */
export const validarFecha = (fecha: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(fecha)) {
        return true;
    } else {
        return false;
    }
}