import db from '../config/database';
import { comprar_acciones } from '../services/Acciones.services';
import { obtenerAcuerdoActual } from '../services/Acuerdos.services';
import { obtenerSociosGrupo } from '../services/Grupos.services';
import { AdminRequest } from '../types/misc';
import { fechaActual, getCommonError } from '../utils/utils';
import { campos_incompletos, existe_grupo, Fecha_actual, socio_en_grupo } from '../utils/validaciones';

// funcion para crear acuerdos
export const crear_acuerdos = async (req: AdminRequest<Acuerdo>, res) => { //
    const { id_grupo_actual } = req;

    // Recoger los campos del acuerdo del body
    const campos_acuerdo: Acuerdo = {
        Grupo_id: id_grupo_actual!,
        Fecha_acuerdos: Fecha_actual(),
        Fecha_acuerdos_fin: req.body.Fecha_acuerdos_fin,
        Periodo_reuniones: req.body.Periodo_reuniones,
        Periodo_cargos: req.body.Periodo_cargos,
        Limite_inasistencias: req.body.Limite_inasistencias,
        Minimo_aportacion: req.body.Minimo_aportacion,
        Costo_acciones: req.body.Costo_acciones,
        Tasa_interes: req.body.Tasa_interes,
        Limite_credito: req.body.Limite_credito,
        Porcentaje_fondo_comun: req.body.Porcentaje_fondo_comun,
        Creditos_simultaneos: req.body.Creditos_simultaneos,
        Interes_morosidad: req.body.Interes_morosidad,
        Ampliacion_prestamos: req.body.Ampliacion_prestamos, // true o false
        Interes_ampliacion: req.body.Ampliacion_prestamos == 1 ? req.body.Interes_ampliacion : null, // si ampliacion prestamos... agrega interes ampliacion
        Mod_calculo_interes: req.body.Mod_calculo_interes,
        Tasa_interes_prestamo_grande: req.body.Tasa_interes_prestamo_grande,
        Id_socio_administrador: req.body.Id_socio_administrador,
        Id_socio_administrador_suplente: req.body.Id_socio_administrador_suplente,
        Status: 1,
    };

    if (campos_incompletos(campos_acuerdo)) {
        return res.status(400).json({ code: 400, message: "Campos incompletos" });
    }

    try {
        // Generar transaction en la base de datos
        const con = await db.getConnection();
        await con.beginTransaction();

        try {
            // comprobar que el grupo existe
            await existe_grupo(campos_acuerdo.Grupo_id);
            // comprobar que el administrador es miembro del grupo
            await socio_en_grupo(campos_acuerdo.Id_socio_administrador, campos_acuerdo.Grupo_id);
            // comprobar que el administrador suplente es miembro del grupo
            await socio_en_grupo(campos_acuerdo.Id_socio_administrador_suplente, campos_acuerdo.Grupo_id);

            // Si el grupo es nuevo (no tiene acuerdos anteriores) hay que asignar las acciones a cada socio
            let esGrupoNuevo = false;
            try {
                await obtenerAcuerdoActual(id_grupo_actual!);
            } catch (error) {
                esGrupoNuevo = true;
            }

            // Actualizar status del acuerdo anterior
            let query = "UPDATE acuerdos SET Status = 0 WHERE Grupo_id = ? and Status = 1";
            await con.query(query, [campos_acuerdo.Grupo_id]);

            // Crear el registro
            query = "INSERT INTO acuerdos SET ?";
            await con.query(query, [campos_acuerdo]);

            // Cambiar el socio de admin y suplente a normal
            query = "UPDATE grupo_socio SET Tipo_socio = 'SOCIO' WHERE Grupo_id = ? AND (Tipo_socio = 'ADMIN' or Tipo_socio = 'SUPLENTE')";
            await con.query(query, [campos_acuerdo.Grupo_id]);

            // Actualizar tipo socio a administrador
            query = "UPDATE grupo_socio SET Tipo_socio = 'ADMIN' WHERE Grupo_id = ? AND Socio_id = ?";
            await con.query(query, [campos_acuerdo.Grupo_id, campos_acuerdo.Id_socio_administrador]);

            // Actualizar tipo socio a Suplente
            query = "UPDATE grupo_socio SET Tipo_socio = 'SUPLENTE' WHERE Grupo_id = ? AND Socio_id = ?";
            await con.query(query, [campos_acuerdo.Grupo_id, campos_acuerdo.Id_socio_administrador_suplente]);

            // si es grupo nuevo, asignar las acciones
            if (esGrupoNuevo) {
                const socios_grupo = await obtenerSociosGrupo(id_grupo_actual!);

                for (const grupoSocio of socios_grupo) {
                    console.log("Asignando acciones a socio: " + grupoSocio.Socio_id);
                    await comprar_acciones(grupoSocio.Socio_id, grupoSocio.Grupo_id, campos_acuerdo.Minimo_aportacion, con);
                }
            }

            // Hacer commit en la bd
            await con.commit();

            return res.status(200).json({ code: 200, message: "Acuerdo registrado correctamente" });
        } catch (error) {
            await con.rollback();
            throw error;
        } finally {
            con.release();
        }
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

//funcion para crear acuerdo secundario
export const crear_acuerdo_secundario = async (req: AdminRequest<AcuerdoSecundario>, res) => {
    const campos_acuerdo_secundario: AcuerdoSecundario = {
        Grupo_id: req.id_grupo_actual!,
        Regla: req.body.Regla,
        Acuerdo: req.body.Acuerdo,
        Fecha_acuerdo: fechaActual(),
        Fecha_acuerdo_fin: req.body.Fecha_acuerdo_fin,
        Status: 1
    }

    // Verificar que los campos esten completos
    if (campos_incompletos(campos_acuerdo_secundario)) {
        return res.status(400).json({ code: 400, message: "Campos incompletos" });
    }

    try {
        // Verificar que el grupo existe
        await existe_grupo(campos_acuerdo_secundario.Grupo_id);

        let query = "INSERT INTO acuerdos_secundarios SET ?";
        await db.query(query, [campos_acuerdo_secundario]);

        return res.status(200).json({ code: 200, message: "Acuerdo secundario registrado correctamente" });
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}
