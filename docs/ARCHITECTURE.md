# Arquitectura y ciclo de vida

MosaicDTL separa el libro de estado (`Ledger`), el cálculo de transformaciones (`ConsolidationPlan`), la reconciliación (`AuditReport`), las vistas de exposición (`ExposureBook`) y la serialización JSON. La CLI compone estos componentes en escenarios deterministas; ningún módulo requiere un servicio externo.

```mermaid
stateDiagram-v2
  [*] --> Active: depósito o asignación
  Active --> Consolidated: consolidación
  Active --> Withdrawn: retirada libre
  Active --> Executed: ejecución de obligación
  Active --> Closed: consumo completo
  Consolidated --> [*]
  Withdrawn --> [*]
  Executed --> [*]
  Closed --> [*]
```

Cada fragmento conserva `id`, bóveda, ruta, operador, clase económica, importe, prioridad, generación y padres. Los estados terminales sirven para auditoría; solo `Active` entra en la exposición corriente. El libro registra eventos secuenciales y un recibo por consolidación con padres, salida e importes.

## Fronteras de operación

1. El depósito incorpora saldo libre a una bóveda existente.
2. La asignación mueve saldo libre a una ruta y operador registrados.
3. La reserva vincula saldo a una obligación identificada.
4. La consolidación crea una salida a partir de fragmentos seleccionados y marca los padres como históricos.
5. La retirada consume únicamente fragmentos clasificados como libres; la ejecución de obligación consume fragmentos reservados para su identificador.
6. El cierre de ruta requiere que no queden fragmentos activos en ella.

Las vistas de auditoría y exposición son lecturas posteriores a la transición. Su salida resulta útil para reconciliación y supervisión, pero no reemplaza la validación de entrada de cada operación.
