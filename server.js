const express = require("express");
var cors = require('cors')
const app = express();
const knex = require('knex');
const bcrypt = require('bcrypt');
const stripe = require('stripe')('sk_test_51JmIXVSBM1qtXmvlyXGlNlHTUdpBOG4i2D01PoSDICL0X2nlC4JmIu4PnhoKhLecpSM8BsbxMtebkXzKbjJS6Ix500Vty5WNKv')
const PORT = process.env.PORT || 5001;

app.use(cors())
app.use(express.json());

// const db = knex({
//     client: 'pg',
//     connection: {
//       host : '127.0.0.1',
//       port : 5432,
//       user : 'postgres',
//       password : '1234',
//       database : 'shoppingsite'
      
//     }
//   });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
const db = knex({
                    client: 'pg',
                    connection: {
                    connectionString : process.env.DATABASE_URL,
                    ssl:true,
                    }
                });


  

app.get("/",(req,res)=>{
    res.send('Working');
})

//PRODUCTS

app.get("/products",(req,res)=>{
    db.select('*').from('products').orderBy("product_id").then(product=>res.json(product));
})


//LOGIN AND REGISTER
app.post("/login",(req,res)=>{
  const {email,password} = req.body;
  
  db.select('email','password').from('login')
  .where('email','=',email)
  .then(data=>{
    const isValid = bcrypt.compareSync(password,data[0].password)
    if(isValid){
      db.select("id","email","name","cart_items").from("login")
      .where("email","=",email)
      .then(data=>{
        res.json(data[0])
      })
      }
      else {
        res.status(400).json('wrong credentials')
      }
  })
  .catch(err => res.status(400).json('wrong credentials'))
    
});

app.post("/register",(req,res)=>{
  const {fname,lname,email,password} = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(trx=>{
    trx.insert({
      cust_fname:fname,
      cust_lname:lname,
      email_address:email
    })
    .into('customers')
    .returning(['cust_id','email_address','cust_fname','cust_lname'])
    .then(data=>{
      trx('login').returning(['email','name','id','cart_items']).insert({
        id:data[0].cust_id,
        email:data[0].email_address,
        password:hash,
        name:data[0].cust_fname+" "+data[0].cust_lname
      })
      .then(user=>{
          res.json(user[0])
      })
    })
    .then(trx.commit)
    .catch(trx.rollback)
  })
  .catch(err =>res.status(400).json('Unable to register'));
   
});

//CART 

// insert into cart 
app.post("/cart",(req,res)=>{
  const {productId,customerId,status} = req.body;
  db.insert({customer_id:customerId,product_id:productId,cart_status:status})
  .into('cart')
  .returning(['product_id','customer_id'])
  .then(data=>res.json(data));
})



// display items in cart 
app.post("/cartitem",(req,res)=>{
  const {customerId} = req.body;
  db('products').join('cart','cart.product_id','products.product_id').select('product_name','price','img','cart_item_id','cart.qty').where('cart.customer_id','=',customerId).orderBy('price','desc')
  .then(data=>res.json(data))
  })

app.post("/getitemcartstatus",(req,res)=>{
  const {customerId} = req.body;
  db('cart').select('cart_status','product_id').where("customer_id","=",customerId)
  .then(data=>res.json(data))
  .catch(err=>res.status(400).json("error"))
})

app.delete("/removecartitem",(req,res)=>{
  const {item_id} = req.body;
  db("cart").del().where("cart_item_id",'=',item_id)
  .then(res.json("deleted"))
})

app.put("/updatecartitemqty",(req,res)=>{
  const {cartItemId,qty} = req.body; 
  db('cart').update({qty:qty}).where("cart_item_id","=",cartItemId)
  .then(res.json("done"))
  .catch(err=>res.status(400).json("error"))
})

app.put("/carttotalitems",(req,res)=>{
  const {customerId,operation} = req.body;

  if(operation=="I"){
  db("login").where("id","=",customerId).increment("cart_items",1).returning("cart_items")
  .then(data=>res.json(data))
  }
  else if(operation=="D"){
    db("login").where("id","=",customerId).decrement("cart_items",1).returning("cart_items")
  .then(data=>res.json(data))
  }

})

app.post("/getCartTotalItems",(req,res)=>{
  const {custId} = req.body;
  db("login").select("cart_items").where("id",'=',custId)
  .then(data=>res.json(data[0]))

});

app.post("/create-checkout-session",async (req,res)=>{
  const {amount} = req.body;
  
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: 'Total Items',
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'http://localhost:3000/orderdone',
    cancel_url: 'http://localhost:3000/',
  })
  .then(data=>res.json(data))
  
  
});


app.post("/creatingOrder",(req,res)=>{
  const {custId,productName,qty,price,img} = req.body;
  db("orders").insert({cust_id:custId,product_name:productName,price:price,qty:qty,date:new Date(),img:img})
  .then(res.json("done"))

});

app.post('/gettingOrder',(req,res)=>{
  const custId = req.body;
  db("orders").select('*').where('cust_id','=',custId.custId).orderBy('date','desc')
  .then(data=>res.json(data))
})


app.listen(PORT,()=>{
    console.log('App is running on port ' + PORT);
})


