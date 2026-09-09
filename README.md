# POS KarMay's

Punto de venta para el restaurante. Tres cosas: **toma de pedidos en la mesa**,
**domicilios** y **recaudo / cierre de caja**.

Corre en el PC del negocio y se abre desde el navegador, tanto en el equipo de
caja como en los celulares o tablets de los meseros conectados al mismo WiFi.
No necesita internet ni servicios externos.

## Arrancar

```bash
npm run dev:red
```

Luego abrir `http://localhost:3000` en el PC. Para entrar desde un celular,
usar la direccion de red que imprime la consola (algo como
`http://192.168.x.x:3000`) estando en el mismo WiFi.

Para el dia a dia conviene la version compilada, que va mas rapida:

```bash
npm run build
npm run start:red
```

## La carta

La carta vive en [`carta.json`](carta.json). Para cambiar precios, agregar
platos o corregir nombres se edita ese archivo y se corre:

```bash
npm run carta
```

Es seguro correrlo cuantas veces haga falta: actualiza precios, agrega lo nuevo
y lo que se quite del archivo queda *inactivo* (deja de aparecer en la carta
pero los pedidos viejos lo siguen mostrando bien).

Cada producto acepta:

```json
{
  "nombre": "Perro KarMay's 2.0",
  "precio": 20000,
  "descripcion": "Con papas",
  "ingredientes": ["Papas", "Tocineta"]
}
```

Los `ingredientes` son los que el mesero puede quitar con un toque al editar el
plato en la comanda ("sin tocineta"), asi que conviene listar los que la gente
suele pedir sin.

## Quien ve que

Cada persona entra con un **codigo de 4 numeros** y solo ve su pantalla. La
primera vez que se abre el POS pide crear el usuario administrador; desde ahi,
en **Personas** se crea al resto y el sistema le genera el codigo a cada uno.
Ese codigo se le dicta a la persona y con eso entra.

| Rol | Ve | No ve |
| --- | --- | --- |
| **Administrador** | todo, incluidos los codigos y la caja | — |
| **Cajero** | mesas, domicilios, cobro, caja e historial | personas y codigos |
| **Mesero** | solo mesas y comandas | domicilios, cobro, caja |
| **Recepcion** | domicilios y asignacion de domiciliarios | mesas, cobro, caja |
| **Domiciliario** | solo *sus* entregas | absolutamente todo lo demas |

El permiso es **del dia**: en Personas se apaga el acceso de quien termina su
turno y queda por fuera de inmediato, aunque tuviera la sesion abierta en el
celular. Al dia siguiente se vuelve a encender y entra con el mismo codigo.
El bloqueo no es solo visual — escribir la direccion a mano tampoco sirve.

Si un codigo se filtra, *Cambiar* le genera otro y tumba sus sesiones.

## Como se usa

**Mesas** → se toca una mesa libre y queda abierta con su comanda. Se tocan los
platos de la carta para agregarlos; tocando un plato ya agregado en la comanda
se abre el detalle para cambiar cantidad, quitar ingredientes o dejar una nota
para cocina. *Enviar a cocina* marca los platos como despachados.

**Domicilios** → se registran nombre, telefono, direccion y valor del domicilio,
y de ahi se toma el pedido igual que en una mesa. El estado (en cocina, listo,
en camino, entregado) se cambia desde la misma pantalla del pedido.

**Domiciliarios** → se dan de alta una vez (nombre y telefono) y despues cada
domicilio se les asigna desde la lista de domicilios: se elige la persona en el
desplegable y *Despachar* lo manda a "en camino". *Quitar* saca a alguien de la
lista sin borrar su historial.

Esta pantalla es el control del turno. Arriba va el consolidado —cuanto se
cobro en domicilios, abierto por medio de pago, cuanto efectivo hay por
recibir, cuanto ya entro al negocio y cuanto sigue en la calle— y abajo la
ficha de cada persona con lo mismo a su nombre:

- **Cobrado en el turno** y cuantas entregas hizo.
- El desglose por **Efectivo, Nequi, Bre-B, transferencia**, con el numero de
  cobros de cada uno.
- **Efectivo que debe entregar**: la plata fisica que trae encima. Lo digital
  ya entro al negocio y no se le cobra.
- **Lleva sin cobrar**: lo que todavia anda en la calle sin pagar.
- **Cobrado en domicilios**: la suma de los valores de domicilio, si le pagas
  por entrega.
- La lista de sus entregas del turno, una por una, con hora, cliente, medio de
  pago y monto.

El mismo corte lo ve el domiciliario en su pantalla, para que no haya discusion
al momento de cuadrar.

**Mi ruta** (pantalla del domiciliario) → solo sus pedidos: direccion, boton
para llamar al cliente, el detalle de lo que lleva en la bolsa y cuanto tiene
que cobrar. Al entregar marca **por donde le pagaron** — efectivo, Nequi,
Bre-B o transferencia — y el pedido queda saldado. Lo que cobro en efectivo
es lo que despues tiene que entregar en caja; lo digital ya entro al negocio,
y esa diferencia es la que muestra la pantalla de domiciliarios.

**Historial** → todo lo que se ha vendido, sin que se borre nada. Se elige el
turno arriba (o *Todo el historial*) y se ve cuanto se vendio, el desglose por
medio de pago, cuanto salio por mesa y cuanto por domicilio, la lista de
pedidos uno por uno —hora, mesa o cliente, domiciliario, medio de pago, quien
cobro y total, con los anulados tachados— y el ranking de lo que mas se
vendio. Tocando el numero del pedido se abre su recibo.

**Caja** → hay que abrir la caja con la base del turno antes de poder cobrar.
Cada cobro admite efectivo (calcula el cambio), Nequi, Daviplata, tarjeta u
otra transferencia, y se puede dividir la cuenta en varios pagos. Al cierre se
compara el efectivo contado contra lo que deberia haber.

## Datos

Todo queda en `datos/pos.db` (SQLite). Esa carpeta **no** esta en git: es la
informacion real del negocio. Para respaldar, basta con copiar el archivo.

## Estructura

```
carta.json              la carta del negocio
scripts/cargar-carta.mjs  sincroniza carta.json con la base
src/lib/db.ts           conexion y esquema de la base
src/lib/consultas.ts    lecturas
src/lib/acciones.ts     escrituras (server actions)
src/app/mesas           mapa de mesas
src/app/domicilios      alta y seguimiento de domicilios
src/app/domiciliarios   asignacion y liquidacion por domiciliario
src/app/mi-ruta         pantalla del domiciliario
src/app/usuarios        personas, roles y codigos de acceso
src/app/entrar          ingreso con codigo
src/lib/sesion.ts       roles, permisos y sesion
src/proxy.ts            corta el paso a quien no ha entrado
src/app/pedido/[id]     comanda, cobro y recibo
src/app/caja            apertura, resumen y cierre de turno
src/app/historial       ventas por turno, pedidos y lo mas vendido
```
