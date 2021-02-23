import BenchmarkMath from '../../../PerfCompare/lib/BenchmarkMath';
import math from 'mathjs';

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
		let month = parseInt(str.slice(5,7)) - 1; 
		let day = parseInt(str.slice(7,9));
		return Date.UTC(year,month,day); 
	} else {
		return null;
	}
}

export const calculateData = (date, dataGroup, data, std, mean, median, additionalData) => {
	let datsGtVslues = [];
	if (dataGroup.length > 0) {
		datsGtVslues.push( math.mean( dataGroup ) );
		let myCi = 'N/A';
		if (dataGroup.length > 1){
			myCi = BenchmarkMath.confidence_interval(dataGroup);
		}
		data.push( [date, math.mean( dataGroup ), additionalData , myCi] );
		std.push( [date, math.std( datsGtVslues )] );
		mean.push( [date, math.mean( datsGtVslues )] );
		median.push( [date, math.median( datsGtVslues )] );	
	}

	return {data, std, mean, median};
}