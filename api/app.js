
require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
app.use(express.json());

const mongoURI = process.env.MONGO_URI;
const nombreBBDD = process.env.DDBB_NAME;

app.use(session({
  secret: 'your-secret-key', // Secret used to sign the session ID cookie
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something is stored
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));



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

/* GET */

app.get('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.send('Error logging out');
    }
    res.send('Logged out successfully');
  });
});

app.get('/api/firstCheck', (req, res) => {
  console.log('Session data:', req.session); // Log session data
  if (req.session.user) {
    res.send({ "respuesta": req.session.user.username });
  } else {
    res.send({ "respuesta": 'GTFO' });
  }
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

//{"autoriz":"trueOrFalse","name":"nombreUser"}
app.post('/api/setSession', async(req,res)=>{
  try {
    let autoriza = req.body.autoriz;
    let nombre = req.body.name;

    if (autoriza) {
      req.session.user = { autorizado: true, username: nombre };
      console.log('Session set:', req.session.user); // Log session data
      res.send(req.session.user);
    } else {
      res.send('no');
    }
  } catch (error) {
    console.error('Error setting session:', error); // Log errors
    res.send({ "mensaje": error });
  }
});


module.exports = app;