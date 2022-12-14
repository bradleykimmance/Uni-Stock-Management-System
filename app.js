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
            var user_id = [rows[0].userID, rows[0].fName, rows[0].lName, rows[0].adminID];
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
        var adminID = req.user[3];
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
    db.query("SELECT * FROM invoice JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID JOIN currency ON invoice.invoice_currencyID = currencyID JOIN account ON invoice.invoice_userID = userID WHERE invoice_userID ="+req.user[0]+ "", function(err,invoice){
        db.query("SELECT * FROM credit_note JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID JOIN currency ON credit_note.credit_currencyID = currencyID JOIN account ON credit_note.credit_userID = userID WHERE credit_userID ="+req.user[0]+ "", function(err,credit_note){
            db.query("SELECT * FROM stock JOIN currency ON stock.stock_currencyID = currencyID", function(err, stock) {
                res.render("user/index", {
                    invoice: invoice,
                    credit_note: credit_note,
                    stock:stock,
                    userFName: req.user[1],
                    userLName: req.user[2]
                });
            })
        })
    })
});

// Get Customer Page
app.get("/customers", isAuthenticated, function(req, res, next) {
    db.query("SELECT * FROM customer", function(err, customers) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("user/customers", {customers:customers, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Get Stock Page
app.get("/stock", isAuthenticated, function(req, res) {
    db.query("SELECT * FROM stock JOIN product ON stock.stock_productID = productID JOIN currency ON stock.stock_currencyID = currencyID JOIN customer ON stock.stock_customerID = customerID WHERE stock.quantityStockCurrent > 0", function (err, stock) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("user/stock.ejs", {stock:stock, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get Invoice Page
app.get("/invoices", isAuthenticated, function(req, res) {
    var query =     "SELECT * FROM invoice JOIN account ON invoice.invoice_userID = userID JOIN currency ON invoice.invoice_currencyID = currencyID";
    query +=    " JOIN customer ON invoice.invoice_customerID = customerID JOIN vat ON invoice.invoice_vatID = vatID";
    query +=    " JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID";
    query +=    " JOIN product ON stock.stock_productID = productID WHERE invoice.invoice_userID = "+req.user[0]+"";

    db.query(query, function (err, invoice) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("user/invoices.ejs", {invoice:invoice, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get New Invoice Page
app.get("/invoices/new", function(req, res){
    db.query("SELECT * FROM customer", function(err, customer){
        db.query("SELECT * FROM vat", function(err, vat){
            db.query("SELECT * FROM stock JOIN product ON stock_productID = productID WHERE quantityStockCurrent > 0", function(err, stock){
                db.query("SELECT * FROM currency", function(err, currency) {
                    db.query("SELECT * FROM invoice ORDER BY invoiceNo DESC LIMIT 1", function(err, lastInvoice) {
                        res.render("user/newinvoice.ejs", {
                            vat: vat,
                            customer: customer,
                            currency: currency,
                            stock: stock,
                            lastInvoice: lastInvoice[0].invoiceNo,
                            userID: req.user[0],
                            userFName: req.user[1],
                            userLName: req.user[2]
                        });
                    })
                })
            })
        })
    });
});

// New Invoice Post Request
app.post("/invoices", function(req, res){
    var lastInvoiceNo = Number(req.body.last_invoiceNo) + 1;
    var query =     "INSERT INTO invoice (";
    query +=        "invoice_customerID, invoice_userID, saleVoid, invoiceDate,";
    query +=        " invoiceDueDate, invoice_vatID, invoiceAdjustments, invoice_currencyID)";
    query +=        " VALUES ('"+req.body.invoice_customerID+"', '"+req.body.invoice_userID+"',";
    query +=        " '"+req.body.saleVoid+"', '"+req.body.invoiceDate+"',";
    query +=        " '"+req.body.invoiceDueDate+"', '"+req.body.invoice_vatID+"',";
    query +=        " '"+req.body.invoiceAdjustments+"', '"+req.body.invoice_currencyID+"')";

    db.query(query, function(err,result){
        if(req.body.invoice_stockQty2 < 1) {
            var query2 = "INSERT INTO invoice_stock (";
            query2 += "join_invoiceNo, join_stockID, stockQuantity, priceSold)";
            query2 += " VALUES ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID1 + "',";
            query2 += " '" + req.body.invoice_stockQty1 + "', '" + req.body.invoice_stockPrice1 + "')";

            db.query(query2, function(err,result) {
                var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                query3 +=    "'"+req.body.invoice_stockQty1+"' WHERE stockID = '"+req.body.invoice_stockID1+"'";

                db.query(query3, function(err, result) {
                    console.log("Invoice Added");
                    res.redirect("/invoices");
                })
            })
        }else{
            var query2 = "INSERT INTO invoice_stock (";
            query2 += "join_invoiceNo, join_stockID, stockQuantity, priceSold)";
            query2 += " VALUES ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID1 + "',";
            query2 += " '" + req.body.invoice_stockQty1 + "', '" + req.body.invoice_stockPrice1 + "'),";
            query2 += " ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID2 + "',";
            query2 += " '" +req.body.invoice_stockQty2+ "', '" + req.body.invoice_stockPrice2 + "')";

            console.log(query2);
            db.query(query2, function(err,result) {
                var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                query3 +=    "'"+req.body.invoice_stockQty1+"' WHERE stockID = '"+req.body.invoice_stockID1+"'";

                db.query(query3, function(err, result) {
                    var query4 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                    query4 +=    "'"+req.body.invoice_stockQty2+"' WHERE stockID = '"+req.body.invoice_stockID2+"'";

                    db.query(query4, function(err, result) {
                        console.log("Invoice Added");
                        res.redirect("/invoices");
                    })
                })
            })
        }
    })
});

// Get Credit Note Page
app.get("/creditnotes", isAuthenticated, function(req, res) {
    var query = "SELECT * FROM credit_note JOIN account ON credit_note.credit_userID = userID JOIN currency ON credit_note.credit_currencyID = currencyID";
    query +=    " JOIN customer ON credit_note.credit_customerID = customerID JOIN vat ON credit_note.credit_vatID = vatID";
    query +=    " JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID";
    query +=    " JOIN product ON stock.stock_productID = productID WHERE credit_note.credit_userID = "+req.user[0]+"";

    db.query(query, function (err, credit_note) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("user/credit_notes.ejs", {credit_note:credit_note, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get New Credit Notes Page
app.get("/creditnotes/new", function(req, res){
    db.query("SELECT * FROM customer", function(err, customer){
        db.query("SELECT * FROM vat", function(err, vat){
            db.query("SELECT * FROM stock JOIN product ON stock_productID = productID", function(err, stock){
                db.query("SELECT * FROM currency", function(err, currency) {
                    db.query("SELECT * FROM credit_note ORDER BY creditNo DESC LIMIT 1", function(err, lastCredit) {
                        res.render("user/newcreditnote.ejs", {
                            vat: vat,
                            customer: customer,
                            currency: currency,
                            stock: stock,
                            lastCredit: lastCredit[0].creditNo,
                            userID: req.user[0],
                            userFName: req.user[1],
                            userLName: req.user[2]
                        });
                    })
                })
            })
        })
    });
});

// New Credit Note Post Request
app.post("/creditnotes", function(req, res){
    var lastCreditNo = Number(req.body.last_creditNo) + 1;
    var query =     "INSERT INTO credit_note (";
    query +=        "credit_customerID, credit_userID, creditDate,";
    query +=        " creditDueDate, credit_vatID, creditAdjustments, credit_currencyID)";
    query +=        " VALUES ('"+req.body.credit_customerID+"', '"+req.body.credit_userID+"',";
    query +=        " '"+req.body.creditDate+"',";
    query +=        " '"+req.body.creditDueDate+"', '"+req.body.credit_vatID+"',";
    query +=        " '"+req.body.creditAdjustments+"', '"+req.body.credit_currencyID+"')";

    db.query(query, function(err,result) {
        var query2 = "INSERT INTO credit_stock (";
        query2 += "join_creditNo, join_stockID, stockQuantity, priceCredit)";
        query2 += " VALUES ('" + lastCreditNo + "', '" + req.body.credit_stockID + "',";
        query2 += " '" + req.body.credit_stockQty + "', '" + req.body.credit_stockPrice + "')";

        db.query(query2, function (err, result) {
            var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent + ";
            query3 += "'" + req.body.credit_stockQty + "' WHERE stockID = '" + req.body.credit_stockID + "'";

            db.query(query3, function (err, result) {
                console.log("Credit Note Added");
                res.redirect("/creditnotes");
            })
        })
    });
});

// Get Offers Page
app.get("/offers", isAuthenticated, function(req, res) {
    db.query("SELECT * FROM offer JOIN product ON offer.offer_productID = productID JOIN currency ON offer.offer_currencyID = currencyID JOIN customer ON offer.offer_customerID = customerID", function (err, offer) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("user/offers.ejs", {offer:offer, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get Reports Page
app.get("/reports", isAuthenticated, function(req, res) {
    db.query("SELECT * FROM invoice JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID JOIN currency ON invoice.invoice_currencyID = currencyID JOIN account ON invoice.invoice_userID = userID WHERE invoice_userID ="+req.user[0]+ "", function(err,invoice){
        db.query("SELECT * FROM credit_note JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID JOIN currency ON credit_note.credit_currencyID = currencyID JOIN account ON credit_note.credit_userID = userID WHERE credit_userID ="+req.user[0]+ "", function(err,credit_note){
            db.query("SELECT * FROM stock JOIN currency ON stock.stock_currencyID = currencyID", function(err, stock) {
                res.render("user/reports", {
                    invoice: invoice,
                    credit_note: credit_note,
                    stock:stock,
                    userFName: req.user[1],
                    userLName: req.user[2]
                });
            })
        })
    })
});

//==================================================================================
//ADMIN PAGES
//==================================================================================

//Requires Admin for all Admin Pages
app.all('/admin/*', isAdmin);

// Get Admin Homepage
app.get("/admin/home", function(req, res) {
    db.query("SELECT * FROM invoice JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID JOIN currency ON invoice.invoice_currencyID = currencyID JOIN account ON invoice.invoice_userID = userID", function(err,invoice){
        db.query("SELECT * FROM credit_note JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID JOIN currency ON credit_note.credit_currencyID = currencyID JOIN account ON credit_note.credit_userID = userID", function(err,credit_note){
            db.query("SELECT * FROM stock JOIN currency ON stock.stock_currencyID = currencyID", function(err, stock) {
                res.render("admin/index", {
                    invoice: invoice,
                    credit_note: credit_note,
                    stock:stock,
                    userFName: req.user[1],
                    userLName: req.user[2]
                });
            })
        })
    })
});

// Get Customer Page
app.get("/admin/customers", function(req, res) {
    db.query("SELECT * FROM customer", function(err, customers) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/customers", {customers:customers, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Get New Customer Form Page
app.get("/admin/customers/new", function(req, res){
    res.render("admin/newcustomer.ejs", {userFName: req.user[1],userLName: req.user[2]});
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
    query +=        ", '"+req.body.customerEmailCC+"', '"+req.body.customerPhone+"')";

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
                userFName: req.user[1],
                userLName: req.user[2]
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
            res.render("admin/stock.ejs", {stock:stock, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});


// Get New Stock Page
app.get("/admin/stock/new", function(req, res){
    db.query("SELECT * FROM product", function(err, product){
        db.query("SELECT * FROM customer", function(err, customer){
            db.query("SELECT * FROM currency", function(err, currency){
                res.render("admin/newstock.ejs", {product:product, customer:customer, currency:currency, userFName: req.user[1],userLName: req.user[2]});
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
                            userFName: req.user[1],
                            userLName: req.user[2]
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
        res.redirect("/admin/stock");
    })
});

// Get Invoice Page
app.get("/admin/invoices", function(req, res) {
    var query =     "SELECT * FROM invoice JOIN account ON invoice.invoice_userID = userID JOIN currency ON invoice.invoice_currencyID = currencyID";
        query +=    " JOIN customer ON invoice.invoice_customerID = customerID JOIN vat ON invoice.invoice_vatID = vatID";
        query +=    " JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID";
        query +=    " JOIN product ON stock.stock_productID = productID ORDER BY invoice.invoiceNo DESC";

    db.query(query, function (err, invoice) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("admin/invoices.ejs", {invoice:invoice, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get New Invoice Page
app.get("/admin/invoices/new", function(req, res){
    db.query("SELECT * FROM customer", function(err, customer){
        db.query("SELECT * FROM vat", function(err, vat){
            db.query("SELECT * FROM stock JOIN product ON stock_productID = productID WHERE quantityStockCurrent > 0", function(err, stock){
                db.query("SELECT * FROM currency", function(err, currency) {
                    db.query("SELECT * FROM invoice ORDER BY invoiceNo DESC LIMIT 1", function(err, lastInvoice) {
                        res.render("admin/newinvoice.ejs", {
                            vat: vat,
                            customer: customer,
                            currency: currency,
                            stock: stock,
                            lastInvoice: lastInvoice[0].invoiceNo,
                            userID: req.user[0],
                            userFName: req.user[1],
                            userLName: req.user[2]
                        });
                    })
                })
            })
        })
    });
});

// New Invoice Post Request
app.post("/admin/invoices", function(req, res){
    var lastInvoiceNo = Number(req.body.last_invoiceNo) + 1;
    var query =     "INSERT INTO invoice (";
    query +=        "invoice_customerID, invoice_userID, saleVoid, invoiceDate,";
    query +=        " invoiceDueDate, invoice_vatID, invoiceAdjustments, invoice_currencyID)";
    query +=        " VALUES ('"+req.body.invoice_customerID+"', '"+req.body.invoice_userID+"',";
    query +=        " '"+req.body.saleVoid+"', '"+req.body.invoiceDate+"',";
    query +=        " '"+req.body.invoiceDueDate+"', '"+req.body.invoice_vatID+"',";
    query +=        " '"+req.body.invoiceAdjustments+"', '"+req.body.invoice_currencyID+"')";

    db.query(query, function(err,result){
        if(req.body.invoice_stockQty2 < 1) {
            var query2 = "INSERT INTO invoice_stock (";
            query2 += "join_invoiceNo, join_stockID, stockQuantity, priceSold)";
            query2 += " VALUES ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID1 + "',";
            query2 += " '" + req.body.invoice_stockQty1 + "', '" + req.body.invoice_stockPrice1 + "')";

            db.query(query2, function(err,result) {
                var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                query3 +=    "'"+req.body.invoice_stockQty1+"' WHERE stockID = '"+req.body.invoice_stockID1+"'";

                db.query(query3, function(err, result) {
                    console.log("Invoice Added");
                    res.redirect("/admin/invoices");
                })
            })
        }else{
            var query2 = "INSERT INTO invoice_stock (";
            query2 += "join_invoiceNo, join_stockID, stockQuantity, priceSold)";
            query2 += " VALUES ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID1 + "',";
            query2 += " '" + req.body.invoice_stockQty1 + "', '" + req.body.invoice_stockPrice1 + "'),";
            query2 += " ('" +lastInvoiceNo+ "', '" + req.body.invoice_stockID2 + "',";
            query2 += " '" +req.body.invoice_stockQty2+ "', '" + req.body.invoice_stockPrice2 + "')";

            db.query(query2, function(err,result) {
                var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                query3 +=    "'"+req.body.invoice_stockQty1+"' WHERE stockID = '"+req.body.invoice_stockID1+"'";

                db.query(query3, function(err, result) {
                    var query4 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent - ";
                    query4 +=    "'"+req.body.invoice_stockQty2+"' WHERE stockID = '"+req.body.invoice_stockID2+"'";

                    db.query(query4, function(err, result) {
                        console.log("Invoice Added");
                        res.redirect("/admin/invoices");
                    })
                })
            })
        }
    })
});

// Edit Invoice Page
app.get("/admin/invoices/edit/:id", function(req,res){
    db.query("SELECT * FROM invoice WHERE invoiceNo = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Invoice");
            res.redirect("/admin/stock")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Invoice");
            res.redirect("/admin/stock")
        }
        else{
            db.query("SELECT * FROM customer", function(err, customer){
                db.query("SELECT * FROM vat", function(err, vat){
                    db.query("SELECT * FROM stock JOIN product ON stock_productID = productID WHERE quantityStockCurrent > 0", function(err, stock){
                        db.query("SELECT * FROM currency", function(err, currency) {
                            db.query("SELECT * FROM invoice_stock WHERE join_invoiceNo = "+req.params.id, function(err, invoice_stock) {
                                res.render("admin/editinvoice.ejs", {
                                    vat: vat,
                                    customer: customer,
                                    currency: currency,
                                    stock: stock,
                                    invoice: rows[0],
                                    invoice_stock: invoice_stock,
                                    userID: req.user[0],
                                    userFName: req.user[1],
                                    userLName: req.user[2]
                                })
                            })
                        })
                    })
                })
            })
        }
    })
});

// Update Invoice
app.post("/admin/invoices/edit", function(req, res){
    var query =     "UPDATE invoice SET ";
    query +=        " invoice_customerID = '"+req.body.invoice_customerID+"',";
    query +=        " saleVoid = '"+req.body.saleVoid+"',";
    query +=        " invoiceDate = '"+req.body.invoiceDate+"',";
    query +=        " invoiceDueDate = '"+req.body.invoiceDueDate+"',";
    query +=        " invoice_vatID = '"+req.body.invoice_vatID+"',";
    query +=        " invoiceAdjustments = '"+req.body.invoiceAdjustments+"'";
    query +=        " invoice_currencyID = '"+req.body.invoice_currencyID+"'";
    query +=        " WHERE invoiceNo = "+req.body.invoiceNo+"";

    db.query(query, function(err,result){
        if(req.body.invoice_stockQty2 === null) {
            var query2 =     "UPDATE invoice_stock SET ";
            query2 +=        " stockQuantity = '"+req.body.invoice_stockQty1+"',";
            query2 +=        " priceSold = '"+req.body.invoice_stockPrice1+"'";
            query2 +=        " WHERE join_invoiceNo = "+req.body.invoiceNo+" and join_stockID = "+req.body.invoice_stockID1;

            db.query(query2, function(err,result) {
                    console.log("Invoice Updated");
                    res.redirect("/admin/invoices");
            })
        }else{
            var query2 =     "UPDATE invoice_stock SET ";
            query2 +=        " stockQuantity = '"+req.body.invoice_stockQty1+"',";
            query2 +=        " priceSold = '"+req.body.invoice_stockPrice1+"'";
            query2 +=        " WHERE join_invoiceNo = "+req.body.invoiceNo+" and join_stockID = "+req.body.invoice_stockID1;

            db.query(query2, function(err,result) {
                var query3 =     "UPDATE invoice_stock SET ";
                query3 +=        " stockQuantity = '"+req.body.invoice_stockQty2+"',";
                query3 +=        " priceSold = '"+req.body.invoice_stockPrice2+"'";
                query3 +=        " WHERE join_invoiceNo = "+req.body.invoiceNo+" and join_stockID = "+req.body.invoice_stockID2;

                db.query(query3, function(err, result) {
                        console.log("Invoice Updated");
                        res.redirect("/admin/invoices");
                })
            })
        }
    })
});
// Get Credit Note Page
app.get("/admin/creditnotes", function(req, res) {
    var query = "SELECT * FROM credit_note JOIN account ON credit_note.credit_userID = userID JOIN currency ON credit_note.credit_currencyID = currencyID";
    query +=    " JOIN customer ON credit_note.credit_customerID = customerID JOIN vat ON credit_note.credit_vatID = vatID";
    query +=    " JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID";
    query +=    " JOIN product ON stock.stock_productID = productID ORDER BY credit_note.creditNo DESC";

    db.query(query, function (err, credit_note) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("admin/credit_notes.ejs", {credit_note:credit_note, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get New Credit Notes Page
app.get("/admin/creditnotes/new", function(req, res){
    db.query("SELECT * FROM customer", function(err, customer){
        db.query("SELECT * FROM vat", function(err, vat){
            db.query("SELECT * FROM stock JOIN product ON stock_productID = productID", function(err, stock){
                db.query("SELECT * FROM currency", function(err, currency) {
                    db.query("SELECT * FROM credit_note ORDER BY creditNo DESC LIMIT 1", function(err, lastCredit) {
                        res.render("admin/newcreditnote.ejs", {
                            vat: vat,
                            customer: customer,
                            currency: currency,
                            stock: stock,
                            lastCredit: lastCredit[0].creditNo,
                            userID: req.user[0],
                            userFName: req.user[1],
                            userLName: req.user[2]
                        });
                    })
                })
            })
        })
    });
});

// New Credit Note Post Request
app.post("/admin/creditnotes", function(req, res){
    var lastCreditNo = Number(req.body.last_creditNo) + 1;
    var query =     "INSERT INTO credit_note (";
    query +=        "credit_customerID, credit_userID, creditDate,";
    query +=        " creditDueDate, credit_vatID, creditAdjustments, credit_currencyID)";
    query +=        " VALUES ('"+req.body.credit_customerID+"', '"+req.body.credit_userID+"',";
    query +=        " '"+req.body.creditDate+"',";
    query +=        " '"+req.body.creditDueDate+"', '"+req.body.credit_vatID+"',";
    query +=        " '"+req.body.creditAdjustments+"', '"+req.body.credit_currencyID+"')";

    db.query(query, function(err,result) {
        var query2 = "INSERT INTO credit_stock (";
        query2 += "join_creditNo, join_stockID, stockQuantity, priceCredit)";
        query2 += " VALUES ('" + lastCreditNo + "', '" + req.body.credit_stockID + "',";
        query2 += " '" + req.body.credit_stockQty + "', '" + req.body.credit_stockPrice + "')";

        db.query(query2, function (err, result) {
            var query3 = "UPDATE stock SET quantityStockCurrent = quantityStockCurrent + ";
            query3 += "'" + req.body.credit_stockQty + "' WHERE stockID = '" + req.body.credit_stockID + "'";

            db.query(query3, function (err, result) {
                console.log("Credit Note Added");
                res.redirect("/admin/creditnotes");
            })
        })
    });
});

// Get Offers Page
app.get("/admin/offers", function(req, res) {
    db.query("SELECT * FROM offer JOIN product ON offer.offer_productID = productID JOIN currency ON offer.offer_currencyID = currencyID JOIN customer ON offer.offer_customerID = customerID", function (err, offer) {
        if (err) {
            console.log("Error with showing SQL")
        }
        else {
            res.render("admin/offers.ejs", {offer:offer, userFName: req.user[1],userLName: req.user[2]});
        }
    })
});

// Get New Offer Page
app.get("/admin/offers/new", function(req, res){
    db.query("SELECT * FROM product", function(err, product){
        db.query("SELECT * FROM customer", function(err, customer){
            db.query("SELECT * FROM currency", function(err, currency){
                res.render("admin/newoffer.ejs", {product:product, customer:customer, currency:currency, userFName: req.user[1],userLName: req.user[2]});
            })
        })
    });
});

// New Offer Post Request
app.post("/admin/offers", function(req, res){
    var query =     "INSERT INTO offer (";
    query +=        "quantityOffer, priceOffer,";
    query +=        " offer_customerID, offer_currencyID, offer_productID,";
    query +=        " dateOffer) VALUES ('"+req.body.quantityOffer+"',";
    query +=        " '"+req.body.priceOffer+"',";
    query +=        " '"+req.body.offer_customerID+"', '"+req.body.offer_currencyID+"',";
    query +=        " '"+req.body.offer_productID+"', '"+req.body.dateOffer+"')";

    console.log(query);
    db.query(query, function(err,result){
        console.log("Offer Added");
        res.redirect("/admin/offers");
    })
});

// Edit Offer Page
app.get("/admin/offers/edit/:id", function(req,res){
    db.query("SELECT * FROM offer WHERE offerID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Offer");
            res.redirect("/admin/offers")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Offer");
            res.redirect("/admin/offers")
        }
        else{
            db.query("SELECT * FROM product", function(err, product) {
                db.query("SELECT * FROM customer", function (err, customer) {
                    db.query("SELECT * FROM currency", function (err, currency) {
                        res.render("admin/editoffer", {
                            product: product,
                            customer: customer,
                            currency: currency,
                            offerID: rows[0].offerID,
                            offer_productID: rows[0].offer_productID,
                            quantityOffer: rows[0].quantityOffer,
                            offer_currencyID: rows[0].offer_currencyID,
                            priceOffer: rows[0].priceOffer,
                            offer_customerID: rows[0].offer_customerID,
                            dateOffer: rows[0].dateOffer,
                            userFName: req.user[1],
                            userLName: req.user[2]
                        })
                    })
                })
            })
        }
    })
});

// Update Offer
app.post("/admin/offers/edit", function(req, res){
    var query =         "UPDATE offer SET";
    query +=        " offer_productID = '"+req.body.offer_productID+"',";
    query +=        " quantityOffer = '"+req.body.quantityOffer+"',";
    query +=        " offer_currencyID = '"+req.body.offer_currencyID+"',";
    query +=        " priceOffer = '"+req.body.priceOffer+"',";
    query +=        " offer_customerID = '"+req.body.offer_customerID+"',";
    query +=        " dateOffer = '"+req.body.dateOffer+"'";
    query +=        " WHERE offerID = "+req.body.offerID+"";

    db.query(query, function(err,result){
        res.redirect("/admin/offers");
    })
});



// Get Reports Page
app.get("/admin/reports", function(req, res) {
    db.query("SELECT * FROM invoice JOIN invoice_stock ON invoice.invoiceNo = join_invoiceNo JOIN stock ON invoice_stock.join_stockID = stockID JOIN currency ON invoice.invoice_currencyID = currencyID JOIN account ON invoice.invoice_userID = userID", function(err,invoice){
        db.query("SELECT * FROM credit_note JOIN credit_stock ON credit_note.creditNo = join_creditNo JOIN stock ON credit_stock.join_stockID = stockID JOIN currency ON credit_note.credit_currencyID = currencyID JOIN account ON credit_note.credit_userID = userID", function(err,credit_note){
            db.query("SELECT * FROM stock JOIN currency ON stock.stock_currencyID = currencyID", function(err, stock) {
                res.render("admin/reports", {
                    invoice: invoice,
                    credit_note: credit_note,
                    stock:stock,
                    userFName: req.user[1],
                    userLName: req.user[2]
                });
            })
        })
    })
});

// Get Users Page
app.get("/admin/users", function(req, res) {
    db.query("SELECT * FROM account JOIN position ON account.user_positionID = positionID", function(err, users) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/users", {users:users, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Create New User
app.get("/admin/users/new", function(req, res) {
    db.query("SELECT * FROM position", function(err, position) {
        res.render("admin/newuser", {position:position, userFName: req.user[1],userLName: req.user[2]});
    })
});

// Handle New User
app.post("/admin/users", function(req,res){

    var salt = 'b5y7s9j83yf537gkb8tu2ic6b5vk4ue8au8cysy4';
    salt = salt + '' + req.body.password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');

    var query =     "INSERT INTO account (";
    query +=        "fName, lName, email, password, registerDate, user_positionID, adminID)";
    query +=        " VALUES ('"+req.body.fName+"', '"+req.body.lName+"'";
    query +=        ", '"+req.body.email+"', '"+encPassword+"'";
    query +=        ", '"+req.body.registerDate+"', '"+req.body.user_positionID+"', '"+req.body.adminID+"')";

    db.query(query, function(err,result){
        console.log("User Added");
        res.redirect("/admin/users");
    })
});

// Edit User Page
app.get("/admin/users/edit/:id", function(req,res){
    db.query("SELECT * FROM account WHERE userID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update User");
            res.redirect("/admin/customers")
        }
        if(rows.length <= 0){
            console.log("Failed to Find User");
            res.redirect("/admin/customers")
        }
        else{
            db.query("SELECT * FROM position", function (err, position) {
                res.render("admin/edituser", {
                    position:position,
                    userID: rows[0].userID,
                    fName: rows[0].fName,
                    lName: rows[0].lName,
                    email: rows[0].email,
                    registerDate: rows[0].registerDate,
                    adminID: rows[0].adminID,
                    user_positionID: rows[0].user_positionID,
                    userFName: req.user[1],
                    userLName: req.user[2]
                })
            })
        }
    })
});

// Update User
app.post("/admin/users/edit", function(req, res){
    var salt = 'b5y7s9j83yf537gkb8tu2ic6b5vk4ue8au8cysy4';
    salt = salt + '' + req.body.password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');

    var query =         "UPDATE account SET";
    query +=        " fName = '"+req.body.fName+"',";
    query +=        " lName = '"+req.body.lName+"',";
    query +=        " email = '"+req.body.email+"',";
    query +=        " password = '"+encPassword+"',";
    query +=        " registerDate = '"+req.body.registerDate+"',";
    query +=        " adminID = '"+req.body.adminID+"',";
    query +=        " user_positionID = '"+req.body.user_positionID+"'";
    query +=        " WHERE userID = "+req.body.userID+"";

    db.query(query, function(err,result){
        console.log(query);
        console.log("User Updated");
        res.redirect("/admin/users");
    })
});

// Get Currencies Page
app.get("/admin/currencies", function(req, res) {
    db.query("SELECT * FROM currency", function(err, currency) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/currencies", {currency:currency, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Get New Currency Form Page
app.get("/admin/currencies/new", function(req, res){
    res.render("admin/newcurrency.ejs", {userFName: req.user[1],userLName: req.user[2]});
});

// New Currency Post Request
app.post("/admin/currencies", function(req, res){
    var query  =     "INSERT INTO currency (currencyName, currencyConvert, validFrom, validUntil)";
    query +=     " VALUES ('"+req.body.currencyName+"', "+req.body.currencyConvert+", ";
    query +=     "'"+req.body.validFrom+"', '"+req.body.validUntil+"')";

    console.log(query);
    db.query(query, function(err,result){
        console.log("Currency Added");
        res.redirect("/admin/currencies");
    })
});

// Edit Currencies Page
app.get("/admin/currencies/edit/:id", function(req,res){
    db.query("SELECT * FROM currency WHERE currencyID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Currency");
            res.redirect("/admin/customers")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Currency");
            res.redirect("/admin/customers")
        }
        else{
            res.render("admin/editcurrency", {
                currencyID:rows[0].currencyID,
                currencyName:rows[0].currencyName,
                currencyConvert:rows[0].currencyConvert,
                validFrom:rows[0].validFrom,
                validUntil:rows[0].validUntil,
                userFName: req.user[1],
                userLName: req.user[2]
            })
        }
    })
});

// Update Currency
app.post("/admin/currencies/edit", function(req, res){
    var query = "UPDATE currency SET currencyName = '"+req.body.currencyName+"',";
    query +=        " currencyConvert = "+req.body.currencyConvert+",";
    query +=        " validFrom = '"+req.body.validFrom+"',";
    query +=        " validUntil = '"+req.body.validUntil+"'";
    query +=        " WHERE currencyID = '"+req.body.currencyID+"'";
    db.query(query, function(err,result){
        console.log("Currency Updated");
        res.redirect("/admin/currencies");
    })
});

// Get Products Page
app.get("/admin/products", function(req, res) {
    db.query("SELECT * FROM product", function(err, product) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/products", {product:product, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Get New Product Form Page
app.get("/admin/products/new", function(req, res){
    res.render("admin/newproduct.ejs", {userFName: req.user[1],userLName: req.user[2]});
});

// New Product Post Request
app.post("/admin/products", function(req, res){
    var query  =     "INSERT INTO product (productName, productState, productPlatform, productCategory)";
        query +=     " VALUES ('"+req.body.productName+"', '"+req.body.productState+"', ";
        query +=     "'"+req.body.productPlatform+"', '"+req.body.productCategory+"')";

    db.query(query, function(err,result){
        console.log("Product Added");
        res.redirect("/admin/products");
    })
});

// Edit Product Page
app.get("/admin/products/edit/:id", function(req,res){
    db.query("SELECT * FROM product WHERE productID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Product");
            res.redirect("/admin/customers")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Product");
            res.redirect("/admin/customers")
        }
        else{
            res.render("admin/editproduct", {
                productID:rows[0].productID,
                productName:rows[0].productName,
                productState:rows[0].productState,
                productPlatform:rows[0].productPlatform,
                productCategory:rows[0].productCategory,
                userFName: req.user[1],
                userLName: req.user[2]
            })
        }
    })
});

// Update Product
app.post("/admin/products/edit", function(req, res){
    var query = "UPDATE product SET productName = '"+req.body.productName+"',";
        query +=        " productState = '"+req.body.productState+"',";
        query +=        " productPlatform = '"+req.body.productPlatform+"',";
        query +=        " productCategory = '"+req.body.productCategory+"'";
        query +=        " WHERE productID = '"+req.body.productID+"'";
    db.query(query, function(err,result){
        console.log("Product Updated");
        res.redirect("/admin/products");
    })
});

// Get Positions Page
app.get("/admin/positions", function(req, res) {
    db.query("SELECT * FROM position", function(err, position) {
        if (err) {
            console.log("Error with showing SQL")
        } else {
            res.render("admin/positions", {position:position, userFName: req.user[1],userLName: req.user[2]});
        }
    });
});

// Get New Position Form Page
app.get("/admin/positions/new", function(req, res){
    res.render("admin/newposition.ejs", {userFName: req.user[1], userLName: req.user[2]});
});

// New Position Post Request
app.post("/admin/positions", function(req, res){
    db.query("INSERT INTO position (positionName) VALUES ('"+req.body.positionName+"')", function(err,result){
        console.log("Position Added");
        res.redirect("/admin/positions");
    })
});

// Edit Positions Page
app.get("/admin/positions/edit/:id", function(req,res){
    db.query("SELECT * FROM position WHERE positionID = "+ req.params.id, function(err, rows){
        if(err){
            console.log("Failed to Update Position");
            res.redirect("/admin/customers")
        }
        if(rows.length <= 0){
            console.log("Failed to Find Position");
            res.redirect("/admin/customers")
        }
        else{
            res.render("admin/editposition", {
                positionID:rows[0].positionID,
                positionName:rows[0].positionName,
                userFName: req.user[1],
                userLName: req.user[2]
            })
        }
    })
});

// Update Position
app.post("/admin/positions/edit", function(req, res){
    db.query("UPDATE position SET positionName = '"+req.body.positionName+"' WHERE positionID = "+req.body.positionID+"", function(err,result){
        console.log("Position Updated");
        res.redirect("/admin/positions");
    })
});
//==================================================================================
//Start Server
//==================================================================================

// Start Server on Port 3000
app.listen(3000, process.env.IP, function(){
    console.log("The Server Has Started on Port 3000.");
});