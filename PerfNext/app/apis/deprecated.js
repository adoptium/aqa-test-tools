var request = require('request');

module.exports = function(app) {
    app.get('/api/submitJob', function(req, res) {

        var buildID = req.query.buildID;
        var spec = req.query.spec;
        var host = req.query.host;
        var benchmark = req.query.benchmark;
        var JDK = spec + '-' + buildID;

        var buildURL;
        var packageURL;

        //Move URLs To Config File
        if (host === 'Espresso')
            buildURL = global.APP_DATA.builds_server_url + spec + '/' + buildID + '/' + spec + '-' + buildID + '-sdk.jar';

        packageURL = global.APP_DATA.packages_base_url + benchmark + '_Package.zip';

        var jenkinsAPI = global.APP_DATA.jenkins_base + "/buildWithParameters?token=xYz@123&packageURL=" + encodeURIComponent(packageURL) + "&buildURL=" + encodeURIComponent(buildURL) + "&buildName=" + encodeURIComponent(JDK);    
        request(jenkinsAPI, function (error, response, body) {
            if (error || response.statusCode != 200) {
                console.log(error);
             }
        });
        
        res.sendStatus(200);
    });
}