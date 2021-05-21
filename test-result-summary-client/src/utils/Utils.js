export const order = (a, b) => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return collator.compare(a, b);
}
export const getInfoFromBuildName = (buildName) => {
    const regex = /^Test_openjdk(\w+)_(\w+)_(\w+).(.+?)_(.+?_.+?(_xl)?)(_.+)?$/i;
    const tokens = buildName.match(regex);
    if (Array.isArray(tokens) && tokens.length > 5) {
        const [_, jdkVersion, jdkImpl, level, group, platform] = tokens;
        return {jdkVersion, jdkImpl, level, group, platform};
    }
    return null;
}

export const getGitDiffLinks = (before, after, buildName) => {
    const { jdkVersion } = getInfoFromBuildName(buildName);
    const diffLinks = {
        "OpenJ9": "https://github.com/eclipse-openj9/openj9/compare/",
        "OMR": "https://github.com/eclipse/omr/compare/",
        "IBM": "<IBM_REPO>/compare/",
        "JCL": `https://github.com/ibmruntimes/openj9-openjdk-jdk${jdkVersion}/compare/`, 
    }
    let ret = [];

    Object.entries(diffLinks).forEach(([key, value]) => {
        const beforeSHA = getSHA(key, before);
        const afterSHA = getSHA(key, after);
        if (beforeSHA && afterSHA && beforeSHA !== afterSHA) {
            ret.push(value + `${beforeSHA}...${afterSHA}`);
        }
    });

    return ret;
}

const getSHA = (type, javaVersion) => {
    const SHARegex = new RegExp(type + "\\s+-\\s+([^\\)\\s\\n]*)");
    let m;
    if ((m = javaVersion.match(SHARegex)) !== null) {
        if (m[1].includes('_')) {
            return null;
        } else {
            return m[1];
        }
    }
    return null;
}

export const fetchData = async(url) => {
    try{
        const response = await fetch(url, {
            method: 'get'
        });
        const jsonResponse = await response.json();
        return jsonResponse;    
    }
    catch(e){
        console.error(e);
    }
}
