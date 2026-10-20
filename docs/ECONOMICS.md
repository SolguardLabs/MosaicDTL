# Modelo económico y exposición

Los importes se contabilizan en unidades mínimas enteras. Se distinguen saldo libre, saldo reservado para obligaciones, retiradas y ejecuciones. Un fragmento histórico consolidado demuestra procedencia, pero no añade saldo disponible.

```text
D = F + R + W + E
H(r) = max(0, C(r) - A(r))
A(r) = F(r) + R(r)
```

`D` es el total depositado; `F` y `R`, los saldos activos libre y reservado; `W` y `E`, salidas terminales. `C(r)` es la capacidad declarada de la ruta, `A(r)` su saldo activo y `H(r)` su holgura observada. Si `A(r) > C(r)`, la vista registra holgura cero y `within_capacity = false`. No se permite que una resta sin signo represente una holgura negativa.

## Ejemplo reproducible

En `allocation`, la bóveda recibe 1.000.000 unidades. Se reservan 180.000 y 120.000 unidades para dos obligaciones; 250.000 y 100.000 se asignan como liquidez operativa a las dos rutas. Quedan 350.000 sin asignar. Por tanto:

```text
reservado activo = 300.000
libre activo = 700.000 = 350.000 asignado + 350.000 sin asignar
activo route-north = 430.000
activo route-south = 220.000
mayor exposición a una ruta = 430.000
```

Las cuatro rutas registradas suman 5.100.000 unidades de capacidad; el activo en rutas suma 650.000. La holgura agregada es 4.450.000. Este dato no equivale a liquidez disponible para retirar: una capacidad vacía no representa fondos depositados. El riesgo de concentración se lee comparando `largest_route` con `route_active_total`, no con la suma de capacidades.

## Control operativo

La reconciliación nominal detecta creación o pérdida de importe. La revisión de obligaciones examina además saldos vinculados a compromisos abiertos. La medición de exposición informa de concentración y presión de capacidad. Son controles complementarios: cada uno responde a una pregunta económica distinta.
