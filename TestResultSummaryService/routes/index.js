const app = require('express').Router();

app.get('/compareTestDuration', require('./compareTestDuration'));
app.get('/compareTestsOutput', require('./compareTestsOutput'));
app.get('/deleteBuildData', require('./deleteBuildData'));
app.get('/deleteBuildListById', require('./deleteBuildListById'));
app.get(
    '/deleteBuildsAndChildrenByFields',
    require('./deleteBuildsAndChildrenByFields').default
);
app.get('/deleteCollection', require('./deleteCollection'));
app.get('/deleteUnusedOutput', require('./deleteUnusedOutput'));
app.get('/getAllChildBuilds', require('./getAllChildBuilds'));
app.get('/getAllTestsWithHistory', require('./getAllTestsWithHistory'));
app.get('/getApplicationTests', require('./getApplicationTests'));
app.get('/getAuditLogs', require('./getAuditLogs'));
app.get('/getBenchmarkMetricProps', require('./getBenchmarkMetricProps'));
app.get('/getBuildHistory', require('./getBuildHistory'));
app.get('/getBuildList', require('./getBuildList'));
app.get('/getBuildStages', require('./getBuildStages'));
app.get('/getChildBuilds', require('./getChildBuilds'));
app.get('/getDashboardBuildInfo', require('./getDashboardBuildInfo'));
app.get('/getData', require('./getData'));
app.get('/getErrorInOutput', require('./getErrorInOutput'));
app.get('/getInternalGitIssues', require('./getInternalGitIssues'));
app.get('/getHistoryPerTest', require('./getHistoryPerTest'));
app.get('/getJenkins', require('./getJenkins'));
app.get('/getJenkinsBuildInfo', require('./test/getJenkinsBuildInfo'));
app.get('/getLastBuildInfo', require('./getLastBuildInfo'));
app.get('/getLogStream', require('./getLogStream'));
app.get('/getOutputById', require('./getOutputById'));
app.get('/getOutputByTestInfo', require('./getOutputByTestInfo'));
app.get('/getTrafficLightData', require('./getTrafficLightData'));
app.get('/getTestAvgDuration', require('./getTestAvgDuration'));
app.get('/getTestInfoByBuildInfo', require('./getTestInfoByBuildInfo'));
app.get('/getAzDoRun', require('./getAzDoRun'));
app.get('/getParents', require('./getParents'));
app.get('/getPerffarmRunCSV', require('./getPerffarmRunCSV'));
app.get('/getPossibleIssuesByAI', require('./getPossibleIssuesByAI'));
app.get('/getTabularData', require('./getTabularData'));
app.get('/getTabularDropdown', require('./getTabularDropdown'));
app.get('/getTestBuildsByMachine', require('./getTestBuildsByMachine'));
app.get('/getTestById', require('./getTestById'));
app.get('/getTestBySearch', require('./getTestBySearch'));
app.get('/getTestByVersionInfo', require('./getTestByVersionInfo'));
app.get('/getTestNames', require('./getTestNames'));
app.get('/getTestByTestName', require('./getTestByTestName'));
app.get('/getTestPerPlatform', require('./getTestPerPlatform'));
app.get('/getTopLevelBuildNames', require('./getTopLevelBuildNames'));
app.get('/getTotals', require('./getTotals'));
app.get('/parseJenkinsUrl', require('./parseJenkinsUrl'));
app.get('/populateDB', require('./populateDB'));
app.get('/getFeedbackUrl', require('./getFeedbackUrl'));
app.get('/rescanBuild', require('./rescanBuild'));
app.get('/testParserViaFile', require('./test/testParserViaFile'));
app.get('/testParserViaLogStream', require('./test/testParserViaLogStream'));
app.get('/getRerunDetails', require('./getRerunDetails'));
app.get('/getJobsDetails', require('./getJobsDetails'));
app.get('/GetFailedTestByMachine', require('./GetFailedTestByMachine'));

app.get('/updateComments', require('./updateComments'));
app.get('/updateKeepForever', require('./updateKeepForever'));

// jwt
app.post('/auth/register', require('./jwt/register'));
app.post('/auth/verify', require('./jwt/verify'));

app.post('/getParentSpecificData', require('./getParentSpecificData'));
app.post('/getSpecificData', require('./getSpecificData'));
app.post('/upsertBuildList', require('./upsertBuildList'));
app.post('/postTapFiles', require('./postTapFiles'));
app.post('/postIssueFeedback', require('./postIssueFeedback'));

module.exports = app;
