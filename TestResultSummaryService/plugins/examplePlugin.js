// This is an example plugin

module.exports.onBuildDone = async (task, { testResultsDB, logger }) => {
    logger.debug("examplePlugins: onBuildDone:", task.buildName, task.buildNum);

    // Example code for querying testResultsDB
    // const result = await testResultsDB.getData({ parentId: task._id, status: { $ne: "Done" } }).toArray();
    // logger.debug("onBuildDone", result.length);
}