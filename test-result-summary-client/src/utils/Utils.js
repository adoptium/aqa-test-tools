export const order = (a, b) => {
    const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    return collator.compare(a, b);
};
export const getInfoFromBuildName = (buildName) => {
    const regex =
        /^(Test|Perf)_openjdk(\w+)_(\w+)_(\w+).(.+?)_(.+?_.+?(_xl|_fips140_2|_fips140_3_openjceplusfips|_fips140_3_openjceplusfips.fips140-3|_openjceplus|_criu)?)(_.+)?$/i;
    const tokens = buildName.match(regex);
    if (Array.isArray(tokens) && tokens.length > 5) {
        const [_, type, jdkVersion, jdkImpl, level, group, platform] = tokens;
        let rerun = false;
        if (buildName.includes('_rerun')) {
            rerun = true;
        }
        return { jdkVersion, jdkImpl, level, group, platform, rerun };
    }
    return null;
};

export const setBuildsStatus = (build, currStatus) => {
    const buildResultPriority = {
        PROGRESSING: 5,
        ABORTED: 4,
        FAILURE: 3,
        UNSTABLE: 2,
        SUCCESS: 1,
        UNDEFINED: 0,
    };

    if (build.status != 'Done' || currStatus === 'PROGRESSING') {
        return 'PROGRESSING';
    } else if (
        buildResultPriority[build.buildResult] > buildResultPriority[currStatus]
    ) {
        return build.buildResult;
    }
    return currStatus;
};

export const getGitDiffLinks = (before, after, buildName) => {
    const { jdkVersion } = getInfoFromBuildName(buildName);
    const diffLinks = {
        OpenJ9: 'https://github.com/eclipse-openj9/openj9/compare/',
        OMR: 'https://github.com/eclipse/omr/compare/',
        IBM: '<IBM_REPO>/compare/',
        JCL: `https://github.com/ibmruntimes/openj9-openjdk-jdk${jdkVersion}/compare/`,
    };
    let ret = [];

    Object.entries(diffLinks).forEach(([key, value]) => {
        const beforeSHA = getSHA(key, before);
        const afterSHA = getSHA(key, after);
        if (beforeSHA && afterSHA && beforeSHA !== afterSHA) {
            ret.push(value + `${beforeSHA}...${afterSHA}`);
        }
    });

    return ret;
};

const getSHA = (type, javaVersion) => {
    const SHARegex = new RegExp(type + '\\s+-\\s+([^\\)\\s\\n]*)');
    let m;
    if ((m = javaVersion.match(SHARegex)) !== null) {
        if (m[1].includes('_')) {
            return null;
        } else {
            return m[1];
        }
    }
    return null;
};

const connectAdoptiumAPI = process.env.REACT_APP_CONNECT_ADOPTIUM_API;
export const fetchData = async (url) => {
    if (connectAdoptiumAPI) {
        url = 'https://trss.adoptium.net' + url;
    }
    try {
        const response = await fetch(url, {
            method: 'get',
        });
        const jsonResponse = await response.json();
        return jsonResponse;
    } catch (e) {
        console.error(e);
    }
};
