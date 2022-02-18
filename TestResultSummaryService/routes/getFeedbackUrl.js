module.exports = async (req, res) => {
    const { repoName, buildName, issueName, issueCreator, accuracy } =
        req.query;

    if (!repoName || !buildName || !issueName || !issueCreator || !accuracy) {
        res.send({ error: 'Input parameters are missing' });
    } else {
        res.send({ output: { result: 'success' } });
    }
};
