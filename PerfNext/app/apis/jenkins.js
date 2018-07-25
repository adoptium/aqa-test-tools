var request = require('request');

var defaultMachine = '10.0.6.109';


/*
 * These APIs are used to provide Jenkins specific services. Then jenkinsBase and default machine
 * will need to be made dynamic.
*/

module.exports = function(app) {

    /*
    * Retrieve Console Output from Jenkins for a given jenkins jobID (job id from default machine)
    * Param: jobID (url param ../api/getConsoleOutput?jobID=x)
    */
    app.get('/api/getConsoleOutput', function(req, res) {
        var jobID = encodeURIComponent(req.query.jobID); 
        var jenkinsAPI = global.APP_DATA.jenkins_base + `/label=${defaultMachine}/${jobID}/consoleText`;

        request(jenkinsAPI, function (error, response, body) {
            res.send(body);
        });
    });

    /*
    * Retrieve a list of all jenkins jobIDs for the default machine
    */
    app.get('/api/getJobIDs', function(req, res) {
        var jobID = encodeURIComponent(req.query.jobID); 
        var jenkinsAPI = global.APP_DATA.jenkins_base + `/label=${defaultMachine}/api/json`;
        
        request(jenkinsAPI, function (error, response, body) {
            var builds = JSON.parse(body).builds;

            var buildIDs = [];

            for (var i = 0; i < builds.length; i++)
                buildIDs[i] = builds[i].number;
            
            res.json(buildIDs);
        });
    });
}