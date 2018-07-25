/*
 * These APIs are used to provide common app info.
*/

module.exports = function(app) {

    /*
    * Retrieve the common app configs
    */
    app.get('/api/getAppData', function(req, res) {
        //res.sendFile(global.appRoot + '/config/APP_DATA.json');
    	res.send(global.APP_DATA);
    });      
    
}