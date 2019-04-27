// This is an example plugin

module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug("onBuildDone", task.buildName);

    // Example code for querying testResultsDB
    // const result = await testResultsDB.getData({ parentId: task._id, status: { $ne: "Done" } }).toArray();
    // logger.debug("onBuildDone", result.length);
}