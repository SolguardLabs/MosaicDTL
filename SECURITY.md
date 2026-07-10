# Security Policy

MosaicDTL es un CTF local. No se aceptan reportes de seguridad para el codigo
como si fuera software de produccion.

## Alcance

El alcance del reto es la logica economica de:

- asignacion de fragmentos a rutas;
- reserva de liquidez para obligaciones;
- retirada de liquidez libre;
- consolidacion de fragmentos;
- cierre de rutas;
- reconciliacion de backing nominal y economico.

## Fuera De Alcance

- fallos del compilador o del runtime local;
- modificaciones de los tests;
- corrupcion de archivos de build;
- ataques dependientes de red o servicios externos.

## Reproduccion

El flujo recomendado es:

\`\`\`bash
npm run build
npm test
build/mosaicdtl scenario provenance-leak
\`\`\`

La salida JSON contiene eventos, fragmentos, obligaciones y auditoria para que
la investigacion pueda reconstruirse sin instrumentacion adicional.
