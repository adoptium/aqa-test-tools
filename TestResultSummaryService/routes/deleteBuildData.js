const BuildMonitor = require('../BuildMonitor');

/*
* deleteBuildData delete builds in database
*/
module.exports = async (req, res) => {
    const { buildUrl } = req.query;
    if (!buildUrl) {
        return res.status(400).send({ message: "BuildUrl is missing" });
    } else {
        const buildMonitor = new BuildMonitor();
        const task = { buildUrl, numBuildsToKeep: 0, deleteForever: true };

        const result = await buildMonitor.deleteOldBuilds(task);
        if (result) {
            return res.status(200).send(result);
        } else {
            return res.status(400).send({ message: "No build data in Database" });
        }
    }
   
}