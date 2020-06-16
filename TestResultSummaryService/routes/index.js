const app = require( 'express' ).Router();
const wrap = fn => ( req, res ) => fn( req, res ).catch( console.error.bind( console ) );
const request = require('superagent');
var sha1 = require('sha1');
var session = require('express-session');
var cache = require ('memory-cache');
const { logger } = require( '../Utils' );

app.use(session({
    secret: 'eg[ijsli;;toyF9sfd-8I-7w2315df{}+8',
    resave: false,
    saveUninitialized: false,
  }));

app.get( '/compareTestDuration', wrap( require( "./compareTestDuration" ) ) );
app.get( '/compareTestsOutput', wrap( require( "./compareTestsOutput" ) ) );
app.get( '/deleteBuildListById', wrap( require( "./deleteBuildListById" ) ) );
app.get( '/deleteBuildsAndChildrenByFields', wrap( require( "./deleteBuildsAndChildrenByFields" ).default ) );
app.get( '/deleteCollection', wrap( require( "./deleteCollection" ) ) );
app.get( '/deleteUnusedOutput', wrap( require( "./deleteUnusedOutput" ) ) );
app.get( '/getAllChildBuilds', wrap( require( "./getAllChildBuilds" ) ) );
app.get( '/getAllTestsWithHistory', wrap( require( "./getAllTestsWithHistory" ) ) );
app.get( '/getAuditLogs', wrap( require( "./getAuditLogs" ) ) );
app.get( '/getBenchmarkMetricProps', wrap ( require ("./getBenchmarkMetricProps") )) ;
app.get( '/getBuildHistory', wrap( require( "./getBuildHistory" ) ) );
app.get( '/getBuildList', wrap( require( "./getBuildList" ) ) );
app.get( '/getChildBuilds', wrap( require( "./getChildBuilds" ) ) );
app.get( '/getDashboardBuildInfo', wrap( require( "./getDashboardBuildInfo" ) ) );
app.get( '/getData', wrap( require( "./getData" ) ) );
app.get( '/getHistoryPerTest', wrap( require( "./getHistoryPerTest" ) ) );
app.get( '/getJenkins', wrap( require( "./getJenkins" ) ) );
app.get( '/getLastBuildInfo', wrap( require( "./getLastBuildInfo" ) ) );
app.get( '/getOutputById', wrap( require( "./getOutputById" ) ) );
app.get( '/getOutputByTestInfo', wrap( require( "./getOutputByTestInfo" ) ) );
app.get( '/getTestAvgDuration', wrap( require( "./getTestAvgDuration" ) ) );
app.get( '/getTestInfoByBuildInfo', wrap( require( "./getTestInfoByBuildInfo" ) ) );
app.get( '/getParents', wrap( require( "./getParents" ) ) );
app.get( '/getPerffarmRunCSV', wrap( require( "./getPerffarmRunCSV" ) ) );
app.get( '/getTabularData', wrap( require( "./getTabularData" ) ) );
app.get( '/getTabularDropdown', wrap( require( "./getTabularDropdown" ) ) );
app.get( '/getTestById', wrap( require( "./getTestById" ) ) );
app.get( '/getTestBySearch', wrap( require( "./getTestBySearch" ) ) );
app.get( '/getTestPerPlatform', wrap( require( "./getTestPerPlatform" ) ) );
app.get( '/getTopLevelBuildNames', wrap( require( "./getTopLevelBuildNames" ) ) );
app.get( '/getTotals', wrap( require( "./getTotals" ) ) );
app.get( '/populateDB', wrap( require( "./populateDB" ) ) );
app.get( '/updateComments', wrap( require( "./updateComments" ) ) );

app.post( '/getParentSpecificData', wrap( require( "./getParentSpecificData" ) ) );
app.post( '/getSpecificData', wrap( require( "./getSpecificData" ) ) );
app.post( '/upsertBuildList', wrap( require( "./upsertBuildList" ) ) );

// app.get('/user/signin/callback', (req, res, next) => {
//     const code = req.query.code;
  
//     if (!code) {
//       return res.send({
//         success: false,
//         message: 'Error: no code'
//       });
//     }
  
//     // POST to github to get access code
//     request
//       .post('https://github.com/login/oauth/access_token')
//       .send({ 
//         client_id: 'c5ab64f68ab33409e874',
//         client_secret: '89f2d36e4d1e0b1f7e48e8b488eb6e45b68394c5',
//         code: code
//       })
//       .set('Content-Type', 'application/json')
//       .then(result => {
//         const access_token = result.body.access_token;
//         let repoInfo;
//         // use access code to get repo info about the user
//         request
//           .get('https://api.github.com/user/repos')
//           .set('Authorization', 'token ' + access_token)
//           .set('Content-Type', 'application/json')
//           .set('User-Agent', 'node.js')
//           .then(result => {
//             //  repo name is AdoptOpenJDK/openjdk-test-tools and user has admin access
//             repoInfo = result.body.filter(repo => (repo.full_name == repoName && repo.permissions.admin));
//             if (repoInfo.length !== 0) {
//                 // store in cache (local memory space), set expire time to be 30min (1000*60*30 ms)
//                 cache.put(sha1(access_token), { accessToken: access_token, permissions: repoInfo[0].permissions }, 1000*60*30, );
                
//                 logger.verbose(`Github Callback: access token is ${access_token}, permission is`, repoInfo[0].permissions);
//                 // for security, client side will get SHA1-hash of access token
//                 req.session.user = sha1(access_token);
//             }
//             res.status(301).redirect('http://localhost:3000/admin/settings');
//           })
//           .catch(error => console.log(error));;
//       })
//       .catch(error => console.log(error));
//   });

app.get('/user/signin/callback', (req, res, next) => {
  const code = req.query.code;

  if (!code) {
    return res.send({
      success: false,
      message: 'Error: no code'
    });
  }

  // POST to github to get access code
  request
    .post('https://github.com/login/oauth/access_token')
    .send({ 
      client_id: 'c5ab64f68ab33409e874',
      client_secret: 'ba91b7c807356eeb48a14714ff8be0a90be5efe8',
      code: code
    })
    .set('Content-Type', 'application/json')
    .then(result => {
      const access_token = result.body.access_token;

      // use access code to get repo info about the user
      request
        .get('https://api.github.com/user')
        .set('Authorization', 'token ' + access_token)
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'node.js')
        .then(result => {
          const login = result.body.login;
          request
            .get('https://api.github.com/repos/AdoptOpenJDK/openjdk-test-tools/contributors')
            .set('Content-Type', 'application/json')
            .set('User-Agent', 'node.js')
            .then(result => {
                const contributor = result.body.filter(contributor => (contributor.login == login));
                const user = contributor.login;

                // contributor has logged in
                if (contributor.length !== 0) {
                  // store in cache (local memory space), set expire time to be 30 min (1000*60*30 ms)
                  cache.put(sha1(access_token), { accessToken: access_token, user: user}, 1000*60*30, );

                  logger.verbose(`Github Callback: access token is ${access_token}`, `user is ${user}`);

                  // for security, client side will get SHA1-hash of access token
                  req.session.user = sha1(access_token);
                }
                res.status(301).redirect('http://localhost:3000/admin/settings');
            })
            .catch(error => console.log(error));
        })
        .catch(error => console.log(error));
    })
    .catch(error => console.log(error));
});

  app.get('/user/status', (req, res, next) => {
    logger.verbose(`user status:`,cache.get(req.session.user));
    if (cache.get(req.session.user) == null) {
      res.status(401).send({isLoggedIn: false});
    } else {
      res.status(200).send({isLoggedIn: true});
    }
  });
module.exports = app;