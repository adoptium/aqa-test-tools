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