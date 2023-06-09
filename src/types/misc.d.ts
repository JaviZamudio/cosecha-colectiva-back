import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

interface SocioRequest<BodyTemplate> extends Request {
    body: BodyTemplate,
    id_socio_actual?: number,
}

interface AdminRequest<BodyTemplate> extends Request {
    body: BodyTemplate,
    id_socio_actual?: number,
    id_grupo_actual?: number,
    Sesion_id?: number,
}

interface CommonError {
    code: number,
    message: string
}

interface CustomJwtPayload extends JwtPayload {
    Socio_id: number,
    Username: string,
}
