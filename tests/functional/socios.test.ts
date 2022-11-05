import config from "../config";
import db from "../../src/config/database";
import * as falso from "@ngneat/falso";
import { eleccion, formatearFecha } from "../../src/utils/utils";
import { request } from "../utils/utils";
import { existeGrupo, grupos_sin_socio, obtenerGrupo } from "../../src/services/Grupos.services";

afterAll(async () => {
    await db.end();
});

describe("Login", () => {
    const reqBody = { Username: config.Javi.username, Password: config.Javi.password }

    it("Debería devolver un token si las credenciales son correctas", async () => {
        const response = await request.post("/api/socios/login")
            .send(reqBody);


        expect(response.body).toHaveProperty("token");
    })

    it("Debería devolver un codigo 401 si la contraseña es incorrecta", async () => {
        const response = await request.post("/api/socios/login")
            .send({ ...reqBody, Password: config.Javi.password + "hola" });


        expect(response.statusCode).toBe(401);
    })
})

describe("Register", () => {
    const reqBody = {
        Nombres: falso.randFirstName(),
        Apellidos: falso.randLastName(),
        CURP: falso.randUuid(),
        Fecha_nac: formatearFecha(falso.randPastDate({ years: 70 })),
        Nacionalidad: falso.randCountry(),
        Sexo: eleccion("H", "M"),
        Escolaridad: eleccion("Posgrado", "Licenciatura", "Preparatoria", "Secundaria", "Primaria"),
        Ocupacion: falso.randJobTitle(),
        Estado_civil: eleccion("Soltero", "casado"),
        Hijos: falso.randNumber({ min: 0, max: 3 }),
        Telefono: falso.randPhoneNumber(),
        Email: falso.randEmail(),
        Localidad: falso.randCounty(),
        Municipio: falso.randCity(),
        Estado: falso.randState(),
        CP: falso.randZipCode(),
        Pais: falso.randCounty(),
        Foto_perfil: falso.randAvatar(),
        Username: falso.randUserName(),
        Password: falso.randPassword(),
        Pregunta_id: eleccion(4, 14),
        Respuesta: falso.randFirstName()
    }

    it("Debería devolver un status de 200", async () => {
        const response = await request.post("/api/socios")
            .send(reqBody);

        // console.log si no se cumple la condición de jest
        


        expect(response.statusCode).toBe(200);
    });

})

describe("Recuperar password", () => {
    const reqBody = {
        Username: config.Javi.username,
        CURP: config.Javi.CURP,
        Pregunta_id: config.Javi.pregunta_seguridad.Pregunta_id,
        Respuesta: config.Javi.pregunta_seguridad.Respuesta,
        Password: config.Javi.password
    };

    it("Debería devolver un status de 200", async () => {
        const response = await request.put("/api/socios/password")
            .send(reqBody);

        expect(response.statusCode).toBe(200);
    });
}) 

describe("Unirse a un grupo", () => {
    const reqBody = {
        Codigo_grupo: "",
    }

    const reqHeader = {
        Authorization: config.Lau.token,
    }

    it("Debería devolver un status de 200", async () => {
        reqBody.Codigo_grupo = (await existeGrupo((await grupos_sin_socio(config.Lau.id))[0] as number) as {Codigo_grupo: string}).Codigo_grupo;

        const response = await request.post("/api/socios/grupos")
            .send(reqBody)
            .set(reqHeader);

        if(response.statusCode !== 200) {
            console.log(response.body);
        }

        expect(response.statusCode).toBe(200)
    })
})

describe("Cambiar password", () => {
    const reqBody = {
        Password: falso.randPassword(),
    }

    const reqHeader = {
        Authorization: config.Ale.token,
    }

    it("Debería devolver un status de 200", async () => {
        const response = await request.patch("/api/socios/password")
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toBe(200);
    }, 5000);
})

describe("Cambiar pregunta de seguridad", () => {
    const reqBody = {
        Pregunta_id: eleccion(4, 14),
        Respuesta: falso.randFirstName(),
    }

    const reqHeader = {
        Authorization: config.Ale.token,
    }

    it("Debería devolver un status de 200", async () => {
        const response = await request.patch("/api/socios/pregunta")
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toBe(200);
    });
})