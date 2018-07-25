/*
 * These APIs are used to provide Perf machine info.
*/

module.exports = function(app) {

    /*
    * Retrieve a list of perf machines
    */
    app.get('/api/machines', function(req, res) {
        res.sendFile(global.appRoot + '/config/machines.json');
    });  
    
    /*
     * Retrieve all the HW related info about all machines
     */
    app.get('/api/machinesInfo', function(req, res) {
        res.sendFile(global.appRoot + '/config/master_machine_list.xml');
    }); 
    
}