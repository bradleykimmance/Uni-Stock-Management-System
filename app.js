var express = require("express");
var app = express();

app.set("view engine", "ejs");

app.get("/", function(req, res){
    res.render("login")
});

app.get("/user", function(req, res){
    var users = [
        {name: "Brad", town: "hitchin"},
        {name: "Dan", town: "hitchin"},
        {name: "John", town: "luton"}
    ]

    res.render("user/index", {users:users});
});

app.listen(3000, process.env.IP, function(){
    console.log("The Server Has Started.");
});