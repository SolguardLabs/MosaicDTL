# MosaicDTL Integration Notes

La CLI es el contrato de integracion del lab. Cada ejecucion produce un unico
documento JSON con:

- \`metrics\`: contadores estables por escenario;
- \`flags\`: resultados booleanos de operaciones relevantes;
- \`audit\`: reconciliacion nominal y economica;
- \`fragments\`: piezas historicas y activas;
- \`receipts\`: recibos de consolidacion;
- \`events\`: diario ordenado.

Los importes son enteros sin decimales. Las rutas cerradas conservan sus
fragmentos historicos, pero no pueden contener fragmentos activos.
