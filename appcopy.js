require('dotenv').config();
const express=require("express");
const bodyParser=require("body-parser");
const mongoose=require("mongoose");
const session = require('express-session');
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const findOrCreate=require("mongoose-findorcreate");
const cors = require('cors');
const cookieParser=require("cookie-parser");
const bcrypt=require("bcryptjs");
const localStrategy=require('passport-local').Strategy;


const app=express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(session({
    secret: 'Our little secret',
    resave: true,
    saveUninitialized: true,
  }));

app.use(cookieParser('Our little secret'));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB_CONNECTION_STRING,{useNewUrlParser:true});


const TwitterSchema=new mongoose.Schema({
    username:String,
    password:String,
    googleId:String,
    facebookId:String,
    displayName:String,
    tweets:[String]
});

const PostSchema=new mongoose.Schema({
    owner:String,
    displayNane:String,
    content:String,
    date:Date,
    likes:Number
})

const TwitterUser=mongoose.model('Users',TwitterSchema);
const Post=mongoose.model("Posts",PostSchema);

passport.use(new localStrategy((username,password,done) => {
    TwitterUser.findOne({username:username}).then(function(user){
        if(!user){
            return done(null,false);
        }
        bcrypt.compare(password,user.password,function(err,result){
            if(err) throw err;
            if(result){
                return done(null,user)
            }else{
                return done(null,false)
            }
        })

    }).catch(function(err){
        console.log(err);
    })
}));

passport.serializeUser(function(user, cb) {
    cb(null,user.id);
  });
  
passport.deserializeUser(function(id, cb) {
    TwitterUser.findOne({_id:id}).then(function(user){
        cb(null,user);
    }).catch(function(err){
        cb(err,null);
    });
  });

app.get('/home',function(req,res){
    if(req.isAuthenticated()){
        res.send({message:"Succesfully logged in"});
    }else{
        res.send({message:"Not logged in"});
    }
});

app.post('/register',function(req,res){
    var displayName=req.body.displayName;
    TwitterUser.findOne({username:req.body.username}).then(async function(data){
        if(data){
            res.send("Exists");
        }else{
            const hashedPassword=await bcrypt.hash(req.body.password,10);
            const newUser=new TwitterUser({
                username:req.body.username,
                password:hashedPassword,
                displayName:req.body.displayName,
                tweets:[]
            });
            await newUser.save();
            res.send("Created");
        }
    }).catch(function(err){
        throw err;
    });
})

app.post('/login',function(req,res,next){
    passport.authenticate("local",(err,user,info) => {
        if(err) throw err;
        if(!user) res.send("No User Exists");
        else{
            req.logIn(user,err => {
                if(err) throw err;
                res.send("Success");
            })
        }
    })
})

app.get('/logout',function(req,res){
    req.logout(function(err){
        if(err){
            console.log(err);
        }else{
            res.send({message:"Success"});
        }   
    });
})

app.listen(8000,function(){
    console.log("Server started on port 8000");
})