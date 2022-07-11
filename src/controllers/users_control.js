const jwt = require('jsonwebtoken');
const db = require('../../config/database');
var bcrypt = require('bcrypt');
const {secret} = require('../../config/config');
import {validarCurp, Fecha_actual, campos_incompletos} from '../funciones_js/validaciones';

export const register = async (req, res, next) => {
    // Recoger los datos del body
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
        Username: req.body.Username,
        Password: req.body.Password,
        Fecha_reg: Fecha_actual(),
    };
    
    //campos incompletos
    if(campos_incompletos(campos_usuario)){
        res.status(400).json({code: 400, message: 'Campos incompletos'});
    }
    
    //comprobar que el usuario no exista
    let query = "SELECT * FROM socios WHERE Username = ?";
    const rows = await db.query(query, [campos_usuario.Username]);
    if(rows.length > 0){
        return res.status(400).json({ code: 400, message: 'El usuario ya existe' });
    }

    //comprobar que el curp sea valido
    if(!validarCurp(campos_usuario.CURP)){
        return res.status(400).json({ code: 400, message: 'El curp no es valido' });
    }
    //comprobar que el curp sea unico
    query = "SELECT * FROM socios WHERE CURP = ?";
    const curpsIguales = await db.query(query, [campos_usuario.CURP]);
    if(curpsIguales.length > 0){
        return res.status(400).json({ code: 400, message: 'El curp ya existe' });
    }

    //comprobar que los campos esten completos
    var BCRYPT_SALT_ROUNDS =12   //variable para indicar los saltos a bcrypt
        bcrypt.hash(campos_usuario.Password, BCRYPT_SALT_ROUNDS)
        .then(async function(hashedPassword){
            campos_usuario.Password = hashedPassword;

            let query = "INSERT INTO socios SET ?";
            const result = await db.query(query, campos_usuario);

            // res.json({code: 200, message: 'Usuario guardado'}).status(200);
            console.log(result);

            //Preparando el Next:
            const {Pregunta_id, Respuesta} = req.body;
            req.body = {
                Socio_id : result.insertId,
                Pregunta_id : Pregunta_id,
                Respuesta : Respuesta,
            };

            console.log("Antes del next");
            next();
            console.log("Despues del next");
        }
            
        )
        .catch(function(error){
            res.status(500).json({code: 500, message:'Algo salio mal'});
        })

        
    ///codigos de respuesta . . .
    //200: usuario autenticado
    //400: error del usuario
    //500: error del servidor
}

//Funcion para agregar o modificar pregunta de seguridad del socio
export const preguntas_seguridad_socio = async (req, res) => {
    const { Socio_id, Pregunta_id, Respuesta } = req.body;

    console.log("Entro a preguntas");
    console.log(req.body);
    
    if(Socio_id && Pregunta_id && Respuesta){
        //comprobar que el usuario exista
        let query = "SELECT * FROM socios WHERE Socio_id = ?";
        const usuario = await db.query(query, [Socio_id]);
        if(usuario.length == 0){
            return res.status(400).json({ code: 400, message: 'El usuario no existe' });
        }

        //comprobar que la pregunta exista
        let query2 = "SELECT * FROM preguntas_seguridad WHERE preguntas_seguridad_id = ?";
        const pregunta = await db.query(query2, [Pregunta_id]);
        if(pregunta.length == 0){
            return res.status(400).json({ code: 400, message: 'La pregunta no existe' });
        }

        try{
            let query3 = "INSERT INTO preguntas_socios (Socio_id, Pregunta_id, Respuesta) VALUES (?, ?, ?)";
            const reapuesta_hasheada = await bcrypt.hash(Respuesta, 12);
            const union = await db.query(query3, [Socio_id, Pregunta_id, reapuesta_hasheada]);
            res.json({code: 200, message: 'Pregunta del socio agregada'}).status(200);
        }catch{
            res.status(500).json({code: 500, message:'Algo salio mal'});
        }

    }else{
        //campos incompletos
        res.status(400).json({code: 400, message: 'Campos incompletos'});
    }
}

//Funcion para enviar las preguntas de seguridad
// export const enviar_preguntas_seguridad = async (req, res) => {

// }

//funcion para login
export const login = async (req, res) => {
    const { Username, Password } = req.body;
    if(Username && Password){
        let query = "SELECT * FROM socios WHERE Username = ?";
        let result = await db.query(query, [Username]);
        
        //validar que existe el usuario
        if(result.length > 0){
            //validar que la contraseña sea correcta
            if(bcrypt.compareSync(Password, result[0].Password)){
                //generar token
                const token = jwt.sign({
                    Username: result[0].Username,
                    Socio_id: result[0].Socio_id
                }, secret);

                //mandando token por el header
                return res.status(200)
                    .json({ code: 200, message: 'Usuario autenticado', token, data:{Socio_id: result[0].Socio_id, Username: result[0].Username} });
            }
            else{
                return res.status(400).json({ code: 400, message: 'Contraseña incorrecta' });
            }
        }
        else{
            //usuario no existe
            return res.status(400).json({code: 400, message: 'Usuario no existe'});
        }
    }else{
        //campos incompletos
        res.status(400).json({code: 400, message: 'Campos incompletos'});
    }

    //codigos de respuesta . . .
    //200: usuario autenticado
    //400: error del usuario
    //500: error del servidor
}


//funcion para Recuperar Contraseña
export const recuperar_ = async (req, res) => {
    const { Username, Password } = req.body;
    if(Username && Password){
        let query = "SELECT * FROM socios WHERE Username = ?";
        let result = await db.query(query, [Username]);
        
        //validar que existe el usuario
        if(result.length > 0){
            //validar que la contraseña sea correcta
            if(bcrypt.compareSync(Password, result[0].Password)){
                //generar token
                const token = jwt.sign({
                    Username: result[0].Username,
                    Socio_id: result[0].Socio_id
                }, secret);

                //mandando token por el header
                return res.status(200)
                    .json({ code: 200, message: 'Usuario autenticado', token, data:{Socio_id: result[0].Socio_id, Username: result[0].Username} });
            }
            else{
                return res.status(400).json({ code: 400, message: 'Contraseña incorrecta' });
            }
        }
        else{
            //usuario no existe
            return res.status(400).json({code: 400, message: 'Usuario no existe'});
        }
    }else{
        //campos incompletos
        res.status(400).json({code: 400, message: 'Campos incompletos'});
    }

    //codigos de respuesta . . .
    //200: usuario autenticado
    //400: error del usuario
    //500: error del servidor
}