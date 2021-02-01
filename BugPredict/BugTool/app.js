var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var expressValidator = require('express-validator');

var d3nBar = require('d3node-barchart');

var app = express();
var exec = require('child_process').exec;
var MongoClient = require('mongodb').MongoClient;

//View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//body parser middle ware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extented: false}));
app.use(bodyParser.json({ type: 'application/*+json' }));

//Set static Path
app.use(express.static(path.join(__dirname, 'public')))

//Global Vars
app.use(function(req,res,next){
	res.locals.result = null;
	next();
});


app.get('/commits', function (req, res){
  //console.log(req.query.commits);
  //var c = req.query.commits.split(',')
  
 res.render('commits' , {
    commits: req.query.commits,
    fileName: req.query.fileName
  })

});

app.post('/getScore', function (req, res){
  var ans;

  MongoClient.connect('mongodb://127.0.0.1:27017/test', function (err, db) {
  if (err) throw err
  db.collection("testTable").find( { File: req.body.file_name }).sort({Date: -1}).limit(5).toArray(function(err, result){
      if (err) throw err
    for (var i= 0; i < result.length; i++){
      console.log(result[i].Date)

    }
    res.render('score.ejs', {
      result: result,
      file_name: req.body.file_name
    });

    });
    
});

 
});


app.get('/', function (req, res) {
    // If it's not showing up, just use req.body to see what is actually being passed.
  	//var dirPath = req.body.dirPath;
    //var branchName = req.body.branchName;

    //var myCommand = '../bugspots/bin/bugspots ' + '-b openj9 /Users/linaserry/Documents/work/openj9-openjdk-jdk9' ;

  //exec(myCommand,function (error, stdout, stderr) { console.log('error: ' + error); });
  

  MongoClient.connect('mongodb://127.0.0.1:27017/test', function (err, db) {
  if (err) throw err

  db.collection("testTable").find({}, {File: 1, Score: 1, Date: 1, Commits: 1,  _id: 0 }).limit(10).toArray(function (err, result) {
    if (err) throw err;

    res.render('index' , {
    	result : result
    });
  })
})


});

app.listen(3000, function(){
	console.log("Server Started on Port 3000 .... ");
})