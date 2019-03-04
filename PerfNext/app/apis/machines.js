/*
 * These APIs are used to provide Perf machine info.
*/
var request = require('request');

module.exports = function(app) {
    /*
     * Retrieve all the HW related info about all machines
     */
    app.get('/api/machinesInfo', function(req, res) {
		var getOptions = {
				url: global.APP_DATA.machine_list_url,
				auth: {
					'user': global.jenkinsUsername,
					'pass': global.jenkinsPwd,
				}
		};
		
		request.get(getOptions, function(error, response, body){
			console.log('machine.js: Making GET request for getting machine database file');
			res.type('application/xml');
			res.send(body);			
		});
    }); 
    
}