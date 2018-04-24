//Frameworks and Libraries
var express         = require("express");
var mysql           = require("mysql");
var passport        = require("passport");
var LocalStrategy   = require('passport-local').Strategy;
var bodyParser      = require("body-parser");

var db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "stock-system"
});

db.connect(function(err){
    if(err){
        console.log("Error with Database Connection");
    } else{
        console.log("Database is Connected\n");
    }
});

var app = express();
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

app.use(require("express-session")({
    secret: "Hertfordshire University",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


// Serialize User
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

// Deserialize Use
passport.deserializeUser(function(id, done) {
    db.query("SELECT * FROM account WHERE userID = "+id,function(err,rows){
        done(err, rows[0]);
    });
});

//Passport Login
passport.use('local-login', new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true
    },
    function(req, email, password, done) { // Callback with email and password

        db.query("SELECT * FROM `account` WHERE `email` = '" + email + "'",function(err,rows){
            if (err)
                return done(err);
            if (!rows.length) {
                return done(null, false, req.flash('loginMessage', 'No user found.'));
            }

            // Wrong Password
            if (!( rows[0].password === password))
                return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.'));

            // Password Correct
            return done(null, rows[0]);

        });
}));

//==========
// ROUTES
//==========

// Get Homepage / Login
app.get("/", function(req, res){
    res.render("login")
});

// AUTHENTICATION ROUTES

// Get User Homepage
app.get("/user", function(req, res) {
    res.render("user/index");
});

// Get Customer Page
app.get("/customers", function(req, res) {
    db.query("SELECT * FROM customer", function(err, customers) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("user/customers", {customers:customers});
        }
    });
});


// Get New Customer Form Page
app.get("/customers/new", function(req, res){
    res.render("user/newcustomer.ejs");
});

// New Customer Post Request
app.post("/customers", function(req, res){
    var name = req.body.name;
    var town = req.body.town;
    var newCustomer = {name: name, town: town};
    customers.push(newCustomer);

    //Redirect back to customers page
    res.redirect("/customers");
});


// Get Stock Page
app.get("/stock", function(req, res) {
    res.render("user/stock");
});

// Get Invoice Page
app.get("/invoices", function(req, res) {
    res.render("user/invoices");
});

// Get Credit Note Page
app.get("/creditnotes", function(req, res) {
    res.render("user/credit_notes");
});

// Get Offers Page
app.get("/offers", function(req, res) {
    res.render("user/offers");
});

// Get Reports Page
app.get("/reports", function(req, res) {
    res.render("user/reports");
});

//================
//Admin Pages
//================

// Get Admin Homepage
app.get("/admin", function(req, res) {
    res.render("admin/index");
});

// Create New User
app.get("/admin/users/new", function(req, res) {
    res.render("admin/newuser");
});

// Start Server on Port 3000
app.listen(3000, process.env.IP, function(){
    console.log("The Server Has Started.");
});