
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const mongoURI = process.env.MONGO_URI;
const nombreBBDD = process.env.DDBB_NAME;


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


async function listadoDatos(colecc) {
  const cliente=await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);
    const datos = database.collection(colecc);
    const query = {};
    let dato = await datos.find(query).toArray();
    return dato;
  } finally {
    await cliente.close();
  }
}

async function listadoPedidos(colecc, username) {
  const cliente = await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);
    const datos = database.collection(colecc);

    const query = { name: username };
    const documento = await datos.findOne(query);

    if (documento && documento.pedidos && documento.pedidos.length > 0) {
      return documento.pedidos;
    } else {
      return [];
    }
  } finally {
    await cliente.close();
  }
}


async function listadoPedidosArray(colecc, username) {
  const cliente = await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);
    const datos = database.collection(colecc);

    const query = { name: username };
    const documento = await datos.findOne(query);

    if (documento) {
      return documento.pedidos;
    } else {
      return [];
    }
  } finally {
    await cliente.close();
  }
}


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

async function insertarNuevoDocumento(nuevoDoc,colec) { // inserta nuevo documento en la coleccion
  const cliente=await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);
    const datos = database.collection(colec);
    await datos.insertOne(nuevoDoc);
  } finally {
    await cliente.close();
  }
}

async function agregarObjetoAArray(username, nuevoObjeto, colec) {
  const cliente = await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);
    const datos = database.collection(colec);

    const resultado = await datos.updateOne(  // Busca el documento con el username dado y agrega el nuevo objeto al array
      { name: username }, // Filtro para encontrar el documento con el username
      { $push: { pedidos: nuevoObjeto } } // Agrega el nuevo objeto al array
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

async function cambiarDocuDeColecc(nombreKeyId,valorId,coleccOrigen,coleccDestino) {
  const cliente=await conectarCliente();
  try {
    const database = cliente.db(nombreBBDD);

      // Buscamos documento
      let origen = database.collection(coleccOrigen);
      let query = { [nombreKeyId]: valorId };
      let documento = await origen.findOne(query);

      // Lo metemos en la coleccion de destino
      let destino = database.collection(coleccDestino);
      await destino.insertOne(documento);

      // Lo borramos de la colecc de origen
      await origen.deleteOne(query);
  } catch (err) {
      console.error('Error:', err);
  } finally {
      await cliente.close();
  }
}


async function modifProducto(idvalue, producto, descripcion, precio, stock, rutaImagen) { // modificar valores de producto, por id
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
    //console.log(result);

    if (result.matchedCount === 0) {
      throw new Error(`No document, bitch: ${idvalue}`);
    }
  } finally {
    await cliente.close();
  }
}

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



app.get("/", (req, res) => {
  res.json({
    message: "Escucha establecida con exito",
  })
})

// https://stackoverflow.com/questions/47523265/jquery-ajax-no-access-control-allow-origin-header-is-present-on-the-requested
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204); // No content, just headers
  }
  next();
});
/* GETS */

app.get('/api/prods',async(req, res)=>{  // mostrar todos los menus
  let productos=await listadoDatos('productos');
  res.json(productos);
});

/* POST */

app.post('/api/comprs',async(req, res)=>{  // mostrar todos los pedidos del cliente
  console.log("compras");
  let userC = req.body.user;
  let productos=await listadoPedidosArray('creds',userC);
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
app.post('/api/nuevoProducto', async(req,res)=>{  // NUEVO PRODUCTO
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
    
    await insertarNuevoDocumento(datoNuevo,'productos') // actualizacion de BBDD, nuevo menu
    .then(() => console.log('Operacion realizada con exito'))
    .catch((error) => console.error('Error al introducir datos:', error));

    res.json({"mensaje":"Menu introducido correctamente"});
  }catch(error){
    res.send({"mensaje":error});
  }
});


app.post('/api/enviarPedido', async(req,res)=>{  // NUEVO PEDIDO
  try{
    let nuevoIndice=0;
    
    let idProducto = req.body.id;
    let nuevoProducto=req.body.producto;  // cojemos los valores para el nuevo dato
    let nuevaDescripcion=req.body.descripcion;
    let nuevoPrecio=req.body.precio;
    let nuevoStock=req.body.stock;
    let nuevaRutaImg=req.body.rutaImagen;
    let user = req.body.nombreUser;
    let estado = req.body.estado;

    console.log("user: ",user);
    let productosC=await listadoPedidos('creds',user);
    console.log("proCL: ",productosC.length);

    if(productosC.length>0){  // calculamos nuevo indice, de esta manera no se rompe el flujo natural de ids si se borra un objeto
      let ultimo = productosC[productosC.length - 1];
      nuevoIndice=ultimo.id;
      nuevoIndice++;
    }else{
      nuevoIndice=(productosC.length);
      nuevoIndice++;
    }
    console.log("indice : ",nuevoIndice);


    let datoNuevo={
      "idPedido":nuevoIndice.toString(),
      "id":idProducto,
      "producto":nuevoProducto,
      "descripcion":nuevaDescripcion,
      "precio":nuevoPrecio,
      "stock":nuevoStock,
      "rutaImagen":nuevaRutaImg,
      "estado": estado
    };
    
    await agregarObjetoAArray(user,datoNuevo,'creds') // actualizacion de BBDD, nuevo menu
    .then(() => console.log('Operacion realizada con exito'))
    .catch((error) => console.error('Error al introducir datos:', error));

    res.json({"mensaje":"Pedido realizado correctamente"});
  }catch(error){
    res.send({"mensaje":error});
  }
});



//{"idkey":"nombreCampoId","idvalue":"valorDeId","coleccOrigen":"nombreColeccOriginal","coleccDestino":"nombreColeccDestino"}
app.post('/api/moverDocumento', async(req,res)=>{ // MOVER A OTRA COLECCION Y BORRAR DE LA ORIGINAL
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



app.post('/api/modifProd', async(req,res)=>{ // MODIFICAR VALORES DE PRODUCTO
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


app.post('/api/updateStock', async(req,res)=>{ // MOVER A OTRA COLECCION Y BORRAR DE LA ORIGINAL
  try{
    let id=req.body.id;
    let stock=req.body.stock;


    await updateStock(id,stock);
    res.json({"mensaje":"Update correcto"});
  }catch(error){
    res.send({"mensaje":error});
  }
});



module.exports = app;
