/*
 * These APIs are used to provide build info.
*/

var request = require('request');

module.exports = function(app) {

    /*
    * Retrieve a list of Espresso Builds
    */
    app.get('/api/espressoBuilds', function(req, res) {
    	
    	console.log('builds.js: Entering /api/espressoBuilds');
  		
    	var product = req.query.product;
    	
		var getOptions = {
				url: global.APP_DATA.builds_server_url + product + "/?full=1",
				auth: {
					'user': global.perffarmUsername,
					'pass': global.perffarmEspressoPwd,
				}
		};
		
		request.get(getOptions, function(error, response, body){
			console.log('build.js: Making GET request for getting Espresso Builds');
			//console.log('build.js: request error: '+error); //null
			//console.log('build.js: request response: '+response); //[object Object]
			//console.log('build.js: request body: '+body); //String with the required info regarding the builds					
			res.send(body);				
		});	
    });
    
    /*
     * Retrieve a list of AdoptOpenJDK Builds
     */
    app.get('/api/aojBuilds', function(req, res) {
    	
    	console.log('builds.js: Entering /api/aojBuilds');
  		
    	var buildPath = req.query.buildPath;
    	console.log('builds.js: buildPath: '+buildPath);
    	
    	
		var getOptions = {
				url: "https://api.adoptopenjdk.net"+buildPath,
		};
		
		request.get(getOptions, function(error, response, body){
			console.log('build.js: Making GET request for getting AdoptOpenJDK Builds');
			//console.log('build.js: request error: '+error); //null
			//console.log('build.js: request response: '+response); //[object Object]
			//console.log('build.js: request body: '+body); //String with the required info regarding the builds					
			res.send(body);				
		});
   	
    });
    
}
