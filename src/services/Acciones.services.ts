import { obtener_acuerdos_activos } from "../utils/validaciones";

/**
 * Funcion para comprar acciones para un socio en un grupo
 * @param Socio_id id del socio que quiere comprar acciones
 * @param Grupo_id id del grupo en el que se compraran las acciones
 * @param Cantidad cantidad de acciones en dinero que quiere comprar
 * @returns Objeto de tipo OkPacket
 * @throws Error si no se puede comprar las acciones
 */
export const comprar_acciones = async (Socio_id, Grupo_id, Cantidad) => {
    // Verificar que la cantidad sea divisible por el costo de una accion
    // Obtener el costo de una accion
    const costo_accion = await obtener_costo_accion(Grupo_id);
    if (Cantidad % costo_accion !== 0) {
        throw `La cantidad de acciones no es divisible por el costo de una accion(${costo_accion})`;
    }
}

/**
 * Funcion para obtener el costo de una accion en un grupo segun los acuerdos actuales
 * @param Grupo_id id del grupo en el que se compraran las acciones
 * @returns costo de una accion
 * @throws Error si no se puede obtener el costo de una accion
 */
export async function obtener_costo_accion(Grupo_id: any) {
    const acuerdos = await obtener_acuerdos_activos(Grupo_id);
    return acuerdos.Costo_acciones;
}
