import { getInfoFromBuildName } from '../../../utils/Utils';

// Release pipelines are generated as release-openjdk<version>-pipeline
export const PIPELINE_REGEX = /release-openjdk\d+u?-pipeline/i;

const ARCH_MAP = { 'x86-64': 'x64', 'x86-32': 'x32' };
const OS_LABELS = {
    linux: 'Linux',
    mac: 'Mac',
    windows: 'Windows',
    aix: 'AIX',
    'alpine-linux': 'alpine-Linux',
    solaris: 'Solaris',
};
// Primary platforms are prioritized in the Adoptium release status issue
const PRIMARY_PLATFORMS = new Set([
    'x64_linux',
    'x64_windows',
    'x64_mac',
    'aarch64_linux',
    'aarch64_mac',
]);

export const normalizeArch = (arch) => ARCH_MAP[arch] || arch;

// Platform key uses the Adoptium naming, e.g. x64_linux, aarch64_alpine-linux
export const platformKey = (arch, os) => `${normalizeArch(arch)}_${os}`;

/**
 * Convert a TRSS platform (e.g. x86-64_linux) to a platform key (x64_linux).
 * Returns null for variant platforms (e.g. x86-64_linux_xl).
 */
export const toPlatformKey = (platform) => {
    if (!platform) return null;
    const [arch, ...rest] = platform.split('_');
    if (!arch || rest.length !== 1) return null;
    return platformKey(arch, rest[0]);
};

export const platformLabel = (key) => {
    const [arch, os] = key.split('_');
    return `${arch} ${OS_LABELS[os] || os}`;
};

export const isPrimaryPlatform = (key) => PRIMARY_PLATFORMS.has(key);

// TCK (JCK) targets that must be green before a platform can be published.
// Headless platforms have no display, so they do not run dev.jck. This is the
// HEADLESS_PLATFORMS list of the aqa-tests create-release-issues workflow plus
// the platforms that have since moved to the headless category.
const TCK_TARGETS = ['sanity', 'extended', 'special'];
const HEADLESS_PLATFORMS = new Set([
    'aarch64_alpine-linux',
    'riscv64_linux',
    'x64_alpine-linux',
    'ppc64_aix',
    'ppc64le_linux',
    's390x_linux',
]);

export const isHeadlessPlatform = (key) => HEADLESS_PLATFORMS.has(key);

export const requiredTckTargets = (key) =>
    isHeadlessPlatform(key) ? TCK_TARGETS : [...TCK_TARGETS, 'dev'];

// e.g. jdk21u-linux-x64-temurin, jdk21u-alpine-linux-aarch64-temurin,
// jdk21u-windows-x86-32-temurin_SmokeTests
const SDK_BUILD_REGEX =
    /^jdk(\d*)u?-(?:evaluation-|release-)?(?:(alpine)-)?(linux|mac|windows|aix|solaris)-(x64|x86-32|aarch64|arm|ppc64le|ppc64|s390x|riscv64|sparcv9)-([a-z0-9]+)(_smoketests)?$/i;

export const parseSdkBuildName = (buildName) => {
    const m = SDK_BUILD_REGEX.exec(buildName || '');
    if (!m) return null;
    const [, jdkVersion, alpine, os, arch, impl, smoke] = m;
    return {
        jdkVersion,
        impl: impl.toLowerCase(),
        smoke: !!smoke,
        platform: platformKey(
            arch.toLowerCase(),
            alpine ? 'alpine-linux' : os.toLowerCase()
        ),
    };
};

export const parseTestBuildName = (buildName) => {
    const info = getInfoFromBuildName(buildName || '');
    if (!info) return null;
    const key = toPlatformKey(info.platform);
    return key ? { platform: key, rerun: info.rerun } : null;
};

/**
 * Classify a TRSS build as pass, fail, inprogress or none
 */
export const buildKind = (build) => {
    if (!build) return 'none';
    if (build.status && build.status !== 'Done') return 'inprogress';
    if (!build.buildResult) return 'inprogress';
    return build.buildResult === 'SUCCESS' ? 'pass' : 'fail';
};

const newer = (a, b) => (!a || (b.timestamp || 0) > (a.timestamp || 0) ? b : a);

/**
 * Collapse test builds to one entry per test target. Parallel children
 * (_testList_N) are skipped because the parent carries the aggregated result.
 * When a _rerun build exists, its result supersedes the original.
 */
export const dedupeTestBuilds = (testBuilds = []) => {
    const byName = {};
    testBuilds.forEach((build) => {
        if (build.buildName.includes('_testList_')) return;
        const name = build.buildName.replace(/_rerun$/, '');
        const slot = name === build.buildName ? 'original' : 'rerun';
        const entry = (byName[name] = byName[name] || {});
        entry[slot] = newer(entry[slot], build);
    });
    return Object.entries(byName).map(([name, { original, rerun }]) => ({
        name,
        build: rerun || original,
        rerun: rerun || null,
    }));
};

/**
 * Build the per-platform release model.
 *
 * state is one of:
 *   published  - binaries are available from the Adoptium API
 *   triage     - JDK build, AQA or TCK has a failure, or a required TCK
 *                target has no result (e.g. the TCK status could not be read
 *                from Jenkins)
 *   inprogress - build or tests still running (or no tests yet), or the TCK
 *                results are still loading (tckLoaded is false)
 *   ready      - JDK build, all AQA and every required TCK target (sanity,
 *                extended, special and, unless headless, dev) passed, not yet
 *                published
 *                (or the failures were triaged: the triage issue is closed)
 */
export const buildPlatforms = ({
    sdkBuilds = [],
    testBuilds = [],
    tckResults = [],
    published = {},
    triageIssues = {},
    tckLoaded = true,
}) => {
    const platforms = {};
    const ensure = (key) => {
        if (!platforms[key]) {
            platforms[key] = {
                key,
                label: platformLabel(key),
                primary: isPrimaryPlatform(key),
                jdk: null,
                smoke: {},
                tests: [],
                tck: [],
            };
        }
        return platforms[key];
    };

    sdkBuilds.forEach((build) => {
        const parsed = parseSdkBuildName(build.buildName);
        if (!parsed) return;
        const platform = ensure(parsed.platform);
        if (parsed.smoke) {
            platform.smoke[build.buildName] = newer(
                platform.smoke[build.buildName],
                build
            );
        } else {
            platform.jdk = newer(platform.jdk, build);
        }
    });

    dedupeTestBuilds(testBuilds).forEach((test) => {
        const parsed = parseTestBuildName(test.name);
        if (parsed) ensure(parsed.platform).tests.push(test);
    });

    tckResults.forEach((result) => ensure(result.key).tck.push(result));

    const list = Object.values(platforms).map((platform) => {
        const tests = [
            ...platform.tests,
            ...Object.entries(platform.smoke).map(([name, build]) => ({
                name,
                build,
                rerun: null,
            })),
        ];
        const aqa = {
            total: tests.length,
            passed: 0,
            failed: 0,
            inProgress: 0,
            failedBuilds: [],
        };
        tests.forEach(({ name, build, rerun }) => {
            const kind = buildKind(build);
            if (kind === 'pass') aqa.passed++;
            else if (kind === 'fail') {
                aqa.failed++;
                aqa.failedBuilds.push({
                    name,
                    url: build.buildUrl,
                    result: build.buildResult,
                    rerun: !!rerun,
                });
            } else aqa.inProgress++;
        });
        aqa.failedBuilds.sort((a, b) => a.name.localeCompare(b.name));

        const tckFailed = platform.tck.filter(
            (t) => t.buildResult && t.buildResult !== 'SUCCESS'
        );
        const jdkKind = buildKind(platform.jdk);

        // A target passed when it has a SUCCESS result and no failure. A
        // target without a result is missing: the TCK status is read from the
        // console of a remote Jenkins and may not be available.
        const tckRequired = requiredTckTargets(platform.key);
        const tckPassed = [];
        const tckMissing = [];
        tckRequired.forEach((target) => {
            const results = platform.tck.filter((t) => t.target === target);
            if (
                results.some(
                    (t) => t.buildResult && t.buildResult !== 'SUCCESS'
                )
            )
                return;
            if (results.some((t) => t.buildResult === 'SUCCESS')) {
                tckPassed.push(target);
            } else {
                tckMissing.push(target);
            }
        });

        const reasons = [];
        if (jdkKind === 'fail') reasons.push('JDK build failed');
        if (aqa.failed) reasons.push(`${aqa.failed} AQA build(s) failed`);
        if (tckFailed.length) reasons.push(`${tckFailed.length} TCK failed`);

        let state;
        if (published[platform.key]) {
            state = 'published';
        } else if (reasons.length) {
            state = 'triage';
        } else if (
            jdkKind === 'pass' &&
            aqa.inProgress === 0 &&
            aqa.total > 0 &&
            tckLoaded &&
            tckMissing.length
        ) {
            state = 'triage';
            reasons.push(`TCK result missing: ${tckMissing.join(', ')}`);
        } else if (
            jdkKind !== 'pass' ||
            aqa.inProgress > 0 ||
            aqa.total === 0 ||
            !tckLoaded
        ) {
            state = 'inprogress';
            if (jdkKind === 'none') reasons.push('JDK build not found');
            else if (jdkKind === 'inprogress')
                reasons.push('JDK build running');
            if (aqa.total === 0) reasons.push('No AQA builds yet');
            else if (aqa.inProgress) {
                reasons.push(`${aqa.inProgress} AQA build(s) running`);
            }
            if (!tckLoaded) reasons.push('TCK results loading');
        } else {
            state = 'ready';
        }

        // A closed triage issue means the failures have been triaged. It only
        // applies once everything has finished (JDK build and AQA builds are
        // done and the TCK results have loaded), otherwise a closed issue
        // could hide a platform that is still being tested.
        const issue = triageIssues[platform.key] || null;
        const finished =
            (jdkKind === 'pass' || jdkKind === 'fail') &&
            aqa.inProgress === 0 &&
            aqa.total > 0 &&
            tckLoaded;
        let triaged = false;
        if (state === 'triage' && issue && issue.state === 'closed') {
            if (finished) {
                state = 'ready';
                triaged = true;
                const failures = reasons.splice(0, reasons.length);
                reasons.push(
                    `Triage issue #${issue.number} closed (${failures.join(
                        ', '
                    )})`
                );
            } else {
                reasons.push(
                    `Triage issue #${issue.number} is closed, but testing has not finished`
                );
            }
        } else if (state === 'ready' && issue && issue.state === 'open') {
            reasons.push(`Triage issue #${issue.number} is still open`);
        }

        return {
            key: platform.key,
            label: platform.label,
            primary: platform.primary,
            state,
            triaged,
            triageIssue: issue,
            reasons,
            jdk: platform.jdk,
            jdkKind,
            aqa,
            tck: platform.tck,
            tckFailed,
            tckRequired,
            tckPassed,
            tckMissing,
        };
    });

    list.sort(
        (a, b) =>
            Number(b.primary) - Number(a.primary) ||
            a.label.localeCompare(b.label)
    );
    return list;
};

export const summarizePlatforms = (platforms) => {
    const counts = {
        total: platforms.length,
        published: 0,
        ready: 0,
        triage: 0,
        inprogress: 0,
    };
    platforms.forEach((p) => counts[p.state]++);
    const pct = (n) =>
        counts.total ? Math.round((n / counts.total) * 100) : 0;
    counts.percentPublished = pct(counts.published);
    counts.percentReady = pct(counts.published + counts.ready);
    return counts;
};

/**
 * Convert an Adoptium API release (assets/release_name) to a map of
 * platform key -> { installer }
 */
export const parsePublishedPlatforms = (release) => {
    const out = {};
    ((release && release.binaries) || []).forEach((binary) => {
        if (binary.jvm_impl && binary.jvm_impl !== 'hotspot') return;
        const key = platformKey(binary.architecture, binary.os);
        out[key] = out[key] || { installer: false };
        if (binary.installer) out[key].installer = true;
    });
    return out;
};

const INSTALLER_JOB_REGEX = /(create_installer|sign_installer)/i;
export const isInstallerBuild = (buildName) =>
    INSTALLER_JOB_REGEX.test(buildName || '');

const INSTALLER_OS = new Set(['windows', 'mac']);

/**
 * Installer status. Windows MSI and macOS PKG are the installers that the
 * Adoptium API reports, so published state is derived for those platforms.
 * Installer jobs triggered by the pipeline are summarized by job name.
 */
export const summarizeInstallers = ({
    installerBuilds = [],
    platforms = [],
    published = {},
}) => {
    const jobs = {};
    installerBuilds.forEach((build) => {
        const job = (jobs[build.buildName] = jobs[build.buildName] || {
            name: build.buildName,
            total: 0,
            passed: 0,
            failed: 0,
            inProgress: 0,
            url: build.buildUrl,
        });
        job.total++;
        const kind = buildKind(build);
        if (kind === 'pass') job.passed++;
        else if (kind === 'fail') job.failed++;
        else job.inProgress++;
    });

    const expected = platforms
        .filter((p) => INSTALLER_OS.has(p.key.split('_')[1]))
        .map((p) => ({
            key: p.key,
            label: p.label,
            published: !!(published[p.key] && published[p.key].installer),
        }));
    const done = expected.filter((p) => p.published).length;

    let status = 'pending';
    if (expected.length === 0) status = 'na';
    else if (done === expected.length) status = 'published';
    else if (done > 0) status = 'partial';

    return {
        status,
        expected,
        jobs: Object.values(jobs).sort((a, b) => a.name.localeCompare(b.name)),
    };
};

const LINUX_ARCHS = ['aarch64', 'x64', 's390x', 'arm', 'ppc64le', 'riscv64'];
const isTrue = (value) => String(value).toLowerCase() === 'true';

/**
 * Map a create_installer_linux run to its platform key (e.g. x64_linux,
 * aarch64_alpine-linux) using the ARTIFACTS_TO_COPY parameter, in the same
 * way as the job. Returns null for runs that do not map to exactly one
 * Linux platform (the job starts such "blank" runs for other platforms).
 */
export const linuxInstallerPlatform = (build) => {
    const artifacts = paramValue(build, 'ARTIFACTS_TO_COPY') || '';
    const os = artifacts.includes('alpine-linux')
        ? 'alpine-linux'
        : artifacts.includes('linux')
        ? 'linux'
        : null;
    const archs = LINUX_ARCHS.filter((arch) => artifacts.includes(`/${arch}/`));
    return os && archs.length === 1 ? platformKey(archs[0], os) : null;
};

/**
 * Linux installer (RPM/DEB/APK) status per Linux platform, from the runs of
 * the create_installer_linux job. response is the getLinuxInstallerBuilds
 * result: { builds } (or { error } if Jenkins could not be queried). Runs
 * are matched to the release by their TAG
 * parameter, and the newest run of each platform is the one that counts.
 *
 * Platform state is one of:
 *   published  - run succeeded and uploaded the packages
 *   warning    - run finished UNSTABLE (e.g. vulnerability scan findings)
 *   failed     - run failed or was aborted
 *   inprogress - run is still going
 *   pending    - no run yet, or the run did not upload (DRY_RUN/SKIP_UPLOAD)
 */
export const summarizeLinuxInstallers = ({
    platforms = [],
    releaseName,
    response,
}) => {
    const expected = platforms
        .filter((p) => ['linux', 'alpine-linux'].includes(p.key.split('_')[1]))
        .map((p) => ({ key: p.key, label: p.label, state: 'pending' }));
    if (!releaseName || !response || !Array.isArray(response.builds)) {
        return { status: 'unavailable', expected };
    }

    const latest = {};
    (response.builds || []).forEach((build) => {
        if (normalizeReleaseName(paramValue(build, 'TAG')) !== releaseName) {
            return;
        }
        const key = linuxInstallerPlatform(build);
        if (key && (!latest[key] || build.buildNum > latest[key].buildNum)) {
            latest[key] = build;
        }
    });

    expected.forEach((platform) => {
        const build = latest[platform.key];
        if (!build) return;
        platform.url = build.buildUrl;
        const kind = buildKind(build);
        if (kind === 'inprogress') platform.state = 'inprogress';
        else if (build.buildResult === 'SUCCESS') {
            const uploaded =
                !isTrue(paramValue(build, 'DRY_RUN')) &&
                !isTrue(paramValue(build, 'SKIP_UPLOAD'));
            platform.state = uploaded ? 'published' : 'pending';
        } else if (build.buildResult === 'UNSTABLE') platform.state = 'warning';
        else platform.state = 'failed';
    });

    const done = expected.filter((p) => p.state === 'published').length;
    let status = 'pending';
    if (expected.length === 0) status = 'na';
    else if (done === expected.length) status = 'published';
    else if (done > 0) status = 'partial';
    return { status, expected };
};

/**
 * Container status from Docker Hub tags (eclipse-temurin official image)
 */
export const summarizeContainers = (version, tags = []) => {
    const matching = version
        ? tags.filter((t) => t.name.startsWith(`${version}-`))
        : [];
    const platforms = [...new Set(matching.flatMap((t) => t.platforms || []))];
    return {
        status: matching.length ? 'published' : 'pending',
        tags: matching.map((t) => t.name).sort(),
        platforms: platforms.sort(),
    };
};

/**
 * Release tag helpers
 */
const RELEASE_NAME_REGEX = /^(jdk-\d+(\.\d+)*\+\d+|jdk\d+u\d+-b\d+)$/;

// jdk-21.0.5+11_adopt -> jdk-21.0.5+11. Returns null if not a build tag
// (e.g. jdk-21.0.5-ga does not identify the published build)
export const normalizeReleaseName = (ref) => {
    if (!ref) return null;
    const name = String(ref)
        .trim()
        .replace(/_adopt$/, '');
    return RELEASE_NAME_REGEX.test(name) ? name : null;
};

// "(build 21.0.5+11-LTS)" -> jdk-21.0.5+11, "(build 1.8.0_432-b06)" -> jdk8u432-b06
export const releaseNameFromJavaVersion = (javaVersion) => {
    if (!javaVersion) return null;
    let m = /\(build 1\.8\.0_(\d+)-b(\d+)\)/.exec(javaVersion);
    if (m) return `jdk8u${m[1]}-b${m[2]}`;
    m = /\(build (\d+(?:\.\d+)*)\+(\d+)/.exec(javaVersion);
    if (m) return `jdk-${m[1]}+${m[2]}`;
    return null;
};

const PUBLISH_PARAMS = ['overridePublishName', 'scmReference', 'publishName'];

export const paramValue = (build, name) => {
    const param = ((build && build.buildParams) || []).find(
        (p) => p.name === name
    );
    return param ? param.value : null;
};

export const getReleaseName = (parent, childBuilds = []) => {
    const builds = [parent, ...childBuilds];
    for (const name of PUBLISH_PARAMS) {
        for (const build of builds) {
            const releaseName = normalizeReleaseName(paramValue(build, name));
            if (releaseName) return releaseName;
        }
    }
    for (const build of builds) {
        const releaseName = releaseNameFromJavaVersion(
            build && build.javaVersion
        );
        if (releaseName) return releaseName;
    }
    return null;
};

// jdk-21.0.5+11 -> 21.0.5_11, jdk8u432-b06 -> 8u432-b06
export const dockerVersionTag = (releaseName) => {
    if (!releaseName) return null;
    return releaseName
        .replace(/^jdk-/, '')
        .replace(/^jdk(?=\d+u)/, '')
        .replace('+', '_');
};

export const releaseNotesWebUrl = (releaseName) =>
    releaseName
        ? `https://adoptium.net/temurin/release-notes?version=${encodeURIComponent(
              releaseName
          )}`
        : null;

/**
 * Convert an Adoptium API release notes response (info/release_notes) to a
 * summary. The notes are considered published when the API returns at least
 * one entry; a 404 (handled by the caller) means they are not published yet.
 */
export const summarizeReleaseNotes = (releaseName, response) => {
    const notes = (response && response.release_notes) || [];
    return {
        status: notes.length ? 'published' : 'pending',
        count: notes.length,
        url: releaseNotesWebUrl(releaseName),
    };
};

/**
 * Source tag helpers. A release pipeline builds a tag from the
 * adoptium/jdk{N}u repository. mirror-scripts releasePlan.cfg lists the GA tag
 * that is planned for each version, e.g. jdk21uGA="jdk-21.0.5-ga". The file
 * changes regularly, so the revision that relates to a pipeline is looked up
 * in the file history rather than assuming the latest one.
 */
export const RELEASE_PLAN_COMMITS_URL =
    'https://api.github.com/repos/adoptium/mirror-scripts/commits?path=releasePlan.cfg&per_page=100';
export const releasePlanUrl = (sha) =>
    `https://raw.githubusercontent.com/adoptium/mirror-scripts/${sha}/releasePlan.cfg`;

// release-openjdk21-pipeline -> jdk21u (the repo and releasePlan.cfg name)
export const pipelineRepo = (buildName) => {
    const m = /openjdk(\d+)u?-pipeline/i.exec(buildName || '');
    return m ? `jdk${m[1]}u` : null;
};

// jdk21uGA="jdk-21.0.5-ga" -> { jdk21u: 'jdk-21.0.5-ga' }
export const parseReleasePlan = (text) => {
    const plan = {};
    String(text || '')
        .split('\n')
        .forEach((line) => {
            const m = /^\s*(jdk\d+u)GA\s*=\s*["']?([^"'\s#]+)/.exec(line);
            if (m) plan[m[1]] = m[2];
        });
    return plan;
};

// GitHub commits API response -> [{ sha, date, time, url }], newest first
export const parseReleasePlanRevisions = (commits) =>
    (Array.isArray(commits) ? commits : [])
        .map((c) => {
            const date =
                c.commit && c.commit.committer && c.commit.committer.date;
            return {
                sha: c.sha,
                date,
                time: Date.parse(date),
                url: c.html_url,
            };
        })
        .filter((r) => r.sha && !isNaN(r.time))
        .sort((a, b) => b.time - a.time);

// Revisions to look at in a lookup, so that an old or manually set tag does
// not cause a request for every revision in the history
const MAX_REVISIONS = 15;

export const githubCommitUrl = (repo, ref) =>
    `https://api.github.com/repos/adoptium/${repo}/commits/${encodeURIComponent(
        ref
    )}`;

export const githubTagUrl = (repo, tag) =>
    `https://github.com/adoptium/${repo}/releases/tag/${encodeURIComponent(
        tag
    )}`;

// GitHub commit API response -> { sha, parents: [sha], url }
export const parseCommit = (commit) =>
    commit && commit.sha
        ? {
              sha: commit.sha,
              parents: (commit.parents || []).map((p) => p.sha),
              url: commit.html_url,
          }
        : null;

/**
 * Check the source tag of a pipeline against the -ga tag in releasePlan.cfg.
 *
 * The tags are compared by commit, not by name: the pipeline usually builds
 * a tag such as jdk-21.0.5+11_adopt, which is a merge into the release branch
 * whose parent is the commit that the upstream jdk-21.0.5-ga tag points to.
 * The source tag matches a planned tag when it is that tag, points to the
 * same commit, or is a merge commit with that commit as a parent.
 *
 * The source tag is only checked against the releasePlan.cfg revision in
 * effect when the pipeline started: the newest revision committed before the
 * start that plans a tag for the repo. An older revision is never used, as the
 * tag it plans has been superseded. loadPlan(sha) returns the parsed plan of a
 * revision and resolveTag(repo, ref) returns { sha, parents } or null when the
 * ref does not exist. Both throw when they cannot be read.
 *
 * Returns { status } where status is one of:
 *   verified   - the tag planned when the pipeline started matches (relation:
 *                tag, sha or merge)
 *   differs    - the tag planned when the pipeline started does not match
 *   planned    - no tag given, plannedTag is the one planned when it started
 *   unresolved - the source tag does not exist in the repo
 *   notfound   - no revision plans a tag for the repo
 */
export const verifySourceTag = async ({
    revisions = [],
    repo,
    tag,
    startTime,
    loadPlan,
    resolveTag,
}) => {
    if (!repo) return { status: 'notfound' };
    const source = tag ? await resolveTag(repo, tag) : null;
    if (tag && !source) return { status: 'unresolved' };

    const candidates = revisions
        .filter((r) => !startTime || r.time <= startTime)
        .slice(0, MAX_REVISIONS);
    for (const revision of candidates) {
        const plannedTag = (await loadPlan(revision.sha))[repo];
        if (!plannedTag) continue;
        if (!tag) return { status: 'planned', revision, plannedTag };

        let relation = plannedTag === tag ? 'tag' : null;
        if (!relation) {
            const planned = await resolveTag(repo, plannedTag);
            if (planned && planned.sha === source.sha) relation = 'sha';
            else if (planned && source.parents.includes(planned.sha)) {
                relation = 'merge';
            }
        }
        return relation
            ? { status: 'verified', relation, revision, plannedTag, source }
            : { status: 'differs', revision, plannedTag, source };
    }
    return { status: 'notfound' };
};

/**
 * The tag the pipeline is building, from its scmReference parameter, with the
 * verifySourceTag result. Without an scmReference, the tag planned in the
 * releasePlan.cfg revision in effect when the pipeline started is used.
 * lookup is null when releasePlan.cfg or GitHub could not be read.
 */
export const getSourceTag = (parent, lookup) => {
    const repo = pipelineRepo(parent && parent.buildName);
    const param = (paramValue(parent, 'scmReference') || '').trim();
    const tag =
        param ||
        (lookup && lookup.status === 'planned' ? lookup.plannedTag : null);
    if (!tag) return null;
    return {
        tag,
        repo,
        fromPlan: !param,
        // verified, differs, planned, unresolved, notfound or unavailable
        status: lookup ? lookup.status : 'unavailable',
        relation: (lookup && lookup.relation) || null,
        revision: (lookup && lookup.revision) || null,
        plannedTag: (lookup && lookup.plannedTag) || null,
        commit: (lookup && lookup.source) || null,
        url: repo ? githubTagUrl(repo, tag) : null,
    };
};

/**
 * AQAvit release issues. The adoptium/aqa-tests create-release-issues workflow
 * opens one parent issue per JDK version and release
 * ("November 2026 Release AQAvit Activities - JDK21") and one issue per
 * platform ("Triage Automated Tests for November 2026 JDK21 - x86-64_linux").
 * A closed triage issue means the AQAvit and TCK failures of the platform have
 * been triaged. Dry runs of the workflow prefix the titles with "Dry-run: ".
 */
export const aqaIssuesUrl = (version) =>
    `https://api.github.com/repos/adoptium/aqa-tests/issues?labels=JDK${version}&state=all&per_page=100`;

// release-openjdk21-pipeline -> 21
export const pipelineVersion = (buildName) => {
    const m = /openjdk(\d+)u?-pipeline/i.exec(buildName || '');
    return m ? m[1] : null;
};

const MONTHS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
];
const DAY_MS = 24 * 60 * 60 * 1000;
// A parent issue is chosen by date only when it is this close to the pipeline
const MAX_ISSUE_DISTANCE_MS = 45 * DAY_MS;

// "November 2026" -> { start, end } in ms, or null
const monthRange = (text) => {
    const m = /^([a-z]+)\s+(\d{4})$/i.exec((text || '').trim());
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (month < 0) return null;
    const year = Number(m[2]);
    return {
        start: Date.UTC(year, month, 1),
        end: Date.UTC(year, month + 1, 1),
    };
};

const PARENT_ISSUE_REGEX =
    /^(Dry-run:\s*)?(\w+ \d{4}) Release AQAvit Activities - JDK(\d+)/i;
const TRIAGE_ISSUE_REGEX =
    /^(Dry-run:\s*)?Triage Automated Tests for (\w+ \d{4}) JDK(\d+) - (\S+)/i;

// Parses the issues of the aqa-tests issues API into parents and triage issues
export const parseAqaIssues = (issues) => {
    const parents = [];
    const triage = [];
    (Array.isArray(issues) ? issues : []).forEach((issue) => {
        if (!issue || issue.pull_request) return;
        const base = {
            number: issue.number,
            url: issue.html_url,
            title: issue.title,
            state: issue.state === 'closed' ? 'closed' : 'open',
            closedAt: issue.closed_at || null,
        };
        let m = PARENT_ISSUE_REGEX.exec(issue.title || '');
        if (m) {
            const url = /Pipeline URL:\s*(\S+)/i.exec(issue.body || '');
            parents.push({
                ...base,
                dryRun: !!m[1],
                month: m[2],
                version: m[3],
                pipelineUrl: url ? url[1] : null,
            });
            return;
        }
        m = TRIAGE_ISSUE_REGEX.exec(issue.title || '');
        const key = m && toPlatformKey(m[4]);
        if (key) {
            triage.push({
                ...base,
                dryRun: !!m[1],
                month: m[2],
                version: m[3],
                key,
            });
        }
    });
    return { parents, triage };
};

// https://ci.adoptium.net/job/build-scripts/job/release-openjdk21-pipeline/8/
// -> { job: 'release-openjdk21-pipeline', num: '8' }
const jobBuild = (url) => {
    const m = /([^/]+)\/(\d+)\/?$/.exec(String(url || '').split(/[?#]/)[0]);
    return m ? { job: m[1], num: m[2] } : null;
};

/**
 * Find the parent AQAvit issue of a release pipeline and its triage issues.
 *
 * The Pipeline URL in the parent issue is the reliable link: it names the job
 * and build number. When it is missing, the parent of the same JDK version
 * whose month is closest to the pipeline start is used (dry-run issues are
 * not considered, as their pipelines are not released).
 *
 * Returns { parent, triage: { platformKey: issue }, matchedBy } or null when
 * there is no parent issue. When a platform has several triage issues, the
 * newest one is used.
 */
export const selectAqaRelease = (issues, pipeline) => {
    const version = pipelineVersion(pipeline && pipeline.buildName);
    const { parents, triage } = parseAqaIssues(issues);
    const own = parents.filter((p) => p.version === version);

    const wanted = {
        job: pipeline && pipeline.buildName,
        num: String(pipeline && pipeline.buildNum),
    };
    let parent = own.find((p) => {
        const found = jobBuild(p.pipelineUrl);
        return found && found.job === wanted.job && found.num === wanted.num;
    });
    let matchedBy = 'pipeline';
    if (!parent && pipeline && pipeline.timestamp) {
        let best = Infinity;
        own.filter((p) => !p.dryRun).forEach((p) => {
            const range = monthRange(p.month);
            if (!range) return;
            const t = pipeline.timestamp;
            const distance =
                t < range.start
                    ? range.start - t
                    : t >= range.end
                    ? t - range.end
                    : 0;
            if (distance <= MAX_ISSUE_DISTANCE_MS && distance < best) {
                best = distance;
                parent = p;
            }
        });
        matchedBy = 'date';
    }
    if (!parent) return null;

    const byKey = {};
    triage
        .filter(
            (t) =>
                t.version === parent.version &&
                t.month === parent.month &&
                t.dryRun === parent.dryRun
        )
        .forEach((t) => {
            if (!byKey[t.key] || t.number > byKey[t.key].number) {
                byKey[t.key] = t;
            }
        });
    return { parent, triage: byKey, matchedBy };
};

/**
 * Short list of the activities that are still needed to complete the release.
 * An empty list means nothing is left.
 */
export const releaseNextSteps = ({
    counts,
    platforms = [],
    installers,
    linux,
    containers,
    releaseNotes,
    publishedKnown = true,
    containersKnown = true,
}) => {
    const steps = [];
    const names = (list) => list.map((p) => p.label).join(', ');
    const triageNames = (list) =>
        list
            .map((p) =>
                p.triageIssue
                    ? `${p.label} (issue #${p.triageIssue.number})`
                    : p.label
            )
            .join(', ');
    const by = (state) => platforms.filter((p) => p.state === state);

    if (!publishedKnown) {
        steps.push(
            'Check the published binaries manually: the Adoptium API could not be reached'
        );
    }
    if (counts.inprogress) {
        steps.push(
            `Wait for ${counts.inprogress} platform(s) to finish building and testing`
        );
    }
    if (counts.triage) {
        steps.push(
            `Triage the failures on ${counts.triage} platform(s): ${triageNames(
                by('triage')
            )}`
        );
    }
    if (counts.ready) {
        steps.push(
            `Publish the binaries for ${counts.ready} platform(s): ${names(
                by('ready')
            )}`
        );
    }

    if (publishedKnown) {
        const missing = installers.expected.filter((p) => !p.published);
        if (missing.length) {
            steps.push(
                `Publish the Windows and macOS installers for ${names(missing)}`
            );
        }
    }

    if (linux.status === 'unavailable') {
        if (linux.expected.length) {
            steps.push(
                'Check the Linux packages manually: create_installer_linux status is unavailable'
            );
        }
    } else {
        const failed = linux.expected.filter((p) =>
            ['failed', 'warning'].includes(p.state)
        );
        const waiting = linux.expected.filter((p) =>
            ['pending', 'inprogress'].includes(p.state)
        );
        if (failed.length) {
            steps.push(
                `Investigate create_installer_linux for ${names(failed)}`
            );
        }
        if (waiting.length) {
            steps.push(
                `Publish the Linux packages (RPM/DEB/APK) for ${names(waiting)}`
            );
        }
    }

    if (!containersKnown) {
        steps.push(
            'Check the container images manually: Docker Hub status is unavailable'
        );
    } else if (containers.status !== 'published') {
        steps.push('Publish the container images on Docker Hub');
    }
    if (!releaseNotes) {
        steps.push(
            'Check the release notes manually: the Adoptium API status is unavailable'
        );
    } else if (releaseNotes.status !== 'published') {
        steps.push('Publish the release notes');
    }
    return steps;
};
