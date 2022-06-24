import { Fecha_actual } from "../funciones_js/validaciones";

const db = require("../../config/database");

//crear nueva sesion
export const crear_sesion = async (req, res) => {
    const Fecha_sesion = Fecha_actual();
    //obtener id del grupo del body
    const Grupo_id = req.body.Grupo_id;
    //comprobar que haya Grupo_id
    if(Grupo_id){
        // obtener caja final de la sesion anterior
        let query = "SELECT Caja FROM sesiones WHERE Grupo_id = ? ORDER BY Fecha DESC LIMIT 1";
        const rows = await db.query(query, [req.body.Grupo_id]);
        const Caja = rows[0] ? rows[0].Caja : 0 
        //insertar sesion
        try{
            let query = "INSERT INTO sesiones (Fecha, Caja, Grupo_id) VALUES (?, ?, ?)";
            db.query(query, [Fecha_sesion, Caja, Grupo_id]);
            res.json({code: 200, message: 'Sesion creada'}).status(200);
        }catch(err){
            res.json({code: 500, message: 'Error al crear sesion'}).status(500);
        }
    }else{
        // campos incompletos
        res.json({code: 400, message: 'No se envio el id del grupo'}).status(400);
    }

    /* Codigos de respuesta
    200: Sesion creada
    400: Campos incompletos
    500: Error al crear sesion
    */

    /* Json de prueba 
    {
        "Grupo_id": 4
    }
    */
}

// registrar asistencias de un grupo
//recibe el id de la sesion y un array de json con {Socio_id, Presente}
export const registrar_asistencias = async (req, res) => {
    // const {session_id, Socios} = req.body;

    const {Sesion_id, Socios} = req.body;

    //comprobar que haya Sesion_id y Socios
    if(!Sesion_id || !Socios){
        // campos incompletos
        return res.json({code: 400, message: 'Campos incompletos'}).status(400);
    }

    //registrar asistencias
    try{
        for(let i = 0; i < Socios.length; i++){
            let query = "INSERT INTO asistencias (Presente, Sesion_id, Socio_id) VALUES (?, ?, ?)";
            db.query(query, [Socios[i].Presente, Sesion_id, Socios[i].Socio_id]);
        }
    }catch(err){
        return res.json({code: 500, message: 'Error al registrar asistencias'}).status(500);
    }
    
    return res.json({code: 200, message: 'Asistencias registradas'}).status(200);
}