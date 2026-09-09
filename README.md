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
desplegable y *Despachar* lo manda a "en camino". La pantalla de domiciliarios
muestra, por persona, cuantos pedidos lleva en ruta, **cuanta plata lleva
encima sin liquidar** y cuanto efectivo suyo ya entro a caja en el turno — que
es lo que se necesita para cuadrar con cada uno al final. *Quitar* saca a
alguien de la lista sin borrar su historial.

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
src/app/pedido/[id]     comanda, cobro y recibo
src/app/caja            apertura, resumen y cierre de turno
```
