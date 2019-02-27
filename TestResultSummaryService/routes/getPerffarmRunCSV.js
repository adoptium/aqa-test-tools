const request = require('request');
const csv = require('csv');
const fs = require('fs');
const path = require('path');
const ArgParser = require('../ArgParser');
module.exports = async ( req, res ) => {
    const {server, user, pass} = ArgParser.getConfig() === undefined ? {} : ArgParser.getConfig().perfFarm;
    
    if(!req.query.baselineServerURL.includes(server) || !req.query.testServerURL.includes(server)){
    	return res.json({'error': "Invalid SERVER Domain."});
    }
    
    request.get(server + '/perfsite/services/parse_results.php?metric=&runids='+req.query.baselineID+'&ignoreExcludes=true&format=csv&groupby=run', {
        'auth': {
            user,
            pass,
            'sendImmediately': false
        }}, function(err, res2, baselineBody){

                request.get(server + '/perfsite/services/parse_results.php?metric=&runids='+req.query.testID+'&ignoreExcludes=true&format=csv&groupby=run', {
                'auth': {
                    user,
                    pass,
                    'sendImmediately': false
                    }
                }, function(err3, res3, testBody){

                csv.parse(baselineBody.toString(), 
                    {auto_parse: true,
                    columns: null,
                    delimiter: ',',
                    quote: '',
                    relax_column_count: true,
                    relax: true,
                    skip_empty_lines: false}, function(err4, data4){

                    csv.parse(testBody.toString(), 
                        {auto_parse: true,
                        columns: null,
                        delimiter: ',',
                        quote: '',
                        relax_column_count: true,
                        relax: true,
                        skip_empty_lines: false}, function(err5, data5){
                            res.json({'baselineCSV': data4, 'testCSV': data5});
                    });
                });
            });
        });
}