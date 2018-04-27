//Frameworks and Libraries
var express         = require("express");
var mysql           = require("mysql");
var passport        = require("passport");
var LocalStrategy   = require("passport-local").Strategy;
var bodyParser      = require("body-parser");
var crypto          = require("crypto");
var session         = require("express-session");

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

//==================================================================================
//LOGIN AUTHENTICATION
//==================================================================================
app.use(session({
    secret: "Hertfordshire University",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//Passport Login
passport.use('local-login', new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true
    },
    function(req, email, password, done) { // Callback with email and password

        var salt = 'b5y7s9j83yf537gkb8tu2ic6b5vk4ue8au8cysy4';

        db.query("SELECT * FROM account WHERE email = '" + email + "'",function(err,rows) {
            if (err)
                return done(err);
            if (!rows.length) {
                return done(null, false, console.log("Wrong Email"));
            }

            salt = salt + '' + password;
            var encPassword = crypto.createHash('sha1').update(salt).digest('hex');
            var dbPassword = rows[0].password;

            // Wrong Password
            if (!(dbPassword == encPassword)) {
                return done(null, false, console.log("Wrong Password"));
            }

            // Password Correct
            var user_id = [rows[0].userID, rows[0].fName, rows[0].adminID];
            return done(null, user_id);
            });
}));

// Serialize User
passport.serializeUser(function(user_id, done) {
    done(null, user_id);
});

// Deserialize User
passport.deserializeUser(function(user_id, done) {
    done(null, user_id);
});

//Check Login Details
app.post("/", passport.authenticate('local-login', {
    successRedirect: '/admin/home',
    failureRedirect: '/'
}));

// Logout user
app.get('/logout', function (req, res){
    req.session.destroy(function (err) {
        res.redirect('/');
    });
});

//==================================================================================
// FUNCTIONS FOR AUTHENTICATION AND AUTHORIZATION
//==================================================================================

// Check Authentication
function isAuthenticated(req, res, next) {

    if (req.isAuthenticated()) {
    return next();
    }
    res.redirect('/');

}

//Check if User is Admin
function isAdmin(req, res, next){
    if (req.isAuthenticated()) {
        var adminID = req.user[2];
        if (adminID === 1) {
            return next();
        }
        else {
            console.log("You are a Standard User");
            res.redirect('/user');
            }
        }
    else{res.redirect('/');}
}

//==================================================================================
// ROUTES
//==================================================================================

// Get Homepage / Login
app.get("/", function(req, res){
    res.render("login")
});

//==================================================================================
// AUTHENTICATED ROUTES
//==================================================================================

// Get User Homepage
app.get("/user", isAuthenticated, function(req, res) {
    res.render("user/index", {userFName: req.user[1]});
});

// Get Customer Page
app.get("/customers", isAuthenticated, function(req, res, next) {
    db.query("SELECT * FROM customer", function(err, customers) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("user/customers", {customers:customers, userFName: req.user[1]});
        }
    });
});

// Get Stock Page
app.get("/stock", isAuthenticated, function(req, res) {
    res.render("user/stock", {userFName: req.user[1]});
});

// Get Invoice Page
app.get("/invoices", isAuthenticated, function(req, res) {
    res.render("user/invoices", {userFName: req.user[1]});
});

// Get Credit Note Page
app.get("/creditnotes", isAuthenticated, function(req, res) {
    res.render("user/credit_notes", {userFName: req.user[1]});
});

// Get Offers Page
app.get("/offers", isAuthenticated, function(req, res) {
    res.render("user/offers", {userFName: req.user[1]});
});

// Get Reports Page
app.get("/reports", isAuthenticated, function(req, res) {
    res.render("user/reports", {userFName: req.user[1]});
});

//==================================================================================
//ADMIN PAGES
//==================================================================================

//Requires Admin for all Admin Pages
app.all('/admin/*', isAdmin);

// Get Admin Homepage
app.get("/admin/home", function(req, res) {
    res.render("admin/index", {userFName: req.user[1]});
});

// Get Customer Page
app.get("/admin/customers", function(req, res) {
    db.query("SELECT * FROM customer", function(err, customers) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/customers", {customers:customers, userFName: req.user[1]});
        }
    });
});

// Get New Customer Form Page
app.get("/admin/customers/new", function(req, res){
    res.render("admin/newcustomer.ejs", {userFName: req.user[1]});
});

// New Customer Post Request
app.post("/admin/customers", function(req, res){
    var query =     "INSERT INTO customer (";
    query +=        "customerBusiness, customerAddress1, customerAddress2,";
    query +=        " customerAddress3, customerCountry, customerNumber,";
    query +=        " customerVAT, customerEmail, customerEmailCC, customerPhone)";
    query +=        " VALUES ('"+req.body.customerBusiness+"', '"+req.body.customerAddress1+"'";
    query +=        ", '"+req.body.customerAddress2+"', '"+req.body.customerAddress3+"'";
    query +=        ", '"+req.body.customerCountry+"', '"+req.body.customerNumber+"'";
    query +=        ", '"+req.body.customerVAT+"', '"+req.body.customerEmail+"'";
    query +=        ", '"+req.body.customerEmailCC+"', '"+req.body.customerPhone+"')"

    console.log(query);
    db.query(query, function(err,result){
        console.log("Customer Added");
        res.redirect("/admin/customers");
    })
});

// Edit Customer Page
app.get("/admin/customers/edit/:id", function(req,res){
    db.query("SELECT * FROM customer WHERE customerID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Customer");
            res.redirect("/admin/customers")
    }
        if(rows.length <= 0){
            console.log("Failed to Find Customer");
            res.redirect("/admin/customers")
        }
        else{
            res.render("admin/editcustomer", {
                customerID:rows[0].customerID,
                customerBusiness:rows[0].customerBusiness,
                customerAddress1:rows[0].customerAddress1,
                customerAddress2:rows[0].customerAddress2,
                customerAddress3:rows[0].customerAddress3,
                customerCountry:rows[0].customerCountry,
                customerNumber:rows[0].customerNumber,
                customerVAT:rows[0].customerVAT,
                customerEmail:rows[0].customerEmail,
                customerEmailCC:rows[0].customerEmailCC,
                customerPhone:rows[0].customerPhone,
                userFName: req.user[1]
            })
        }
    })
});

// Update Customer
app.post("/admin/customers/edit", function(req, res){
        var query =         "UPDATE customer SET";
            query +=        " customerBusiness = '"+req.body.customerBusiness+"',";
            query +=        " customerAddress1 = '"+req.body.customerAddress1+"',";
            query +=        " customerAddress2 = '"+req.body.customerAddress2+"',";
            query +=        " customerAddress3 = '"+req.body.customerAddress3+"',";
            query +=        " customerCountry = '"+req.body.customerCountry+"',";
            query +=        " customerNumber = '"+req.body.customerNumber+"',";
            query +=        " customerVAT = '"+req.body.customerVAT+"',";
            query +=        " customerEmail = '"+req.body.customerEmail+"',";
            query +=        " customerEmailCC = '"+req.body.customerEmailCC+"',";
            query +=        " customerPhone = '"+req.body.customerPhone+"'";
            query +=        " WHERE customerID = "+req.body.customerID+"";

        db.query(query, function(err,result){
            console.log("Customer Updated");
            res.redirect("/admin/customers");
        })
});

// Get Stock Page
app.get("/admin/stock", function(req, res) {
    db.query("SELECT * FROM stock JOIN product ON stock.stock_productID = productID JOIN currency ON stock.stock_currencyID = currencyID JOIN customer ON stock.stock_customerID = customerID", function (err, stock) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("admin/stock.ejs", {stock:stock, userFName: req.user[1]});
        }
    })
});


// Get New Stock Page
app.get("/admin/stock/new", function(req, res){
    db.query("SELECT * FROM product", function(err, product){
        db.query("SELECT * FROM customer", function(err, customer){
            db.query("SELECT * FROM currency", function(err, currency){
                res.render("admin/newstock.ejs", {product:product, customer:customer, currency:currency, userFName: req.user[1]});
            })
        })
    });
});

// New Stock Post Request
app.post("/admin/stock", function(req, res){
    var query =     "INSERT INTO stock (";
    query +=        "quantityStockBought, quantityStockCurrent, priceBought,";
    query +=        " stock_customerID, stock_currencyID, stock_productID,";
    query +=        " boughtDate) VALUES ('"+req.body.quantityStockBought+"',";
    query +=        " '"+req.body.quantityStockBought+"', '"+req.body.priceBought+"',";
    query +=        " '"+req.body.stock_customerID+"', '"+req.body.stock_currencyID+"',";
    query +=        " '"+req.body.stock_productID+"', '"+req.body.boughtDate+"')";

    console.log(query);
    db.query(query, function(err,result){
        console.log("Stock Added");
        res.redirect("/admin/stock");
    })
});

// Edit Stock Page
app.get("/admin/stock/edit/:id", function(req,res){
    db.query("SELECT * FROM stock WHERE stockID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Stock");
            res.redirect("/admin/stock")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Stock");
            res.redirect("/admin/stock")
        }
        else{
            db.query("SELECT * FROM product", function(err, product) {
                db.query("SELECT * FROM customer", function (err, customer) {
                    db.query("SELECT * FROM currency", function (err, currency) {
                        res.render("admin/editstock", {
                            product: product,
                            customer: customer,
                            currency: currency,
                            stockID: rows[0].stockID,
                            stock_productID: rows[0].stock_productID,
                            quantityStockCurrent: rows[0].quantityStockCurrent,
                            stock_currencyID: rows[0].stock_currencyID,
                            priceBought: rows[0].priceBought,
                            stock_customerID: rows[0].stock_customerID,
                            boughtDate: rows[0].boughtDate,
                            userFName: req.user[1]
                        })
                    })
                })
            })
        }
    })
});

// Update Stock
app.post("/admin/stock/edit", function(req, res){
    var query =         "UPDATE stock SET";
    query +=        " stock_productID = '"+req.body.stock_productID+"',";
    query +=        " quantityStockCurrent = '"+req.body.quantityStockCurrent+"',";
    query +=        " stock_currencyID = '"+req.body.stock_currencyID+"',";
    query +=        " priceBought = '"+req.body.priceBought+"',";
    query +=        " stock_customerID = '"+req.body.stock_customerID+"',";
    query +=        " boughtDate = '"+req.body.boughtDate+"'";
    query +=        " WHERE stockID = "+req.body.stockID+"";

    db.query(query, function(err,result){
        console.log(query);
        res.redirect("/admin/stock");
    })
});

// Get Invoice Page
app.get("/admin/invoices", function(req, res) {
    res.render("admin/invoices", {userFName: req.user[1]});
});

// Get Credit Note Page
app.get("/admin/creditnotes", function(req, res) {
    res.render("admin/credit_notes", {userFName: req.user[1]});
});

// Get Offers Page
app.get("/admin/offers", function(req, res) {
    res.render("admin/offers", {userFName: req.user[1]});
});

// Get Reports Page
app.get("/admin/reports", function(req, res) {
    res.render("admin/reports", {userFName: req.user[1]});
});

// Get Users Page
app.get("/admin/users", function(req, res) {
    res.render("admin/users", {userFName: req.user[1]});
});

// Create New User
app.get("/admin/users/new", function(req, res) {
    res.render("admin/newuser", {userFName: req.user[1]});
});

// Handle New User
app.post("/admin/users", function(req,res){
    res.send()
});

// Get Currencies Page
app.get("/admin/currencies", function(req, res) {
    res.render("admin/currencies", {userFName: req.user[1]});
});

// Get Products Page
app.get("/admin/products", function(req, res) {
    res.render("admin/products", {userFName: req.user[1]});
});

// Get Positions Page
app.get("/admin/positions", function(req, res) {
    res.render("admin/positions", {userFName: req.user[1]});
});

//==================================================================================
//Start Server
//==================================================================================

// Start Server on Port 3000
app.listen(3000, process.env.IP, function(){
    console.log("The Server Has Started.");
});