var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var appport = process.env.PORT || 8888;
var path = require('path');
var fs = require('fs');

global.appRoot = path.resolve(__dirname);
global.APP_DATA = JSON.parse(fs.readFileSync('config/APP_DATA.json', 'utf8'));

/* Refer to PerfNext/README.md for Password Requirements */
var pwdList = fs.readFileSync('perfnext_passwords', 'utf8');
global.perffarmEspressoPwd = pwdList.split(' ')[0].substring(0, 8);
global.jenkinsPwd = pwdList.split(' ')[1].substring(0, 8);
global.perffarmUsername = '';
global.jenkinsUsername = '';


//Middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//Save Raw Body of the request (We need it to get the XML string THAT we parse to JSON)
app.use(function(req, res, next) {

    req.rawBody = '';
    req.setEncoding('utf8');
    
    req.on('data', function(chunk) { 
        req.rawBody += chunk;
    });

    req.on('end', function() {
        next();
    });
});

app.use(express.static(__dirname + '/public'));

//Include all the APIs (Must come after middleware declarations)
require('./app/apis/jenkins')(app);
require('./app/apis/deprecated')(app);
require('./app/apis/benchmark_data')(app);
require('./app/apis/machines')(app);
require('./app/apis/builds')(app);
require('./app/apis/BenchEngine/parser')(app);
require('./app/apis/common')(app);


app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html');
})

app.listen(appport, function() {
    // Workaround: we currently get a certification error when requesting from Jenkins Instance
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.log('Server Started.')
})