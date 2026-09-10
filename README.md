# POS KarMay's

Punto de venta para el restaurante. Tres cosas: **toma de pedidos en la mesa**,
**domicilios** y **recaudo / cierre de caja**.

Corre en la web (Netlify) sobre una base en Supabase, y se abre desde el
navegador: el equipo de caja, las tablets del salon y los celulares de los
domiciliarios, esten donde esten.

## Antes de nada: esto necesita internet

Los datos viven en Supabase y la aplicacion corre en Netlify. **Sin internet no
hay POS**: ni comandas, ni cobros. Vale la pena tener un plan para ese rato —
anotar en papel y cargar despues— porque va a pasar algun dia en pleno
servicio.

## Poner a andar el proyecto

Hace falta una base **Postgres** y su cadena de conexion. Sirve cualquiera: el
codigo no depende del proveedor.

**Neon** (neon.tech) es la recomendada: plan gratis de verdad, sin tarjeta y
sin fecha de vencimiento. Al crear el proyecto entrega la cadena de conexion;
hay que copiar la que dice **Pooled connection** (el host lleva `-pooler`),
que es la que aguanta bien las funciones serverless.

Con el plan gratis de Neon la base **se duerme** tras unos minutos sin uso, y
la primera consulta despues de eso tarda algo mas. En pleno servicio no se
nota; el primer pedido de la mañana si puede demorarse un segundo.

Tambien sirven **Supabase** (si te queda cupo de proyectos) o cualquier
Postgres administrado. Evita **Render**: su Postgres gratuito se borra al mes.

1. Crea la base y copia su cadena de conexion.
2. Copia `.env.example` como `.env.local` y pegala en `DATABASE_URL`. Ese
   archivo no se sube a git.
3. Crea las tablas y carga la carta:

```bash
npm run db:esquema
npm run carta
```

4. Si vienes del POS con SQLite y quieres subir lo que ya hay (carta, mesas,
   personas con sus codigos, turnos y pedidos):

```bash
npm run db:migrar
```

   Lee `datos/pos.db` y lo sube tal cual, conservando los numeros de pedido.
   Solo copia las tablas que esten vacias, asi que correrlo dos veces no
   duplica nada. Las sesiones abiertas no se copian: cada quien vuelve a
   marcar su codigo.

   **Para una demostracion, saltate este paso.** Subir la base real expone
   nombres, telefonos y direcciones de clientes de verdad a quien vea la
   pantalla. Con el esquema y la carta basta para mostrar el sistema completo.

5. Para trabajar en local contra esa misma base:

```bash
npm run dev
```

## Subirlo a Netlify

Lo mas rapido, sin pasar por GitHub:

```bash
npx netlify-cli login
```

```bash
npx netlify-cli env:set DATABASE_URL "la-cadena-de-tu-base"
```

```bash
npx netlify-cli deploy --build --prod
```

**Sin esa variable el sitio levanta y falla en la primera pantalla.**

Si prefieres que cada cambio se publique solo, sube el repo a GitHub y en
Netlify usa **Add new site > Import an existing project**: el `netlify.toml`
ya trae el comando de build y el plugin de Next, y la variable se agrega en
**Site configuration > Environment variables**.

La primera vez que se abra la web, si no hay usuarios, pide crear el
administrador. Si migraste desde SQLite, entra con el codigo que ya tenias.

### Que el POS no quede publico de mas

El sitio de Netlify queda con una direccion `.netlify.app` que cualquiera puede
abrir. Lo que protege el negocio es el codigo de acceso, y por eso el sistema
**frena a quien intente adivinarlo**: a los 8 intentos fallidos desde una misma
conexion, bloquea 15 minutos. Aun asi, conviene:

- No repartir la direccion mas alla del equipo.
- Cambiar los codigos cuando alguien se va del negocio (*Personas > Cambiar*).
- Apagar el acceso de quien termina turno, que ademas cierra su sesion.

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
| **Recepcion** | solo toma domicilios | asignar, mesas, cobro, caja |
| **Despacho** | asigna domicilios y ve a los domiciliarios | tomar pedidos, cobro, caja |
| **Domiciliario** | solo *sus* entregas | absolutamente todo lo demas |

El permiso es **del dia**: en Personas se apaga el acceso de quien termina su
turno y queda por fuera de inmediato, aunque tuviera la sesion abierta en el
celular. Al dia siguiente se vuelve a encender y entra con el mismo codigo.
El bloqueo no es solo visual — escribir la direccion a mano tampoco sirve.

Si un codigo se filtra, *Cambiar* le genera otro y tumba sus sesiones.

## Como se usa

**Mesas** → se toca una mesa libre y queda abierta con su comanda. Se tocan los
platos de la carta para agregarlos.

Cada plato de la comanda se toca para abrir su detalle: ahi se cambia la
cantidad y se arman las modificaciones. Los ingredientes rotan con un toque —
*sin lechuga*— y con otro — *con lechuga* —, asi se pide "sin lechuga, con
cebolla" sin escribir nada. Debajo queda el campo libre para lo que no sea un
ingrediente: salsa aparte, bien caliente, para llevar. Todo eso se imprime tal
cual en la comanda de cocina. *Enviar a cocina* marca los platos como
despachados.

**El numero de la orden** arranca de nuevo con cada turno de caja: al cerrar el
turno, el proximo pedido vuelve a ser el 1. Por eso siempre se muestra con su
fecha —*Orden #1 · 10/sep/2026*— y no hay forma de confundir la orden 5 del
lunes con la del martes. El numero interno de la base sigue siendo otro y no
se reutiliza; el que se dice en voz alta es este.

**Domicilios** → se registran nombre, telefono, direccion y valor del domicilio,
y de ahi se toma el pedido igual que en una mesa. El estado (en cocina, listo,
en camino, entregado) se cambia desde la misma pantalla del pedido.

**Asignacion** → la pantalla de despacho, separada a proposito de la de tomar
pedidos: quien contesta el WhatsApp no reparte las entregas. Muestra los
domicilios en tres grupos —sin asignar, asignados sin salir, y en la calle— y
al lado quien esta libre y quien anda con pedidos. Se elige la persona en el
desplegable y *Despachar* lo manda a "en camino".

**Domiciliarios** → se dan de alta una vez (nombre y telefono). *Quitar* saca a
alguien de la lista sin borrar su historial.

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

**Comprobantes** → a un pago por Nequi, Bre-B o transferencia se le puede
adjuntar la foto de la pantalla del pago, desde la caja o desde el celular del
domiciliario. La aplicacion la achica antes de subirla, queda guardada con el
pedido y solo la ve quien cobra o el domiciliario de ese pedido.

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
sql/esquema.sql         las tablas en Postgres
scripts/esquema.mjs     las crea en Supabase
scripts/migrar-desde-sqlite.mjs  sube lo que habia en el POS local
src/lib/db.ts           conexion a Postgres
src/lib/consultas.ts    lecturas
src/lib/acciones.ts     escrituras (server actions)
src/app/mesas           mapa de mesas
src/app/domicilios      alta y seguimiento de domicilios
src/app/asignacion      despacho: reparte los domicilios
src/app/domiciliarios   liquidacion por domiciliario
src/app/api/comprobante fotos de los pagos digitales
src/app/mi-ruta         pantalla del domiciliario
src/app/usuarios        personas, roles y codigos de acceso
src/app/entrar          ingreso con codigo
src/lib/sesion.ts       roles, permisos y sesion
src/proxy.ts            corta el paso a quien no ha entrado
src/app/pedido/[id]     comanda, cobro y recibo
src/app/caja            apertura, resumen y cierre de turno
src/app/historial       ventas por turno, pedidos y lo mas vendido
```
