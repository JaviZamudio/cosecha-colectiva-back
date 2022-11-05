// Tests para acciones
// Jest

import { randNumber } from "@ngneat/falso";
import db from "../../src/config/database"
import config from "../config";
import { request } from "../utils/utils";

afterAll(async () => {
    db.end();
});

describe("Compra de acciones", () => {
    const reqBody = {
        Cantidad: randNumber({ min: 1, max: 1000, precision: 10 }),
    };

    const reqHeader = {
        Authorization: config.Javi.token,
    }

    it("Debería devolver Status 200 si la accion se compró con exito", async () => {
        const response = await request.post(`/api/grupos/${config.Grupo_prueba.id}/socios/${config.Javi.id}/acciones`)
            .send(reqBody)
            .set(reqHeader);

        if( response.status !== 200 ) {
            console.log(response.body);
        }

        expect(response.statusCode).toEqual(200);
    }, 5000);
});

describe("Obtener costo de accion", () => {
    const reqHeader = {
        Authorization: config.Javi.token,
    }

    it("Debería devolver Status 200 si el costo de la accion se obtuvo con exito", async () => {
        const response = await request.get(`/api/grupos/${config.Grupo_prueba.id}/acciones/costo`)
            .set(reqHeader);

            
        expect(response.statusCode).toEqual(200);
        expect(response.body.data?.Costo).not.toBeUndefined();
    }, 5000);
});

describe("Retiro de acciones", () => {

});