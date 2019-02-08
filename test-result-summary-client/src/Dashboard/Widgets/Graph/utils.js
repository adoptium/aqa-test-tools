module.exports = {
    parseSha: function(str, sha) {
        if (! str) {
            return null;
        }
        str = str.split('\n');

        for (let i of str) {
            i = i.split('-');
            if (i[0].trim() === sha) {
                try {
                    return i[1].trim();
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    }
}
