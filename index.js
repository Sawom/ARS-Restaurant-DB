const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
// eta na dile dot env kaj kore na
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
// jwt token
const jwt = require('jsonwebtoken');

// middleware
app.use(cors());
app.use(express.json());

// jwt token verify. eta dekhteche user thik kore ashe kina
//authorization header ashle etar vitor zabe na. na thakle ekta error dilam.
// header thakle token ber korar cesta kortechi. token pawa gele normal kaj korbo.
// error khaile abar ager moto send kortechi
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token.
  // authorization er header 2vabe thake 1. bearer 2. token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
} // end

// connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsdjaxv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true,}});

async function run(){
    try{
       await client.connect();
        //    making collection
       const usersCollection = client.db('ARS-Restaurant').collection('users'); // user register or google sign in data stored
       const menuCollection = client.db('ARS-Restaurant').collection('menu'); // menu collection from mongodb
       const reviewCollection = client.db('ARS-Restaurant').collection('reviews');  // reviews collection from mongodb
       const cartCollection = client.db('ARS-Restaurant').collection('carts');   // carts data collection
       const paymentCollection = client.db('ARS-Restaurant').collection('payments');   // payments data collection


        // create jwt token. client side thek call dite hobe
        app.post('/jwt', (req,res)=>{
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '6h'})
            
            res.send({token})
        } )

        // Warning: use verifyJWT before using verifyAdmin
        // verify admin middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        /**
         * 0. do not show secure links to those who should not see the links
         * 1. use jwt token: verifyJWT
         * 2. use verifyAdmin middleware
        */
        // show all users
        app.get( '/users', verifyJWT, verifyAdmin, async(req, res) =>{
            const result = await usersCollection.find().toArray();
            res.send(result);
        } )

        // user admin kina check korbo. 
        // ze call korbe se valid kina etaw jwt diye check kortechi
        // token e ze user ache r zake check kora hoiche 2jon same kina
        // 1. security layer: verifyJWT
        // 2. email same
        // 3. check admin
        app.get('/users/admin/:email', verifyJWT, async(req, res)=>{
            const email = req.params.email;
            // 2ta token same kina
            if(req.decoded.email !== email ){
                res.send( {admin: false} )
            }
            const query = {email: email}
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin'}
            res.send(result);
            
        } )

        // make admin from user. patch kortechi karon just ekta info update korbo.
        // pura info update korle put use kortam.  users/admin/ dichi admin banabo tai
        app.patch('/users/admin/:id', async(req, res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // users api both email and google login. 
        // 2types user e database e add korbe
        app.post('/users', async(req,res) =>{
            const user = req.body;
            const query = {email: user.email}
            const existingUser = await usersCollection.findOne(query);
            console.log( 'existingUser: ', existingUser);
            // google sign in diye korar somoy zodi email ta age theke
            // thake tahole new add hobe na. otherwise add hobe
            if(existingUser){
                return res.send({ message: 'user already exists!' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        } )

        // menu collection theke find method use kore shob menu antechi from mongodb atlas
        app.get('/menu', async(req, res)=>{
            const result = await menuCollection.find().toArray();
            res.send(result);
       })

        // add menu in database
        // admin secure
        app.post('/menu', verifyJWT, verifyAdmin, async(req,res)=>{
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);
        })

        // menu delete. admin secure
        app.delete('/menu/:id', verifyJWT, verifyAdmin, async(req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        //cart collection api
        // ekhane email diye query mane filter kortechi r email wise data dekhacchi.
        // ze login korbe tar data dekhabe
       //  ****jwt used here...........
        // ze keu email kore data pay tai token diye verrify kortechi
        app.get('/carts', verifyJWT, async(req, res)=>{
            const email = req.query.email;
            // console.log(email);
            // jwt part
            if(!email){
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            } // end jwt part

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

        // delete data. ekhane dashboard theke user er order data delete korbo
        app.delete('/carts/:id', async(req,res) =>{
            const id = req.params.id;
            const query  = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        } )

        // payment api from docs stripe
        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })

        })

        // payment store related api
        // payment howar por cart item gula shob remove kore dicchi
        app.post('/payments', verifyJWT, async(req,res)=>{
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            const deleteResult = await cartCollection.deleteMany(query)
            res.send({ insertResult, deleteResult });
        })

        // delete users
        app.delete('/users/:id', async(req,res) =>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // reviews collection theke find method use kore shob menu antechi from mongodb atlas 
        app.get('/reviews', async(req, res)=>{
            const reviewsResult = await reviewCollection.find().toArray();
            res.send(reviewsResult);
        })

        // admin api
        // admin home zei info gula dekhabe
        app.get('/admin-stats' , verifyJWT, verifyAdmin, async(req, res)=>{
            const users = await usersCollection.estimatedDocumentCount();
            const products = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // best way to get sum. eta diye revenue dekhabo
            const payments = await paymentCollection().find().toArray();
            const revenue = payments.reduce ((sum, payment) => sum + payment.price , 0 );
            res.send(
                users,
                products,
                orders
            )
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