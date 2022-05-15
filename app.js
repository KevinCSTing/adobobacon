//jshint esversion:6
/*************************************************************
Table of Contents
**************************************************************
1. Required Libraries
2. Global Declarations and App Settings
3. Database Connections and Models
3.1 Database pre-data
4. Public Routes
5. Admin Routes and REST APIs
5.1. View Recipe
5.2 Write Recipe
5.3 Update a Recipe
5.4 Delete Recipe
5.5 Search Recipe
6. Authentications and Security
7. Generic functions
8. ERROR Redirects
9. PORT LISTENER
**************************************************************/

/*************************************************************
1. Required Libraries
**************************************************************/
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { check, validationResult } = require('express-validator');
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const secure = require('ssl-express-www');

const path = require('path');


/*************************************************************
2. Global Declarations and App Settings
**************************************************************/
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.set('views',  [path.join(__dirname, 'views'),path.join(__dirname, 'views/admin')]);
app.use(express.static("public"));


  app.use(cookieParser());
  app.use(secure);

	app.use(session({
	  secret: process.env.SECRET,
	  resave: false,
	  saveUninitialized: true,

	}));

	//passport
	app.use(passport.initialize());
	app.use(passport.session());

  app.use(flash());



//Express Messages Middleware
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});


/*************************************************************
3. Database Connections and Models
**************************************************************/
//mongoose.connect("mongodb://localhost:27017/adoboBaconDB", {
mongoose.connect(`${process.env.DB_CONN_STRING}`, {
	useNewUrlParser: true,
	useFindAndModify: false,
	useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

//create schema for recipesDB
const recipeSchema = mongoose.Schema({
	title: String,
	postURL: String,
	imageUrl: String,
	postTags: [String],
	summary: String,
	content: String,
	postedOn: String

});

const Recipe = mongoose.model("Recipe", recipeSchema);


//Register table
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  isAdmin: Boolean
});


userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/*************************************************************
4. Database pre-data
**************************************************************/
let recipes=[];
const test1 = new Recipe({
		title: "Test 1",
		postURL: "test-1",
		imageUrl: "https://i.imgur.com/CGWX5LO.jpg",
		postTags: ['test', 'test-1'],
		summary:"A short description of what the dish is about",
		content: "This is just a test.",
		postedOn: "2020-09-12"
});

const test2 = new Recipe({
		title: "Test 2",
		postURL: "test-2",
		imageUrl: "https://i.imgur.com/CGWX5LO.jpg",
		postTags: ['test', 'test-2'],
		summary:"A short description of what the dish is about",
		content: "This is just a test.",
		postedOn: "2020-09-12"
});

const test3 = new Recipe({
		title: "Test 3",
		postURL: "test-3",
		imageUrl: "https://i.imgur.com/CGWX5LO.jpg",
		postTags: ['test', 'test-3'],
		summary:"A short description of what the dish is about",
		content: "This is just a test.",
		postedOn: "2020-09-12"
});

const defaultRecipes = [test1, test2, test3];

/*************************************************************
	4. Public Routes
**************************************************************/

app.get('/', function(req, res){

  Recipe.find({}, function(err, recipes){
		if(err){
			console.log(err);
		}
		else{
			res.render("home",{recipes: recipes });
		}
	}).limit(4).sort({ $natural: -1 });



});

app.get('/about', function(req, res){
  res.render('about');
});

app.get('/admin/write-recipes', function(req, res){

  //passport Authentications
  if(req.isAuthenticated()){
    res.render('admin/write-recipes');
  }else{
    res.redirect("/login");
  }
});


app.get('/admin/recipes-list', function(req, res){
//passport authentication
	if(req.isAuthenticated()){
		Recipe.find({}, function(err, foundItems){
			if(foundItems.length ===0){
				Recipe.insertMany(defaultRecipes, function(err){
					if(err){
						console.log(err);
					}else{
						console.log(defaultRecipes);
					console.log("Successfully saved default recipes");
					res.render('admin/recipes-list', { recipe:foundItems });
				}
				});
			} else{
				res.render('admin/recipes-list', { recipe:foundItems });
			}
		});
	}else{
		res.redirect("/login");
	}
});

app.get('/recipe/:title', function(req, res){
	let titleFromURL = req.params.title;

	Recipe.findOne({postURL:titleFromURL }, function(err, recipe){
		if(err){
			console.log(err);
		}else{
			res.render("recipe", {recipeDetail: recipe});
		}
	});

});

app.get('/tags/:tag', function(req, res){
	let contentTag = req.params.tag;

	Recipe.find({postTags: contentTag}, function(err, recipes){
		if(err){
			console.log(err);
		}
		else{
			res.render("tags",{tag: contentTag, recipes: recipes });
		}
	});
});

//Public recipes listing
app.get('/recipes', function(req, res){
	//res.render("recipes");

  Recipe.find({}, function(err, recipes){
		if(err){
			console.log(err);
		}
		else{
			res.render("recipes",{recipes: recipes });
		}
	}).limit(5).sort({ $natural: -1 });

});

/*************************************************************
5. Admin Routes and REST APIs

5.1. View Recipe
**************************************************************/
app.get('/admin/recipe/:title', function(req, res){
  if(req.isAuthenticated()){
    let titleFromURL = req.params.title;

    Recipe.findOne({postURL:titleFromURL }, function(err, recipe){
      if(err){
        console.log(err);
      }else{
        res.render("admin/recipe", {recipeDetail: recipe});
      }
    });
  }else{
    res.redirect("/login");
  }
});

/*************************************************************
Form Posts

5.2 Write Recipe
**************************************************************/
app.post('/write-recipes', function(req, res){
	//process postedOn Date
	let postedOnDate = getDateNow();

	//process Tags
	let tags = processTags(req.body.dishTags);

	//process post URL. eg Steak Dinner => steak-dinner
	let postURL = processPostURL(req.body.recipeTitle);

	const recipeObj = new Recipe({
		title: req.body.recipeTitle,
		postURL: postURL,
		imageUrl: req.body.recipeImageUrl,
		postTags: tags,
		summary: req.body.recipeSummary,
		content: req.body.recipeContent,
		postedOn: postedOnDate
	});

	recipeObj.save(function(err){
		if(!err){
			req.flash('info','New Recipe added successfully!');
		}
		else{
			req.flash(err);
		}
	});

	res.redirect("admin/recipes-list");

});

/*************************************************************
5.3 Update a Recipe
**************************************************************/
app.get('/admin/update-recipe/:postURL', function(req, res){
    if(req.isAuthenticated()){
      console.log("Recipe to update: " + req.params.postURL);

      const recipeURLToUpdate = req.params.postURL;

      	Recipe.find({postURL: recipeURLToUpdate}, function(err, foundItem){
      		if(err){
      			console.log("something went wrong: " + err);
      		}
      		else{
      			if(foundItem.length === 0){
      				res.redirect("admin/write-recipes");
      			}
      			else{
      				res.render("admin/update-recipe", {recipe:foundItem});
      			}
      		}
      	});
    }
    else{
      res.redirect("/login");
    }
});

app.post('/update-recipe', function(req, res){
	//same functionality at write-recipe
console.log(req.body);
const recipeIDToUpdate = req.body.submitBtn;
let postedOnDate = getDateNow();
let tags = processTags(req.body.dishTags);

const update ={
	title: req.body.dishTitle,
	postURL: req.body.postURL,
	imageUrl: req.body.dishLink,
	postTags: tags,
	summary: req.body.dishSummary,
	content: req.body.dishContent,
	postedOn: postedOnDate
}
Recipe.findOneAndUpdate({_id:recipeIDToUpdate}, update, function(err, results){
		if(err){
			console.log("error updating record: " + err);
		}
		else{
			req.flash('success','Recipe updated successfully!');
			res.redirect("admin/recipes-list");
		}
	});
});

/*************************************************************
5.4 Delete Recipe
**************************************************************/
app.post('/delete-recipe', function(req, res){

const recipeIDToDelete = req.body.recipeDeleteItem;
Recipe.findByIdAndRemove(recipeIDToDelete, function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log("successfully deleted recipe");
		res.redirect("admin/recipes-list");
	}
});


});

/*************************************************************
5.5 Search Recipe
**************************************************************/

app.get("/search", function(req, res){
	const query = req.query.q;
	console.log(query);
	Recipe.find({"$text" : {"$search":query}}, function(err, foundItems){
		if(err){
			console.log("something went wrong: " + err);
		}
		else{
			if(foundItems.length === 0){
					//res.send("no items found");
					res.render("search", {query: query, recipes:foundItems});
			}
			else{
				res.render("search", {query: query, recipes:foundItems});
			}
		}
	});
});


app.get("/admin-search", function(req, res){
  if(req.isAuthenticated()){
      const query = req.query.q;
      console.log(query);
      Recipe.find({"$text" : {"$search":query}}, function(err, foundItems){
        if(err){
          console.log("something went wrong: " + err);
        }
        else{
          if(foundItems.length === 0){
              //res.send("no items found");
              res.render("admin/search", {query: query, recipes:foundItems});
          }
          else{
            console.log(foundItems);
            res.render("admin/search", {query: query, recipes:foundItems});
          }
        }
      });
  }
  else{
    res.redirect("/login");
  }
});


/*************************************************************
6. Authentications and Security
**************************************************************/

app.get("/register", function(req, res){
	res.render("auth/register");
});

app.post("/register", function(req, res){
	User.register({username: req.body.username}, req.body.password, function(err, user){
		if(err){
			console.log(err);
			req.flash('error','Registration failed!');
			res.redirect("/register");
		}else{
			passport.authenticate("local")(req,res, function(){
				req.flash('info','Registered successfully!');
				res.redirect("admin/recipes-list");
			});
		}
	});
});

app.get("/login", function(req, res){
	res.render("auth/login");
});

app.post("/login", function(req, res){

	const user = new User({
			username: req.body.username,
			password: req.body.password
	});

	req.login(user, function(err){
		if(err){
			console.log(err);
		}
		else{
			passport.authenticate("local")(req, res, function(){
				req.flash('success','Welcome back!');
				res.redirect("admin/recipes-list");
			});
		}
	});
});

app.get("/logout", function(req, res){
	req.logout();
	res.redirect("/");
});

/*************************************************************
7. Generic functions
**************************************************************/
function getDateNow(){
var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var yyyy = today.getFullYear();

var month = new Array();
month[0] = "January";
month[1] = "February";
month[2] = "March";
month[3] = "April";
month[4] = "May";
month[5] = "June";
month[6] = "July";
month[7] = "August";
month[8] = "September";
month[9] = "October";
month[10] = "November";
month[11] = "December";
var mm = month[today.getMonth()];
today = mm + ' ' + dd + ', ' + yyyy;

return today;
}

function processTags(tags){
	let tagsArr = tags.split(",");
	let newTagsArr = tagsArr.map(str => str.trim());

	return newTagsArr;
}

function processPostURL(title){
	let postTitle = _.lowerCase(title);
	postTitle = _.replace(postTitle,new RegExp(" ","g"),'-');

	return postTitle;
}


/*************************************************************
8. ERROR Redirects
**************************************************************/


// 404
app.use(function(req, res, next) {
  return res.status(404).render('errors/404');
});

// 500 - Any server error
app.use(function(err, req, res, next) {
  return res.status(500).render('errors/500');
});


/*************************************************************
9. PORT LISTENER
**************************************************************/

//run on both local and heroku
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server started successfully on port: " + port);
});
