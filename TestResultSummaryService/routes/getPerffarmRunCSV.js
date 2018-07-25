const request = require('request');
const csv = require('csv');
const fs = require('fs');
const path = require('path');

module.exports = async ( req, res ) => {

    fs.readFile(path.resolve(__dirname)+'/../perffarm.config', 'utf8', function(err, perfman_credentials){

        let perfman_user = perfman_credentials.split(' ')[0];
        let perfman_pass = perfman_credentials.split(' ')[1]

        request.get('http://perffarmServer/perfsite/services/parse_results.php?metric=&runids='+req.query.baselineID+'&ignoreExcludes=true&format=csv&groupby=run', {
            'auth': {
                'user': perfman_user,
                'pass': perfman_pass,
                'sendImmediately': false
            }}, function(err, res2, baselineBody){

                request.get('http://perffarmServer/perfsite/services/parse_results.php?metric=&runids='+req.query.testID+'&ignoreExcludes=true&format=csv&groupby=run', {
                'auth': {
                    'user': perfman_user,
                    'pass': perfman_pass,
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
    });
}