import db from "../config/database";
import { getCommonError } from '../utils/utils';

// buscar una entidad en base a un codigo postal
export const buscar_entidad = async (req,res) => {
    const codigoPostal = req.params.codigoPostal
    try {
        // se obtiene el id del estado con dicho codigo postal
        let query =` SELECT * FROM estadosCodigos WHERE codigoPostal =?`
        let [data] = await db.query(query, codigoPostal);
        // console.log(data);
        // se obtiene el nombre del estado con el id recuperado
        let query2 =` SELECT estados.nombre FROM estados WHERE id =?`
        let [nombreEstado] = await db.query(query2, data[0].estadoId);
        // console.log(nombreEstado);

        // se obtiene el id  del municipio con el codigo postal
        let query3 =` SELECT municipiosCodigos.municipioId FROM municipiosCodigos WHERE codigoPostal =?`
        let [data3] = await db.query(query3, codigoPostal);
        console.log(data3);

        // se obtiene el nombre  del municipio con el codigo postal
        let query4 =` SELECT municipio.nombre FROM municipio WHERE id =?`
        let [nombreMunicipio] = await db.query(query4, data3[0].municipioId);

        // se obtienen las localidades que tienen ese codigo postal
        let query5 =` SELECT localidades.nombre FROM localidades WHERE codigoPostal =?`
        let [localidades] = await db.query(query5, codigoPostal);

        return res.json({ code: 200, data : {nombreEstado,nombreMunicipio,localidades}, }).status(200);
        //preguntar si el status al final funciona o tiene que ser al principio
    } catch (error) {
        const { code, message } = getCommonError(error);
        return res.json({ code, message }).status(code);
    }
}