import * as math from 'mathjs';
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

// this method should be deleted after total cleanup of Renaissance.jsx
export const getEpochTime = (str) => {
	// str has the form "yyyymmdd" or "\syyyymmdd"
	str = str.trim();
	if (str.length === 8) {
		let year = parseInt(str.slice(0, 4));
		// UTC format has month 0 - 11
		let month = parseInt(str.slice(4, 6)) - 1;
		let day = parseInt(str.slice(6, 8));
		return Date.UTC(year, month, day);
	} else {
		return null;
	}
}

// TODO: delete this function after a few months when all jdkDate are in the date format
export const formatDate = (str) => {
	const oldFormatRegex = /\d{8}/;
	let curRegexResult = null;
	if ( ( curRegexResult = oldFormatRegex.exec(str) ) != null) {
		let year = parseInt(str.slice(0, 4));
		let month = parseInt(str.slice(4, 6));
		let day = parseInt(str.slice(6, 8));
		let date = year + "-" + month + "-" + day;
		return date;
	} else {
		return str;
	}
}

export const getStatisticValues = (resultsByJDKBuild, key) => {
    let data = [];
    let values = [];
    let std = [];
    let mean = [];
    let median = [];

    Object.keys(resultsByJDKBuild).sort( function (a,b) 
    { return new Date(a).getTime() - new Date(b).getTime(); })
    .forEach((k, i) => {
        const date = new Date(k);

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
    const { buildName, buildNum, jdkDate, testId } = event.point.additionalData[0];
    let { javaVersion } = event.point.additionalData[0];

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
        let githubLink = `<a href="https://github.com/eclipse-openj9/openj9/compare/${prevJavaVersion}…${javaVersion}">Github Link </a>`;
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
