const express = require("express");
var cors = require('cors')
const app = express();
const knex = require('knex');
const bcrypt = require('bcrypt');
const stripe = require('stripe')(process.env.STRIPE_API_KEY)
const PORT = process.env.PORT || 5001;

app.use(cors())
app.use(express.json());


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
    db.select('product_id','product_name','price','img','category').from('products').orderBy("product_id").then(product=>res.json(product));
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
  db.insert({customer_id:customerId,product_id:productId,cart_status:status,time_added:new Date()})
  .into('cart')
  .returning(['product_id','customer_id'])
  .then(data=>res.json(data));
})



// display items in cart 
app.post("/cartitem",(req,res)=>{
  const {customerId} = req.body;
  db('products').join('cart','cart.product_id','products.product_id').select('product_name','price','img','cart_item_id','cart.qty').where('cart.customer_id','=',customerId)
  .orderBy("time_added","desc")
  .then(data=>res.json(data))
  })

app.post("/getitemcartstatus",(req,res)=>{
  const {customerId,productId} = req.body;
  db('cart').select('cart_status').where("customer_id","=",customerId).where("product_id",'=',productId)
  .then(data=>{
    if(data!=''){
      res.json(data[0])
    }
    else{
      res.json('F')
    }
  })
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
    success_url: 'https://prathammittal17.github.io/shoppingwebsitefrontend/#/orderdone',
    cancel_url: 'https://prathammittal17.github.io/shoppingwebsitefrontend/#/',
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

app.post("/recommend",(req,res)=>{
  const {productId} = req.body;
  db("recommendations").select('product1','product2','product3','product4','product5').where('product_id','=',productId)
  .then(data=>res.json(data[0]))
  .catch(err=>res.status(400).json("No Product Found"))
});

app.post("/getProductDetailsHalf",(req,res)=>{
  const{productId} = req.body;
  db("products").select('product_id','product_name','price','img').where('product_id','=',productId)
  .then(data=>res.json(data[0]))
  .catch(err=>res.status(400).json("No Product Found"))
});

app.post("/getProductDetailsFull",(req,res)=>{
  const{productId} = req.body;
  db("products").select('product_id','product_name','price','img','about').where('product_id','=',productId)
  .then(data=>res.json(data[0]))
  .catch(err=>res.status(400).json("No Product Found"))
});

app.post("/productscategorywise",(req,res)=>{
  const{category} = req.body;
  db.select('product_id','product_name','price','img','category').from('products').where('category','=',category).orderBy("product_id").then(product=>res.json(product));
})

app.post("/getAddresses",(req,res)=>{
  const{userId} = req.body;
  db("login").select('addresses').where('id','=',userId)
  .then(data=>{
    if(data[0]===undefined || data[0].addresses===null){
      res.json([])
    }
    else{
      res.json(data[0].addresses)
    }

  })
})

app.post("/addAddress",(req,res)=>{
  const {userId,address} = req.body;
  db('login').where('id','=', userId).update({addresses: db.raw('array_append(addresses, ?)', [address])})
  .then(data=>res.json("done"))
})




app.listen(PORT,()=>{
    console.log('App is running on port ' + PORT);
})