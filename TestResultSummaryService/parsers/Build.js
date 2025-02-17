const Parser = require('./Parser');

//ToDo: this is a place holder for build
class Build extends Parser {
    static canParse(buildName) {
        return (
            buildName.match(/^Build-/) ||
            buildName.match(/IBMJAVA-build/) ||
            buildName.match(/source/i) ||
            buildName.match(/compile/i) ||
            buildName.match(/compose/i)
        );
    }

    parse(output, buildName) {
        let type = 'Build';
        if (buildName.match(/^Perf_openjdk/)) {
            type = 'Perf';
        }
        return {
            build: null,
            type,
            machine: this.extractMachineInfo(output),
        };
    }
}

module.exports = Build;
