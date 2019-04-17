var fs = require('fs');
var DOMParser = require('xmldom').DOMParser;

/*
 * These APIs expose the Benchmark data, they read the XML config files from appRoot/config and provide it to the consumer.
*/

module.exports = function(app) {

    /*
    * Retrieve the benchmark suits XML config file. This file specifies the various benchmark + variants, and the organization of it.
    */    
    app.get('/api/getBuckets', function(req, res) {
        var benchmarkConfigPath = global.appRoot + '/config/benchmarks/';

        var suiteConfig = req.query.isSimple ? 'buckets_simple.xml' : 'buckets_metric.xml';
        res.sendFile(benchmarkConfigPath + suiteConfig);
    });

    /*
    * Get all benchmark definitions by reading all files from data folder (root/config/benchmarks). 
    * This method appends all files to a single file (caches it) and then sends it to the caller.
    */    

    app.get('/api/getBenchmarks', function(req, res) {              
        
        var benchmarkDataFolderPath = global.appRoot + "/config/benchmarks/data_simple/";
        var compiledBenchmarksPath = global.appRoot + "/config/cache/benchmarks_compiled.xml";

        var numFilesProcessed = 0;

        var master = new DOMParser().parseFromString('<benchmarks> </benchmarks>'); //"Master" data File
       
        fs.readdir(benchmarkDataFolderPath, (err, files) => { //Read benchmark data folder
            files.forEach(file => { //For each file in the benchmark folder append to Master file
                var contents = fs.readFileSync(benchmarkDataFolderPath + file).toString();
                var doc = new DOMParser().parseFromString(contents);
                var benchmarks = doc.getElementsByTagName('benchmark');
                var numBenchmarks = benchmarks.length;

                for (var i = 0; i < numBenchmarks; i++)
                    master.getElementsByTagName('benchmarks')[0].appendChild(benchmarks[i]);

                if(files.length === ++numFilesProcessed){ // Check if all files in the dir have been processed
                    fs.writeFile(compiledBenchmarksPath, master, function(err) {
                        res.sendFile(compiledBenchmarksPath);
                    });
                }
            });
        })
    });
}