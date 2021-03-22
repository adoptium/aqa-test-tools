import math from 'mathjs';
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
	// str has the form "yyyymmdd" or "\syyyymmdd"
	str = str.replaceAll(' ','');
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