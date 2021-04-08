import math from 'mathjs';
import Swal from 'sweetalert2';
import BenchmarkMath from '../../../PerfCompare/lib/BenchmarkMath';

export const parseSha = (str, sha) => {
    if (!str) {
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

export const getEpochTime = (str) => {
    // str has the form "\syyyymmdd"
    if (str.length === 9) {
        let year = parseInt(str.slice(0, 5));
        // UTC format has month 0 - 11
        let month = parseInt(str.slice(5, 7)) - 1;
        let day = parseInt(str.slice(7, 9));
        return Date.UTC(year, month, day);
    } else {
        return null;
    }
}

export const getStatisticValues = (resultsByJDKBuild, key) => {
    let data = [];
    let values = [];
    let std = [];
    let mean = [];
    let median = [];

    math.sort(Object.keys(resultsByJDKBuild)).forEach((k, i) => {
        const date = getEpochTime(k);

        let group = resultsByJDKBuild[k].map(x => x[key]).filter(function (el) {
            return el != null;
        });
        if (group.length > 0) {
            values.push(math.mean(group));
            data.push([date, math.mean(group), resultsByJDKBuild[k].map(x => x['additionalData']), BenchmarkMath.confidence_interval(group)]);
            std.push([date, math.std(values)]);
            mean.push([date, math.mean(values)]);
            median.push([date, math.median(values)]);
        }

    });
    return [data, std, mean, median];
}

export const handlePointClick = (event) => {
    const { buildName, buildNum, javaVersion, jdkDate, testId } = event.point.additionalData[0];

    const buildLinks = ` <a href="/output/test?id=${testId}">${buildName} #${buildNum}</a>`;
    const CIstr = (typeof event.point.CI === 'undefined') ? `` : `CI = ${event.point.CI}`;

    let ret = `<b>${'NAME'}:</b> ${event.y}<br/> <b>Build: </b> ${jdkDate} <pre>${javaVersion}</pre><br/><b>Link to builds:</b> ${buildLinks}<br /> ${CIstr}`;
    
    let i = event.point.series.data.indexOf(event.point);
    let prevPoint = i === 0 ? null : event.point.series.data[i - 1];
    let lengthPrev = prevPoint ?
    prevPoint.additionalData.length : 0;
    let prevJavaVersion = prevPoint ? prevPoint.additionalData[lengthPrev - 1].javaVersion : null;

    prevJavaVersion = parseSha(prevJavaVersion, 'OpenJ9');
    javaVersion = parseSha(javaVersion, 'OpenJ9');

    if (prevJavaVersion && javaVersion) {
        let githubLink = `<a href="https://github.com/eclipse/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
        ret += `<br/> <b> Compare Builds: </b>${githubLink}`;
    }

    Swal.fire({
        html: ret,
        showCloseButton: true,
        showConfirmButton: false,
        width: '50%',
        customClass: {
            htmlContainer: 'text-align: left !important;',
            container: 'text-align: left !important;',
              content: 'text-align: left !important;',
              input: 'text-align: left !important;',

        }
    });
}
