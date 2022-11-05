// Tests para el subRecurso "Sesiones"

import db from "../../src/config/database"
import config from "../config";
import { request } from "../utils/utils";

afterAll(async () => {
    await db.end();
});

jest.setTimeout(10000);

// Crear una sesión
// POST /api/grupos/:Grupo_id/sesiones
describe("Crear una sesión", () => {
    const reqHeader = {
        Authorization: config.Javi.token,
    }

    test("Debe responder con un código 200", async () => {
        const reqBody = {
            Socios: [
                {
                    Socio_id: config.Javi.id,
                    Presente: 1,
                },
                {
                    Socio_id: config.Ale.id,
                    Presente: 0,
                },
                {
                    Socio_id: config.Lau.id,
                    Presente: 1,
                }
            ]
        };


        const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/sesiones`)
            .send(reqBody)
            .set(reqHeader);

        if (response.status !== 200) {
            console.log(response.body);
        }

        expect(response.statusCode).toBe(200);
    });
    
    it("Debe responder con 400 si no están presentes por lo menos la mitad", async () => {
        const reqBody = {
            Socios: [
                {
                    Socio_id: config.Javi.id,
                    Presente: true,
                },
                {
                    Socio_id: config.Ale.id,
                    Presente: false,
                },
                {
                    Socio_id: config.Lau.id,
                    Presente: false,
                }
            ]
        }
        
        const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/sesiones`)
            .send(reqBody)
            .set(reqHeader);
    
        expect(response.statusCode).toBe(400);
    });
});


// Registrar retardos de la sesión activa
// POST /api/grupos/:Grupo_id/sesiones/retardos
describe("Obtener inasistencias de la sesión activa", () => {
    test("Debe responder con un código 200", async () => {
        const reqHeader = {
            Authorization: config.Javi.token,
        }

        const response = await request.get(`/api/grupos/${config.Grupo_prueba.id}/sesiones/inasistencias`)
            .set(reqHeader);

        expect(response.statusCode).toBe(200);
        expect(response.body.data).not.toBeNull();
    });
});

// Registrar retardos de la sesión activa
// POST /api/grupos/:Grupo_id/sesiones/retardos
describe("Registrar retardos de la sesión activa", () => {
    test("Debe responder con un código 200", async () => {
        const reqBody = {
            Retardos: [
                config.Ale.id,
            ]
        };

        const reqHeader = {
            Authorization: config.Javi.token,
        }

        const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/sesiones/retardos`)
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toBe(200);
    });
});