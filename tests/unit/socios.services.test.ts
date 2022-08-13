import db from "../../src/config/database";
import { socio_es_admin } from "../../src/services/Socios.services";
import config from "../config";

afterAll(async () => {
    await db.end();
});

// Tests para socio_es_admin
describe("socio_es_admin", () => {
    it("debe retornar true si el socio es administrador del grupo", async () => {
        const Socio_id = config.Javi.id;
        const Grupo_id = config.Grupo_prueba.id;

        await expect(socio_es_admin(Socio_id, Grupo_id)).resolves.toBe(true);
    });

    it("Debe dar error si el socio no es administrador del grupo", async () => {
        const Socio_id = config.Ale.id;
        const Grupo_id = config.Grupo_prueba.id;

        return expect(socio_es_admin(Socio_id, Grupo_id)).rejects.not.toBeNull();
    });

    it("Debe dar error si el socio no existe", async () => {
        const Socio_id = -1;
        const Grupo_id = config.Grupo_prueba.id;

        return expect(socio_es_admin(Socio_id, Grupo_id)).rejects.not.toBeNull();
    });

    it("Debe dar error si el grupo no existe", async () => {
        const Socio_id = config.Ale.id;
        const Grupo_id = -1;

        return expect(socio_es_admin(Socio_id, Grupo_id)).rejects.not.toBeNull();
    });
})