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
    * 
    * Params: isSimple (boolean, default = false) - Specifies which set of benchmark definitions to send (see comments below for more details)
    */    

    app.get('/api/getBenchmarks', function(req, res) {
                
        // We currently have 2 interfaces of dev, the simple interface and the full launcher.
        // The full launcher was developed before BenchEngine, hence the data definitions are the same
        // as old "perffarm". For BenchEngine, the benchmark definitions needed to made more atomic. For this reason,
        // we differentiate between the benchmark definitions. If isSimple param is passed, it specifies that the consumer is interested in the new defiitions which are
        // compatible with BenchEngine (This is currently used by "simple launcher"). The new data definitions are stored in data_simple
        // and cached to benchmarks_simple_compiled.xml instead of benchmarks_compiled.xml.


        //Define the data folder and cache file based on the isSimple flag
        var dataFolder = req.query.isSimple ? 'data_simple' : 'data';
        var compiledBenchmarksFile = req.query.isSimple ? 'benchmarks_simple_compiled.xml' : 'benchmarks_compiled.xml';
        
        var benchmarkDataFolderPath = global.appRoot + `/config/benchmarks/${dataFolder}/`;
        var compiledBenchmarksPath = global.appRoot + `/config/cache/${compiledBenchmarksFile}`;

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