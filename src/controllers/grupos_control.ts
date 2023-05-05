import db from '../config/database';
import { crearGrupo } from '../services/Grupos.services';
import { calcularSesionesEntreAcuerdos, calcularSesionesParaAcuerdosFin } from '../services/Sesiones.services';
import { agregarSocioGrupo } from '../services/Socios.services';
import { SocioRequest } from '../types/misc';
import { getCommonError } from '../utils/utils';
import { campos_incompletos, Fecha_actual, generarCodigoValido } from '../utils/validaciones';

// Funcion para creacion de grupos
export const crear_grupo = async (req: SocioRequest<Grupo>, res) => {
    const id_socio_actual = req.id_socio_actual;

    // Recoger los datos del body
    const campos_grupo: Grupo = {
        Nombre_grupo: req.body.Nombre_grupo,
        Localidad: req.body.Localidad,
        Municipio: req.body.Municipio,
        Estado: req.body.Estado,
        CP: req.body.CP,
        Pais: req.body.Pais,
        Codigo_grupo: await generarCodigoValido(),
        Fecha_reg: Fecha_actual()
    };

    if (campos_incompletos(campos_grupo)) {
        return res.status(400).json({ code: 400, message: 'Campos incompletos' });
    }

    if (campos_grupo.Codigo_grupo === "-") {
        return res.status(500).json({ code: 500, message: 'Error interno del Servidor' });
    }

    try {
        const newgroup = await crearGrupo(campos_grupo);
        await agregarSocioGrupo(id_socio_actual!, campos_grupo.Codigo_grupo);

        return res.status(200).json({ code: 200, message: 'Grupo creado', data: { Codigo_grupo: campos_grupo.Codigo_grupo, Grupo_id: newgroup.insertId } });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}

export const get_info_grupo = async (req: SocioRequest<Grupo>, res) => {
    const id_socio_actual = req.id_socio_actual;
    const Grupo_id = req.params.Grupo_id;
    try {
        let query = "SELECT Nombre_grupo, Status, Codigo_grupo FROM grupos WHERE Grupo_id = ?";
        const [grupo] = await db.query(query, [Grupo_id]);
        let query2 = "SELECT Tipo_Socio FROM grupo_socio WHERE Grupo_id = ? AND Socio_id = ?";
        const [rol] = await db.query(query2, [Grupo_id, id_socio_actual]);
        let status = 'Inactivo'
        if(grupo[0].Status === 0){
            status = 'Eliminado'
        }else if(grupo[0].Status === 1){
            status = 'Activo'
        }else if(grupo[0].Status === 2){
            status = 'Pendiente'
        }
        let Codigo_grupo = 0;
        if(rol[0].Tipo_Socio=='ADMIN'){
            Codigo_grupo = grupo[0].Codigo_grupo
        }

        const Sesiones_restantes = await calcularSesionesParaAcuerdosFin(Number(Grupo_id));

        return res.status(200).json({ code: 200, message: 'Info seleccionada', data: { Nombre_grupo: grupo[0].Nombre_grupo, Status: status, Rol: rol[0].Tipo_Socio, Codigo_grupo: Codigo_grupo, Sesiones_restantes } });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}