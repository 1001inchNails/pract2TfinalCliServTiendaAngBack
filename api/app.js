
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const mongoURI = process.env.MONGO_URI;
const nombreBBDD = process.env.DDBB_NAME;

const jwt = require("jsonwebtoken");
const cors = require("cors");

app.use(express.json());
app.use(cors());

const SECRET_KEY = "hitlerdidnothingwrong"; // (es broma...)

async function conectarCliente(){
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = mongoURI;
const client = new MongoClient(uri, {
serverApi: {
version: ServerApiVersion.v1,
strict: true,
deprecationErrors: true,
}
});
return client;
}

// todos los documentos de "x" coleccion
async function listadoDatos(colecc) {
const cliente=await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection(colecc);
const query = {}; // todos
let dato = await datos.find(query).toArray();
return dato;
} finally {
await cliente.close();
}
}

// todos los pedidos de "x" coleccion, "y" usuario
async function listadoPedidos(colecc, username) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection(colecc);

const query = { name: username };
const documento = await datos.findOne(query);

if (documento && documento.pedidos && documento.pedidos.length > 0) { // si existe documento, existe array pedidos y tiene tamaño mayor que 0
return documento.pedidos;
} else {
return [];
}
} finally {
await cliente.close();
}
}

// envia array con todos los pedidos pendientes de todos los usuarios
async function listadoPedidosPendientes(colecc) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection(colecc);

const usuarios = await datos.find({}).toArray(); // todos los usuarios

const pedidosPendientes = [];

for (const usuario of usuarios) {   // iteramos sobre cada uno de los usuarios
if (usuario.pedidos && Array.isArray(usuario.pedidos)) {  // chequeo de existencia y consistencia de array
const pendientes = usuario.pedidos  // filtramos para todos los objetos de pedido pendiente
.filter(pedido => pedido.estado === "pendiente")
.map(pedido => ({
...pedido, // "spread"
name: usuario.name // añadimos nombre de usuario al objeto
}));

pedidosPendientes.push(...pendientes); // pusheamos lo filtrado
}
}
return pedidosPendientes;
} finally {
await cliente.close();
}
}

// chequeo de credenciales
async function checkCred(nombre,passw){
let autorizacion = false;
let datos = await listadoDatos('creds');
datos.forEach(element => {
if(element.name == nombre && element.password == passw){
autorizacion = true;
}
});
return autorizacion;
}

// inserta nuevo documento "x" en la coleccion "y"
async function insertarNuevoDocumento(nuevoDoc,colec) { 
const cliente=await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection(colec);
await datos.insertOne(nuevoDoc);
} finally {
await cliente.close();
}
}

// agregar objeto "x" en array de documento filtrado por nombre de usuario
async function agregarObjetoAArray(username, nuevoObjeto, colec) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection(colec);

const resultado = await datos.updateOne(  // buscamos el documento con el username dado y agregamos el nuevo objeto al array
{ name: username },
{ $push: { pedidos: nuevoObjeto } }
);

if (resultado.matchedCount === 0) {
console.log("No se encontró ningún documento con el username proporcionado.");
} else {
console.log("SAKSES.");
}
} finally {
await cliente.close();
}
}

// copiar documento de coleccion "x" a coleccion "y" y borrarlo de "x", mediante par key:value
async function cambiarDocuDeColecc(nombreKeyId,valorId,coleccOrigen,coleccDestino) {
const cliente=await conectarCliente();
try {
const database = cliente.db(nombreBBDD);

let origen = database.collection(coleccOrigen); // origen
let query = { [nombreKeyId]: valorId };
let documento = await origen.findOne(query);   // buscamos documento

let destino = database.collection(coleccDestino); // destino
await destino.insertOne(documento); // lo metemos en la coleccion de destino

await origen.deleteOne(query);  // Lo borramos de la coleccion de origen
} catch (err) {
console.error('Error:', err);
} finally {
await cliente.close();
}
}

// igual que el anterior pero sin borrar el documento de la coleccion original (caso de aceptar/rechazar compra, se manda una copia a historial pero permanece en la lista de compras del usuario hasta que este decida borrarla)
async function copiarDocu(nombreuser, nombreKeyId, valorId, coleccOrigen, coleccDestino) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);

let origen = database.collection(coleccOrigen);
let query = { name: nombreuser };
let documento = await origen.findOne(query);

if (documento) {
let pedidos = documento.pedidos;
let objetoEncontrado = pedidos.find(pedido => pedido[nombreKeyId] === valorId);

if (objetoEncontrado) {
let destino = database.collection(coleccDestino);
await destino.insertOne(objetoEncontrado);
console.log('Objeto copiado exitosamente.');
} else {
console.error('Objeto no encontrado en el array pedidos.');
}
} else {
console.error('Documento no encontrado.');
}

} catch (err) {
console.error('Error:', err);
} finally {
await cliente.close();
}
}

// devolucion de stock a determinado producto
async function devolverStock(idProducto, extraStock) {
const cliente = await conectarCliente();

try {
const database = cliente.db(nombreBBDD);
const productosCollection = database.collection('productos');

const query = { id: idProducto }; // busqueda del producto
const producto = await productosCollection.findOne(query);

if (!producto) {
throw new Error('Product not found');
}

const currentStock = producto.stock;  // valor actual para realizar devolucion

const newStock = currentStock + extraStock; // valor con devolucion

const updateQuery = { id: idProducto }; // update con el nuevo valor
const updateOperation = { $set: { stock: newStock } };
await productosCollection.updateOne(updateQuery, updateOperation);


} finally {
await cliente.close();
}
}

// para cancelar o eliminar pedidos (cliente)
async function cancelarEliminar(nombreuser, nombreKeyId, valorId, coleccOrigen, coleccDestino, copiar) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);

let origen = database.collection(coleccOrigen); // busqueda de objetivo por nombre de usuario
let query = { name: nombreuser };
let documento = await origen.findOne(query);

if (documento) {  // buscamos el pedido
let pedidos = documento.pedidos;
let objetoEncontrado = pedidos.find(pedido => pedido[nombreKeyId] === valorId);

if (objetoEncontrado) { // chequeo de existencia de objeto
if (copiar) { // si hay orden de copiar (para compras que aun estan pendientes, se mandan al historial con estado:"cancelado" (esto ocurre en el jquery: client.js, linea 306))
// Copiamos el objeto encontrado a la colección de destino
let destino = database.collection(coleccDestino);
await destino.insertOne(objetoEncontrado);
console.log('Objeto copiado exitosamente.');
}

let updatedPedidos = pedidos.filter(pedido => pedido[nombreKeyId] !== valorId);   // eliminamos el objeto del array 'pedidos'

await origen.updateOne(query, { $set: { pedidos: updatedPedidos } });
console.log('Objeto eliminado del array pedidos.');

} else {
console.error('Objeto no encontrado en el array pedidos.');
}
} else {
console.error('Documento no encontrado.');
}

} catch (err) {
console.error('Error:', err);
} finally {
await cliente.close();
}
}

// cuando eliminamos un producto, borramos todos los pedidos pendientes
async function removePedidosDeProductosEliminados(idProducto) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const collection = database.collection('creds');

const cursor = collection.find({});

while (await cursor.hasNext()) {  // para iterar sobre todos los elementos del cursor (true si hay mas, false si no)
const doc = await cursor.next();  // siguiente elemento
if (Array.isArray(doc.pedidos)) { // checqueo de existencia
const updatedPedidos = doc.pedidos.filter(pedido => //  filtramos fuera (!) por estado:"pendiente" y id de producto
!(pedido.estado === "pendiente" && pedido.id === idProducto)
);
await collection.updateOne( // update sin los pedidos que queriamos borrar
{ _id: doc._id },
{ $set: { pedidos: updatedPedidos } }
);
} else {
console.warn(`BEEP BEEP madafaka, document with _id ${doc._id} has no valid pedidos array. Skipping...`);
}
} 
}catch (err) {
console.error('Error:', err);
} finally {
await cliente.close();
}
}


// operacion de cambio de estado en un objeto de array pedidos
async function cambiarEstadoPedido(nuevoestado, nombreuser, nombreKeyId, valorId, coleccOrigen) {
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);

let origen = database.collection(coleccOrigen); // buscamos documento por nombre de usuario
let query = { name: nombreuser };
let documento = await origen.findOne(query);

if (documento) {
let pedidos = documento.pedidos;

let objetoEncontrado = pedidos.find(pedido => // buscamos en el array el pedido que cumpla con nombreKeyId:valorId y estado:"pendiente"
pedido[nombreKeyId] === valorId && pedido.estado === "pendiente"
);

if (objetoEncontrado) { // cambiamos el estado del objeto encontrado        
objetoEncontrado.estado = nuevoestado;

await origen.updateOne( // actualizamos el documento en la colección de origen
{ 
name: nombreuser, 
"pedidos": { 
$elemMatch: { 
  [nombreKeyId]: valorId, 
  estado: "pendiente" 
} 
} 
},
{ $set: { "pedidos.$": objetoEncontrado } }
);

console.log('Estado del pedido actualizado exitosamente.');
} else {
console.error('Objeto no encontrado en el array pedidos con estado "pendiente".');
}
} else {
console.error('Documento no encontrado (cambiar estado).');
}

} catch (err) {
console.error('Error:', err);
} finally {
await cliente.close();
}
}

// modificar valores de producto, por id
async function modifProducto(idvalue, producto, descripcion, precio, stock, rutaImagen) { 
const cliente = await conectarCliente();
try {
const database = cliente.db(nombreBBDD);
const datos = database.collection('productos');

const query = { 'id': idvalue };

const update = {
$set: {
'producto': producto,
'descripcion': descripcion,
'precio': precio,
'stock': stock,
'rutaImagen': rutaImagen
}
};

const result = await datos.updateOne(query, update);

if (result.matchedCount === 0) {
throw new Error(`No document, bitch: ${idvalue}`);
}
} finally {
await cliente.close();
}
}

// cambiar valor de stock, mediant id
async function updateStock(id, nuevoStock) {
const cliente = await conectarCliente();

try {
const database = cliente.db(nombreBBDD);
const datos = database.collection('productos');

const query = { id: id };

const update = { $set: { stock: nuevoStock } };

const result = await datos.updateOne(query, update);

if (result.matchedCount > 0) {
console.log(`Sakses uiz aidi: ${id}`);
} else {
console.log(`Saz trombon noises: ${id}`);
}
} catch (error) {
console.error('Error updating stock:', error);
} finally {
await cliente.close();
}
}

// https://stackoverflow.com/questions/47523265/jquery-ajax-no-access-control-allow-origin-header-is-present-on-the-requested
app.use((req, res, next) => {
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
if (req.method === 'OPTIONS') {
return res.sendStatus(204);
}
next();
});

/* GETS */

app.get("/", (req, res) => {
res.json({
message: "Escucha establecida con exito",
})
})

app.get('/api/prods',async(req, res)=>{  // mostrar todos los menus
let productos=await listadoDatos('productos');
res.json(productos);
});

app.get('/api/hist',async(req, res)=>{  // mostrar historial
let productos=await listadoDatos('pedidosHistorial');
res.json(productos);
});

/* POST */

app.post("/login", (req, res) => {  // para crear token de autorizacion
  const { nombre, autoriz } = req.body;
  const token = jwt.sign({ nombre, autoriz }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

app.post('/api/comprs',async(req, res)=>{  // mostrar todos los pedidos del cliente
let userC = req.body.user;
let productos=await listadoPedidos('creds',userC);
res.json(productos);
});

app.post('/api/comprsall',async(req, res)=>{  // mostrar todos los pedidos de todos los clientes
let productos=await listadoPedidosPendientes('creds');
res.json(productos);
});

//{"name":"nombreUsuario","password":"passwordUsuario"}
app.post('/api/checkCreds', async(req,res)=>{
try{

let nombreU=req.body.name;
let passU=req.body.password;

let result = await checkCred(nombreU,passU);
res.json({"resultado":result});
}catch(error){
res.send({"mensaje":error});
}
});

//{"producto": "producto","descripcion": "descripcion","precio": "precio","stock": "stock","rutaImagen": "rutaImagen"}
app.post('/api/nuevoProducto', async(req,res)=>{  // crear nuevo producto
try{
let nuevoIndice;
let productosC=await listadoDatos('productos');

if(productosC.length>0){  // calculamos nuevo indice, de esta manera no se rompe el flujo natural de ids si se borra un objeto
let ultimo = productosC[productosC.length - 1];
nuevoIndice=ultimo.id;
nuevoIndice++;
}else{
nuevoIndice=(productosC.length);
nuevoIndice++;
}

let nuevoProducto=req.body.producto;  // cojemos los valores para el nuevo dato
let nuevaDescripcion=req.body.descripcion;
let nuevoPrecio=req.body.precio;
let nuevoStock=req.body.stock;
let nuevaRutaImg=req.body.rutaImagen;

let datoNuevo={
"id":nuevoIndice.toString(),
"producto":nuevoProducto,
"descripcion":nuevaDescripcion,
"precio":nuevoPrecio,
"stock":nuevoStock,
"rutaImagen":nuevaRutaImg
};

await insertarNuevoDocumento(datoNuevo,'productos') // actualizacion de BBDD
.then(() => console.log('Operacion realizada con exito'))
.catch((error) => console.error('Error al introducir datos:', error));

res.json({"mensaje":"Menu introducido correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/enviarPedido', async(req,res)=>{  // realizar pedido
try{
let nuevoIndice=0;

// cojemos los valores para el nuevo pedido
let username = req.body.nombreUser;
let idProducto = req.body.id;
let nuevoProducto=req.body.producto;  
let nuevaDescripcion=req.body.descripcion;
let nuevoPrecio=req.body.precio;
let nuevoStock=req.body.stock;
let nuevaRutaImg=req.body.rutaImagen;
let user = req.body.nombreUser;
let estado = req.body.estado;

let productosC=await listadoPedidos('creds',user);

if(productosC.length>0){  // calculamos nuevo indice, de esta manera no se rompe el flujo natural de ids si se borra un objeto
let ultimo = productosC[productosC.length - 1];
nuevoIndice=ultimo.idPedido;
nuevoIndice++;
}else{
nuevoIndice=(productosC.length);
nuevoIndice++;
}

let datoNuevo={
"username":username,
"idPedido":nuevoIndice.toString(),
"id":idProducto,
"producto":nuevoProducto,
"descripcion":nuevaDescripcion,
"precio":nuevoPrecio,
"stock":nuevoStock,
"rutaImagen":nuevaRutaImg,
"estado": estado
};

await agregarObjetoAArray(user,datoNuevo,'creds') // actualizacion de BBDD
.then(() => console.log('Operacion realizada con exito'))
.catch((error) => console.error('Error al introducir datos:', error));

res.json({"mensaje":"Pedido realizado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

//{"idkey":"nombreCampoId","idvalue":"valorDeId","coleccOrigen":"nombreColeccOriginal","coleccDestino":"nombreColeccDestino"}
app.post('/api/moverDocumento', async(req,res)=>{ // mover documento borrando de origen
try{
let idkey=req.body.idkey;
let idvalue=req.body.idvalue;
let coleccOrigen=req.body.coleccOrigen;
let coleccDestino=req.body.coleccDestino;

await cambiarDocuDeColecc(idkey,idvalue,coleccOrigen,coleccDestino);
res.json({"mensaje":"Documento trasladado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/copiarDocumento', async(req,res)=>{ // copiar documento sin borrar original
try{
let username = req.body.username;
let idkey=req.body.idkey;
let idvalue=req.body.idvalue;
let coleccOrigen=req.body.coleccOrigen;
let coleccDestino=req.body.coleccDestino;

await copiarDocu(username,idkey,idvalue,coleccOrigen,coleccDestino);
res.json({"mensaje":"Documento copiado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/cancelareliminar', async(req,res)=>{ // cancelar/eliminar
try{
let username = req.body.username;
let idkey=req.body.idkey;
let idvalue=req.body.idvalue;
let coleccOrigen=req.body.coleccOrigen;
let coleccDestino=req.body.coleccDestino;
let copiar = req.body.copiar;

await cancelarEliminar(username,idkey,idvalue,coleccOrigen,coleccDestino,copiar);
res.json({"mensaje":"Documento copiado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/removePedidosDeProductosEliminados', async(req,res)=>{ // eliminar pedidos de productos eliminados
try{
let idProducto = req.body.idProducto;

await removePedidosDeProductosEliminados(idProducto);
res.json({"mensaje":"Documento copiado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/cambiarEstado', async(req,res)=>{ // cambiar estado de pedido
try{
let estado = req.body.estado;
let username = req.body.username;
let idkey=req.body.idkey;
let idvalue=req.body.idvalue;
let coleccOrigen=req.body.coleccOrigen;

await cambiarEstadoPedido(estado,username,idkey,idvalue,coleccOrigen);
res.json({"mensaje":"Estado cambiado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/modifProd', async(req,res)=>{ // modificar producto
try{
let idvalue=req.body.id;
let producto=req.body.producto;
let descripcion=req.body.descripcion;
let precio=req.body.precio;
let stock=req.body.stock;
let rutaImagen=req.body.rutaImagen;

await modifProducto(idvalue,producto,descripcion,precio,stock,rutaImagen);
res.json({"mensaje":"Producto modificado correctamente"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/updateStock', async(req,res)=>{ // cambiar valor de stock de producto
try{
let id=req.body.id;
let stock=req.body.stock;

await updateStock(id,stock);
res.json({"mensaje":"Update correcto"});
}catch(error){
res.send({"mensaje":error});
}
});

app.post('/api/devolverStock', async(req,res)=>{ //devolver stock despues de rechazar/cancelar compra
try{
let id=req.body.idProducto;
let stock=req.body.extrastock;

await devolverStock(id,stock);
res.json({"mensaje":"Update correcto"});
}catch(error){
res.send({"mensaje":error});
}
});

module.exports = app;