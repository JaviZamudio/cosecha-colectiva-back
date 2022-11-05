// Tests para el recurso "Prestamos"

import db from "../../src/config/database";
import { obtener_prestamos_ampliables, obtenerPrestamosVigentes } from "../../src/services/Prestamos.services";
import { eleccion } from "../../src/utils/utils";
import config from "../config";
import { request } from "../utils/utils";

afterAll(async () => {
    await db.end();
});

// Crear un prestamo
// POST /api/grupos/:Grupo_id/socios/:Socio_id/prestamos
describe.skip("Generar Nuevo Prestamo", () => {
    const reqHeader = {
        Authorization: config.Javi.token,
    }
    describe("Crear un prestamo normal", () => {
        it("Debe retornar un status code 201 cuando se cree el prestamo", async () => {
            const reqBody = {
                Monto_prestamo: 100,
                Num_sesiones: 5,
                Observaciones: "Prestamo para prueba",
                Estatus_ampliacion: false,
                Prestamo_original_id: null
            };

            const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/socios/${eleccion(config.Javi.id, config.Ale.id, config.Lau.id)}/prestamos`)
                .send(reqBody)
                .set(reqHeader);

            expect(response.statusCode).toEqual(201);
        }, 5000);
    });

    describe("Crear un prestamo con ampliacion", () => {
        it("Debe retornar un status code 201 cuando se cree el prestamo ampliado", async () => {
            const reqBody = {
                Monto_prestamo: 120,
                Num_sesiones: 6,
                Observaciones: "Prestamo Ampliado para prueba",
                Estatus_ampliacion: true,
                Prestamo_original_id: await obtener_prestamos_ampliables(config.Grupo_prueba.id, config.Javi.id)[0]?.Prestamo_id
            };

            const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/socios/${config.Javi.id}/prestamos`)
                .send(reqBody)
                .set(reqHeader);
            expect(response.statusCode).toEqual(201);
        }, 5000);
    });
});

// Pagar prestamos
// PATCH /api/grupos/:Grupo_id/prestamos
describe("Pagar Prestamos", () => {
    const reqHeader = {
        Authorization: config.Javi.token,
    }

    it("Debería devolver Status 200 si los prestamos se pagaron con exito", async () => {
        const prestamos = await obtenerPrestamosVigentes(config.Grupo_prueba.id, config.Javi.id);
        const reqBody = {
            Prestamos: [
                {
                    Prestamo_id: eleccion(...prestamos.map(p => p.Prestamo_id)),
                    Monto_abono: 20
                }
            ]
        };

        const response = await request.patch(`/api/grupos/${config.Grupo_prueba.id}/prestamos`)
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toEqual(200);
    });
});