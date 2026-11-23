const got = require('got');
const ArgParser = require('../ArgParser');
const { addCredential } = require('../Utils');

// The job is not a child of the release pipeline (a post-build trigger starts
// it), so it is queried from Jenkins directly rather than from TRSS builds.
const DEFAULT_JOB_URL =
    'https://ci.adoptium.net/job/build-scripts/job/release/job/create_installer_linux';
const PARAMS = ['TAG', 'ARTIFACTS_TO_COPY', 'DRY_RUN', 'SKIP_UPLOAD'];
// The job runs once per platform for every release, including runs for
// platforms that are not Linux, so look at plenty of recent runs
const BUILD_LIMIT = 300;

/**
 * getLinuxInstallerBuilds returns the recent create_installer_linux runs for
 * a release tag, queried from the Jenkins API. Runs are matched on their TAG
 * parameter. The job URL can be overridden with the LINUX_INSTALLER_JOB_URL
 * environment variable, and Jenkins credentials come from the TRSS config file.
 *
 * Example:
 *   GET api/getLinuxInstallerBuilds?tag=jdk-21.0.5+11
 *
 * @param {string} tag - Required. Release tag, the TAG parameter of the job
 * @return {object} { builds: [{ buildNum, buildResult, buildUrl, timestamp,
 *                  status, buildParams }] } or { error }. buildResult is null
 *                  and status is NotDone while a run is in progress.
 */
module.exports = async (req, res) => {
    const { tag } = req.query;
    if (!tag) {
        return res.send({ error: 'tag query parameter is required' });
    }

    const jobUrl = (
        process.env.LINUX_INSTALLER_JOB_URL || DEFAULT_JOB_URL
    ).replace(/\/$/, '');
    try {
        const response = await got(
            `${addCredential(ArgParser.getConfig(), jobUrl)}/api/json`,
            {
                searchParams: {
                    tree: `builds[number,url,result,building,timestamp,actions[parameters[name,value]]]{0,${BUILD_LIMIT}}`,
                },
                responseType: 'json',
                timeout: 30000,
            }
        );
        const builds = (response.body.builds || [])
            .map((build) => ({
                buildNum: build.number,
                buildUrl: build.url,
                buildResult: build.building ? null : build.result,
                status: build.building ? 'NotDone' : 'Done',
                timestamp: build.timestamp,
                buildParams: (build.actions || [])
                    .flatMap((action) => action.parameters || [])
                    .filter((param) => PARAMS.includes(param.name)),
            }))
            .filter((build) =>
                build.buildParams.some(
                    (param) => param.name === 'TAG' && param.value === tag
                )
            );
        res.send({ builds });
    } catch (e) {
        res.send({ error: e.toString() });
    }
};
