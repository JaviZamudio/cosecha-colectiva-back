interface Acuerdo {
    Acuerdo_id?: number,
    Grupo_id: number,
    Fecha_acuerdos: string,
    Fecha_acuerdos_fin: string,
    Status: 1 | 0,
    Periodo_reuniones: number, // en semanas
    Periodo_cargos: string,
    Limite_inasistencias: string,
    Minimo_aportacion: string,
    Costo_acciones: number,
    Tasa_interes: string,
    Limite_credito: number,
    Porcentaje_fondo_comun: string,
    Creditos_simultaneos: string,
    Interes_morosidad: string,
    Ampliacion_prestamos: 0 | 1,
    Interes_ampliacion: number | null,
    Mod_calculo_interes: string,
    Tasa_interes_prestamo_grande: string,
    Id_socio_administrador: string,
    Id_socio_administrador_suplente: string
}

interface AcuerdoSecundario {
    Acuerdo_id?: number,
    Grupo_id: number,
    Regla: string,
    Acuerdo: string,
    Fecha_acuerdo: string,
    Fecha_acuerdo_fin: string,
    Status: 0 | 1,
}

interface Asistencia {
    Asistencia_id?: number,
    Socio_id: number,
    Sesion_id: number,
    Presente: string
}

interface CatalogoTransaccion {
    Catalogo_id?: number,
    Tipo: string
}

interface Grupo {
    Grupo_id?: number,
    Nombre_grupo: string,
    Codigo_grupo: string,
    Localidad: string,
    Municipio: string,
    Estado: string,
    CP: string,
    Pais: string,
    Fecha_reg: string,
    Status?: string
}

interface GrupoSocio {
    Grupo_socio_id?: number,
    Status?: 0 | 1 | 2, // 0 = activo, 1 = inactivo, 2 = congelado
    Acciones?: number,
    Tipo_socio: "ADMIN" | "SOCIO" | "SUPLENTE" | "CREADOR",
    Grupo_id: number,
    Socio_id: number
}

interface InteresPrestamo {
    Interes_prestamo_id?: number,
    Prestamo_id: number,
    Sesion_id: number,
    Monto_iteres: string,
    Tipo_interes: string
}

interface Multa {
    Multa_id?: number,
    Monto_multa: string,
    Descripcion: string,
    Status?: 0 | 1, // 0 = por pagar, 1 = pagada
    Sesion_id: number,
    Socio_id: number,
    Transaccion_id?: number
}

interface PreguntaSeguridad {
    Preguntas_seguridad_id?: number,
    Pregunta: string
}

interface PreguntaSocio {
    Pregunta_socio_id?: number,
    Socio_id: number,
    Pregunta_id: number,
    Respuesta: string
}

interface Prestamo {
    Prestamo_id?: number,
    Monto_prestamo: number,
    Monto_pagado: number,
    Interes_generado: number,
    Interes_pagado: number,
    Fecha_inicial: string,
    Fecha_final: string,
    Observaciones: string,
    Num_sesiones: number,
    Sesiones_restantes: number,
    Estatus_prestamo: 0 | 1 | 2 | 3, // 0 = activo, 1 = pagado, 2 = congelado, 3 = cancelado
    Socio_id: number,
    Sesion_id: number,
    Acuerdos_id: number,
    Estatus_ampliacion: 0 | 1, // 0 = no ampliado, 1 = ampliado
    Prestamo_original_id: number | null,
}

interface Sesion {
    Sesion_id?: number,
    Fecha: string,
    Activa: string,
    Caja: number,
    Acciones: number,
    Grupo_id: number
}

interface Socio {
    Socio_id?: number,
    Nombres: string,
    Apellidos: string,
    CURP: string,
    Fecha_nac: string,
    Nacionalidad: string,
    Sexo: string,
    Escolaridad: string,
    Ocupacion: string,
    Estado_civil: string,
    Hijos: string,
    Telefono: string,
    Email: string,
    Localidad: string,
    Municipio: string,
    Estado: string,
    CP: string,
    Pais: string,
    Foto_perfil: string,
    Username: string,
    Password: string,
    Fecha_reg: string,
    Status: string
}

interface Transaccion {
    Transaccion_id?: number,
    Cantidad_movimiento: number,
    Caja: number,
    Timestamp?: string,
    Sesion_id: number,
    Socio_id: number,
    Acuerdo_id: number,
    Catalogo_id: string
}

interface TransaccionPrestamo {
    Transaccion_prestamo_id?: number,
    Prestamo_id: number,
    Transaccion_id: number,
    Monto_abono_prestamo: string,
    Monto_abono_interes: string
}

