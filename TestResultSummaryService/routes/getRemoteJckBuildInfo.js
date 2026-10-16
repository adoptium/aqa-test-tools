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
 * Trigger metadata is collected in log order. Status lines are associated with
 * their target using the remote job display name when possible, since parallel
 * jobs can finish in a different order than they were triggered.
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
        /Remote job\s+(.+?)(?:\s+Target:\s*(\S+))?\s+Status:\s*(SUCCESS|UNSTABLE|FAILURE|ABORTED)/i;

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
                target: statusMatch[2]?.replace(/\.jck$/i, ''),
                buildResult: statusMatch[3],
            });
        }
    }

    // ---- pass 2: pair urls and statuses with triggers ----------------------
    for (let i = 0; i < triggers.length; i++) {
        if (i < remoteUrls.length) triggers[i].remoteUrl = remoteUrls[i];
    }

    const statusByTrigger = new Map();
    const escapeRegExp = (value) =>
        value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchesName = (name, value) => {
        const escapedValue = escapeRegExp(value);
        return new RegExp(`(?:^|[^\\w])${escapedValue}(?:$|[^\\w])`, 'i').test(
            name
        );
    };
    statusEntries.forEach((statusEntry) => {
        const targetMatches = triggers.filter((trigger) =>
            statusEntry.target
                ? trigger.target.toLowerCase() ===
                  statusEntry.target.toLowerCase()
                : new RegExp(
                      `(?:^|[^\\w])${escapeRegExp(trigger.target)}(?:\\.jck)?(?:$|[^\\w])`,
                      'i'
                  ).test(statusEntry.displayName)
        );
        const exactMatches =
            targetMatches.length > 1
                ? targetMatches.filter(
                      ({ platform, jdkVersion }) =>
                          matchesName(statusEntry.displayName, platform) &&
                          matchesName(
                              statusEntry.displayName,
                              `jdk${jdkVersion}`
                          )
                  )
                : targetMatches;
        if (exactMatches.length === 1) {
            statusByTrigger.set(exactMatches[0], statusEntry);
        }
    });

    const matchedStatuses = new Set(statusByTrigger.values());
    const unmatchedStatuses = statusEntries.filter(
        (statusEntry) => !matchedStatuses.has(statusEntry)
    );
    triggers.forEach((trigger) => {
        if (!statusByTrigger.has(trigger) && unmatchedStatuses.length > 0) {
            statusByTrigger.set(trigger, unmatchedStatuses.shift());
        }
        const statusEntry = statusByTrigger.get(trigger);
        if (statusEntry) {
            trigger.buildResult = statusEntry.buildResult;
            trigger.displayName = statusEntry.displayName;
        }
    });

    return triggers;
}
