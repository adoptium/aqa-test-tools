// Assisted by IBM Bob

const LogStream = require('../LogStream');

/**
 * GET /getJckBuildInfo?url=<jenkinsBaseUrl>&buildName=AQA_Test_Pipeline_JCK&buildNum=<n>
 *
 * Parses the console log of an AQA_Test_Pipeline_JCK build to extract the
 * status of each remotely-triggered JCK test job.
 *
 * Returns an array of objects:
 *   [{ target, platform, jdkVersion, displayName, remoteUrl, buildResult }, ...]
 *
 * Parsing is based on two console patterns:
 *   "Triggering <target>.jck on <platform> with JDK <version>"
 *   "Remote build URL: <url>"
 *   "Remote job <displayName> Status: <result>"
 */
module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    if (!url || !buildName || !buildNum) {
        return res.send({
            error: 'url, buildName and buildNum are required',
        });
    }

    try {
        const logStream = new LogStream({
            baseUrl: url,
            job: buildName,
            build: parseInt(buildNum, 10),
        });
        const output = await logStream.next(0);

        const jobs = parseJckConsole(output);
        res.send(jobs);
    } catch (e) {
        res.send({ error: e.toString() });
    }
};

/**
 * Parse the raw console text and return an array of JCK remote job descriptors.
 *
 * The console interleaves trigger blocks with polling lines so we collect
 * trigger metadata (target / platform / jdkVersion) in order, then pair each
 * "Remote build URL" and "Remote job … Status" line with the corresponding
 * trigger entry by index.
 */
function parseJckConsole(text) {
    const lines = text.split('\n');

    // ---- pass 1: collect trigger records in order --------------------------
    // Each "Triggering <target>.jck on <platform> with JDK <version>" marks the
    // start of a new remote trigger block.
    const triggerRe =
        /Triggering\s+(\S+\.jck)\s+on\s+(\S+)\s+with\s+JDK\s+(\S+)/i;
    const remoteUrlRe = /Remote build URL:\s*(https?:\/\/\S+)/i;
    const statusRe =
        /Remote job\s+(.+?)\s+Status:\s*(SUCCESS|UNSTABLE|FAILURE|ABORTED)/i;

    const triggers = []; // { target, platform, jdkVersion }
    const remoteUrls = []; // collected in order
    const statusEntries = []; // { displayName, buildResult }

    for (const line of lines) {
        const stripped = line.replace(/^\d{2}:\d{2}:\d{2}\s+/, '').trim();

        const trigMatch = stripped.match(triggerRe);
        if (trigMatch) {
            triggers.push({
                target: trigMatch[1].replace(/\.jck$/i, ''), // e.g. "sanity"
                platform: trigMatch[2],
                jdkVersion: trigMatch[3],
                remoteUrl: null,
                buildResult: null,
                displayName: null,
            });
            continue;
        }

        const urlMatch = stripped.match(remoteUrlRe);
        if (urlMatch) {
            remoteUrls.push(urlMatch[1]);
            continue;
        }

        const statusMatch = stripped.match(statusRe);
        if (statusMatch) {
            statusEntries.push({
                displayName: statusMatch[1].trim(),
                buildResult: statusMatch[2],
            });
        }
    }

    // ---- pass 2: pair urls and statuses with triggers by index -------------
    // Remote URLs and status entries appear in the same order as triggers.
    for (let i = 0; i < triggers.length; i++) {
        if (i < remoteUrls.length) triggers[i].remoteUrl = remoteUrls[i];
        if (i < statusEntries.length) {
            triggers[i].buildResult = statusEntries[i].buildResult;
            triggers[i].displayName = statusEntries[i].displayName;
        }
    }

    return triggers;
}
