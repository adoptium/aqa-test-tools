const https = require("https");
const ArgParser = require("./ArgParser.js");
const clonesPath = '/traffic/clones';
const defaultRepo = 'eclipse-openj9/openj9';
const token = ArgParser.getGitConfig();

module.exports = function (req, res) {
    let reqRepo = req.query.search? req.query.search : defaultRepo;
    let options = {
        host: 'api.github.com',
        path: '/repos/' + reqRepo + clonesPath,
        method: 'GET',
        headers: {
            'user-agent': 'request',
            'Authorization': 'token ' + token},
    };

    const request = https.request(options, function (response) {
        let body = '';
        response.on("data", function (chunk) {
            body += chunk.toString('utf8');
        });
        response.on("end", function(){
            res.send(body);
        });
    });
    
    request.end();
}
