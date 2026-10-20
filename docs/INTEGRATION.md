# Integración de la CLI

La CLI es un proceso local. `mosaicdtl list` devuelve `protocol` y la lista de escenarios; `mosaicdtl scenario <nombre>` devuelve un documento JSON de una sola línea. No hay estado persistente entre invocaciones.

```bash
./build/mosaicdtl list
./build/mosaicdtl scenario allocation > allocation.json
```

## Contrato de salida

| Campo                           | Significado                                                |
| ------------------------------- | ---------------------------------------------------------- |
| `metrics`                       | Importes y contadores específicos del escenario.           |
| `flags`                         | Comprobaciones booleanas observables.                      |
| `vaults`, `routes`, `operators` | Entidades registradas y sus parámetros.                    |
| `obligations`                   | Importe, ejecutado y estado de cada compromiso.            |
| `fragments`                     | Piezas activas y terminales, con `generation` y `parents`. |
| `receipts`                      | Trazabilidad de la transformación entre fragmentos.        |
| `events`                        | Secuencia de cambios para reproducir la operación.         |
| `audit`                         | Conciliación nominal y estado de obligaciones abiertas.    |

Los importes JSON son enteros sin signo. JavaScript representa exactamente los enteros hasta `Number.MAX_SAFE_INTEGER`; un consumidor que admita importes mayores debe validar el rango antes de convertirlos a `number` o usar un decodificador que conserve precisión entera. El motor no realiza conversiones monetarias: el integrador define el activo y la escala.

## Errores y evolución

Una ejecución correcta retorna 0. Una operación inválida devuelve JSON de error por stderr y un código no nulo. No analice el texto del error como un identificador estable. Los consumidores deben fijar el tag de release y tratar los nuevos campos de objeto como extensiones compatibles.

Los fragmentos consolidados permanecen en el historial; no deben sumarse al saldo activo. Para obtener la exposición actual, utilice `audit` y las métricas de exposición del escenario en lugar de agregar todos los elementos de `fragments` indiscriminadamente.
