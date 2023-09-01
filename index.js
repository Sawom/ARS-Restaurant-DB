const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
// eta na dile dot env kaj kore na
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsdjaxv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true,}});

async function run(){
    try{
       await client.connect();
       const menuCollection = client.db('ARS-Restaurant').collection('menu'); // menu collection from mongodb
       const reviewCollection = client.db('ARS-Restaurant').collection('reviews');  // reviews collection from mongodb
       const cartCollection = client.db('ARS-Restaurant').collection('carts');

        // menu collection theke find method use kore shob menu antechi from mongodb atlas
        app.get('/menu', async(req, res)=>{
            const result = await menuCollection.find().toArray();
            res.send(result);
       })

    //cart collection api
    //   ekhane email diye query mane filter kortechi r email wise data dekhacchi.
    app.get('/carts', async(req, res)=>{
        const email = req.query.email;
        // console.log(email);
        if(!email){
            res.send([]);
        }
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      })

       //cart er data collection
       app.post('/carts', async(req,res) =>{
        const item = req.body;
        console.log(item);
        const result = await cartCollection.insertOne(item);
        res.send(result);
       })

    // reviews collection theke find method use kore shob menu antechi from mongodb atlas 
    app.get('/reviews', async(req, res)=>{
        const reviewsResult = await reviewCollection.find().toArray();
        res.send(reviewsResult);
    })

    }

    finally{
        // eta fakai thakbe
    }
}
run().catch(console.dir);
// connection end

app.get('/', (req, res) => {
    res.send('ars running');
})

app.listen(port, ()=> {
    console.log(`ars server running at ${port}` );
}) 