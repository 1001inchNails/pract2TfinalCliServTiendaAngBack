
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


/* POST */

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



module.exports = app;