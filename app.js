//Frameworks and Libraries
var express = require("express");
var app = express();
var bodyParser = require("body-parser")

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

var customers = [
    {name: "Brad", town: "hitchin"},
    {name: "Dan", town: "hitchin"},
    {name: "John", town: "luton"}
];

//Homepage / Login
app.get("/", function(req, res){
    res.render("login")
});

// User Homepage
app.get("/user", function(req, res) {
    res.render("user/index", {customers:customers});
});

//Customer Page
app.get("/customers", function(req, res) {
    res.render("user/customers", {customers:customers});
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

//New Customer Form Page
app.get("/customers/new", function(req, res){
    res.render("user/newcustomer.ejs");
});

//Start Server on Port 3000
app.listen(3000, process.env.IP, function(){
    console.log("The Server Has Started.");
});