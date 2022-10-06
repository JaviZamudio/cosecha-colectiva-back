import { crearGrupo } from '../services/Grupos.services';
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
        await crearGrupo(campos_grupo);

        await agregarSocioGrupo(id_socio_actual!, campos_grupo.Codigo_grupo);

        return res.status(200).json({ code: 200, message: 'Grupo creado' });
    } catch (error) {
        console.log(error);
        const { code, message } = getCommonError(error);
        return res.status(code).json({ code, message });
    }
}