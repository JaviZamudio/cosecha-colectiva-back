// Tests para el recurso "Multas"

import { randNumber, randPhrase } from "@ngneat/falso";
import { randomInt } from "crypto";
import { eleccion } from "../../src/utils/utils";
import config from "../config";
import { request } from "../utils/utils";
import { multasActivas_Grupo } from "../../src/services/multas.services";
import db from "../../src/config/database";

afterAll(async () => {
    await db.end();
} );

// Crear una multa
// POST /api/grupos/:Grupo_id/socios/:Socio_id/multas
describe("Crear Multa", () => {
    const reqBody = {
        Monto_multa: randNumber({min: 1, max: 100, precision: 10}),
        Descripcion: randPhrase(),
        Socio_id: eleccion(config.Javi.id, config.Ale.id),
    };

    const reqHeader = {
        Authorization: config.Javi.token,
    }

    it("Debería devolver Status 200 si la multa se creó con exito", async () => {
        const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/socios/${reqBody.Socio_id}/multas`)
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toEqual(200);
    }, 5000);
});

// Pagar multas
// PATCH /api/grupos/:Grupo_id/multas
describe("Pagar Multas", () => {
    const reqHeader = {
        Authorization: config.Javi.token,
    }
    it("Debería devolver Status 200 si las multas se pagaron con exito", async () => {
        const multas: number[] = await multasActivas_Grupo(config.Grupo_prueba.id);

        const reqBody = {
            Multas: eleccion(...multas),
        };

        const response = await request.patch(`/api/grupos/${config.Grupo_prueba.id}/multas`)
            .send(reqBody)
            .set(reqHeader);

        expect(response.statusCode).toEqual(200);
    }, 5000);
});
