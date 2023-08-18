require('dotenv').config();
const express=require("express");
const bodyParser=require("body-parser");
const mongoose=require("mongoose");
const session = require('cookie-session');
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const findOrCreate=require("mongoose-findorcreate");
const cors = require('cors');
const cookieParser=require("cookie-parser");
const bcrypt=require("bcryptjs");
const localStrategy=require('passport-local').Strategy;
const PORT=process.env.PORT || 8000;


const app=express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials:true,
}));

app.use(session({
    secret: 'Our little secret',
    resave: true,
    saveUninitialized: true,
  }));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB_CONNECTION_STRING,{useNewUrlParser:true});


const TwitterSchema=new mongoose.Schema({
    username:String,
    password:String,
    googleId:String,
    facebookId:String,
    displayName:String,
    dateofJoin:String,
    tweets:[String]
});

const PostSchema=new mongoose.Schema({
    owner:String,
    username:String,
    displayName:String,
    content:String,
    imageLink:String,
    date:String,
    likes:[String]
})


TwitterSchema.plugin(passportLocalMongoose);
TwitterSchema.plugin(findOrCreate);

const TwitterUser=mongoose.model('Users',TwitterSchema);
const Post=mongoose.model("Posts",PostSchema);

passport.use(TwitterUser.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });


app.get('/home',function(req,res){
    if(req.isAuthenticated()){
        TwitterUser.findById(req.user.id).then(function(data){
            var user={
                username:data.username,
                displayName:data.displayName,
                dateofJoin:data.dateofJoin ? data.dateofJoin : new Date(),
                no_tweets:data.tweets.length,
                userId:req.user.id
            };
            res.send({message:true,user:user});
        });
       
    }else{
        res.send({message:false});
    }
});

app.post('/register',function(req,res){
    var displayName=req.body.displayName;
    TwitterUser.findOne({username:req.body.username}).then(async function(data){
        if(data){
            res.send({message:"Exists"});
        }else{
            TwitterUser.register({username:req.body.username},req.body.password,function(err,user){
                if(err){
                    console.log(err);
                    res.send(err);
                }else{
                    passport.authenticate("local")(req,res,function(){
                        TwitterUser.findById(req.user.id).then(async function(data){
                            if(data){
                                data.displayName=displayName;
                                data.tweets=[];
                                data.dateofJoin=new Date().toLocaleDateString();
                                await data.save();
                                res.send({message:"Success"});
                            }
                        }).catch(function(err){
                            console.log(err);
                        })
                    })
                }
            });
        }
    }).catch(function(err){
        throw err;
    });
})

app.post('/login',function(req,res,next){
    const user=new TwitterUser({
        username:req.body.username,
        password:req.body.password
    })
    req.login(user,function(err){
        if(err){
            res.send({message:"Unauthorized"});
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.send({message:req.isAuthenticated()});
            });
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

app.post('/postTweet',function(req,res){
    if(req.isAuthenticated()){
        newPost=new Post({
            owner:req.user.id,
            displayName:req.body.displayName,
            username:req.user.username,
            content:req.body.content,
            imageLink:req.body.imageLink,
            date:new Date().toLocaleDateString(),
            likes:[]
        })
        newPost.save().then(function(post){
            var id=post._id;
            console.log(post.displayName)
            TwitterUser.findById(req.user.id).then(function(user){
                user.tweets.push(id);
                user.save().then(function(){
                    res.send({message:"Success"})
                })
            })
        })
    }else{
        res.send({message:"Denied"})
    }
})

app.post('/getPost',function(req,res){
    Post.findById(req.body.id).then(function(post){
        if(req.isAuthenticated()){
            var liked=post.likes.includes(req.user.id);
            var post_copy={
                _id:post._id,
                owner:post.owner,
                username:post.username,
                displayName:post.displayName,
                content:post.content,
                imageLink:post.imageLink,
                date:post.date,
                likes:post.likes.length,
                liked:liked
            }
            res.send(post_copy)
        }else{
            var post_copy={
                _id:post._id,
                owner:post.owner,
                username:post.username,
                displayName:post.displayName,
                content:post.content,
                imageLink:post.imageLink,
                date:post.date,
                likes:post.likes.length,
                liked:false
            }
            res.send(post_copy);
        }
        
    }).catch(function(err){
        console.log(err);
    })
});

app.get('/newPost',function(req,res){
    Post.find({},"_id").then(function(data){
        res.send(data);
    }).catch(function(err){
        res.send("Denied");
    })
});

app.get('/myPost',function(req,res){
    if(req.isAuthenticated()){
        Post.find({owner:req.user.id},"_id").then(function(data){
            res.send(data)
        }).catch(function(err){
            res.send(err)
        })
    }else{
        res.send("Denied")
    }
})

app.post('/likePost',function(req,res){
    var id=req.user.id;
    Post.findById(req.body.id).then(function(post){
        post.likes.push(id);
        post.save().then(function(){
            res.send({message:"Success"});
        })
    }).catch(function(err){
        res.send(err);
    })
})

app.post('/unlikePost',function(req,res){
    var id=req.user.id;
    Post.findById(req.body.id).then(function(post){
        post.likes = post.likes.filter(e => e !== id);
        post.save().then(function(){
            res.send({message:"Success"});
        })
    }).catch(function(err){
        res.send(err);
    })
})

app.post('/deletePost',function(req,res){
    var postId=req.body.id;
    Post.findByIdAndRemove(postId).then(function(post){
        var id=post.owner;
        TwitterUser.findById(id).then(function(user){
            user.tweets=user.tweets.filter(e => e !=postId);
            user.save().then(function(){
                res.send({message:"Success"});
            }).catch(function(err){
                res.send(err);
            })
        })
    })
});

function compareLikes(a, b) {

    return (a.likes.length) - (b.likes.length);
}

app.get('/popularPost',function(req,res){
    Post.find({},"_id likes").then(function(data){
        var data_copy=data;
        data_copy.sort(compareLikes);
        res.send(data_copy);
    }).catch(function(err){
        res.send("lol");
    }) 
})

app.listen(PORT,function(){
    console.log("Server started on port 8000");
})