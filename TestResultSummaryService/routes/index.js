const app = require('express').Router();
const wrap = (fn) => (req, res) =>
    fn(req, res).catch(console.error.bind(console));

app.get('/compareTestDuration', wrap(require('./compareTestDuration')));
app.get('/compareTestsOutput', wrap(require('./compareTestsOutput')));
app.get('/deleteBuildData', wrap(require('./deleteBuildData')));
app.get('/deleteBuildListById', wrap(require('./deleteBuildListById')));
app.get(
    '/deleteBuildsAndChildrenByFields',
    wrap(require('./deleteBuildsAndChildrenByFields').default)
);
app.get('/deleteCollection', wrap(require('./deleteCollection')));
app.get('/deleteUnusedOutput', wrap(require('./deleteUnusedOutput')));
app.get('/getAllChildBuilds', wrap(require('./getAllChildBuilds')));
app.get('/getAllTestsWithHistory', wrap(require('./getAllTestsWithHistory')));
app.get('/getApplicationTests', wrap(require('./getApplicationTests')));
app.get('/getAuditLogs', wrap(require('./getAuditLogs')));
app.get('/getBenchmarkMetricProps', wrap(require('./getBenchmarkMetricProps')));
app.get('/getBuildHistory', wrap(require('./getBuildHistory')));
app.get('/getBuildList', wrap(require('./getBuildList')));
app.get('/getBuildStages', wrap(require('./getBuildStages')));
app.get('/getChildBuilds', wrap(require('./getChildBuilds')));
app.get('/getDashboardBuildInfo', wrap(require('./getDashboardBuildInfo')));
app.get('/getData', wrap(require('./getData')));
app.get('/getErrorInOutput', wrap(require('./getErrorInOutput')));
app.get('/getHistoryPerTest', wrap(require('./getHistoryPerTest')));
app.get('/getJenkins', wrap(require('./getJenkins')));
app.get('/getJenkinsBuildInfo', wrap(require('./test/getJenkinsBuildInfo')));
app.get('/getLastBuildInfo', wrap(require('./getLastBuildInfo')));
app.get('/getLogStream', wrap(require('./getLogStream')));
app.get('/getOutputById', wrap(require('./getOutputById')));
app.get('/getOutputByTestInfo', wrap(require('./getOutputByTestInfo')));
app.get('/getTestAvgDuration', wrap(require('./getTestAvgDuration')));
app.get('/getTestInfoByBuildInfo', wrap(require('./getTestInfoByBuildInfo')));
app.get('/getAzDoRun', wrap(require('./getAzDoRun')));
app.get('/getParents', wrap(require('./getParents')));
app.get('/getPerffarmRunCSV', wrap(require('./getPerffarmRunCSV')));
app.get('/getTabularData', wrap(require('./getTabularData')));
app.get('/getTabularDropdown', wrap(require('./getTabularDropdown')));
app.get('/getTestBuildsByMachine', wrap(require('./getTestBuildsByMachine')));
app.get('/getTestById', wrap(require('./getTestById')));
app.get('/getTestBySearch', wrap(require('./getTestBySearch')));
app.get('/getTestByVersionInfo', wrap(require('./getTestByVersionInfo')));
app.get('/getTestPerPlatform', wrap(require('./getTestPerPlatform')));
app.get('/getTopLevelBuildNames', wrap(require('./getTopLevelBuildNames')));
app.get('/getTotals', wrap(require('./getTotals')));
app.get('/parseJenkinsUrl', wrap(require('./parseJenkinsUrl')));
app.get('/populateDB', wrap(require('./populateDB')));
app.get('/getFeedbackUrl', wrap(require('./getFeedbackUrl')));
app.get('/rescanBuild', wrap(require('./rescanBuild')));
app.get('/testParserViaFile', wrap(require('./test/testParserViaFile')));
app.get(
    '/testParserViaLogStream',
    wrap(require('./test/testParserViaLogStream'))
);

app.get('/updateComments', wrap(require('./updateComments')));
app.get('/updateKeepForever', wrap(require('./updateKeepForever')));

// jwt
app.post('/auth/register', wrap(require('./jwt/register')));
app.post('/auth/verify', wrap(require('./jwt/verify')));

app.post('/getParentSpecificData', wrap(require('./getParentSpecificData')));
app.post('/getSpecificData', wrap(require('./getSpecificData')));
app.post('/upsertBuildList', wrap(require('./upsertBuildList')));
app.post('/postTapFiles', wrap(require('./postTapFiles')));
app.post('/postIssueFeedback', wrap(require('./postIssueFeedback')));

module.exports = app;
