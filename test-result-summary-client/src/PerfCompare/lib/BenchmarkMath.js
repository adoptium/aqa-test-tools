class BenchmarkMath {
    // Taken from Perffarm/perfsite/benchmarks.php
    /*
     * We need to calculate the standard deviation as part of the
     * statistical tests for benchmarks so this support funciton
     * is provided to ensure we are consistant.
     */
    static stddev(scores) {
        /* Make sure we are working with floating point
         * numbers.
         */
        //There is also a minor check here that makes sure that
        //we dont include NULL scores in the sd calculations.
        //We wont need this when the annotation tool is being used
        //as this should catch all 'bad' data.
        //This is only partially correct anyway because there are no checks
        //within the ci functions and so the data will still be wrong
        //and include NULL data.
        if (scores !== null) {
            let bad_data = 0;
            let scores_sum = 0;

            scores.forEach((x) => {
                if (x === null) {
                    bad_data++;
                } else {
                    scores_sum += x;
                }
            });

            let count = scores.length - bad_data;

            if (count === 0 || scores_sum === 0) {
                return null;
            }

            let mean = scores_sum / count;
            let sum = 0;

            scores.forEach((x) => {
                if (x !== null) {
                    sum += (x - mean) ** 2;
                }
            });

            if (sum !== 0 && count !== 0) {
                let stddev = Math.sqrt(sum / (count - 1));
                return stddev;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    // Taken from Perffarm/perfsite/benchmarks.php
    /*
     * This function calculates the confidence interval of a set
     * of results. We are limited to testing for 5%
     * convergence.
     */
    static confidence_interval(scores) {
        if (scores.length < 2) return 'N/A';
        let scores_sum = 0;
        scores.forEach((x) => {
            if (x !== null) {
                scores_sum += x;
            }
        });

        // First get the std deviation and other
        // useful values as floats.
        if (scores_sum !== 0) {
            let stddev = this.stddev(scores);
            let count = scores.length;
            let mean = scores_sum / count;

            // Do the convergence calculations.
            let ci = stddev * this.t_dist05(count - 1);
            ci /= mean;
            ci /= Math.sqrt(count);

            return ci;
        } else {
            return 0;
        }
    }

    // Taken from Perffarm/perfsite/benchmarks.php
    /*
     * This is a lookup function for the t-distribution.
     * It is based on the statistical tests code Dave
     * Siegwart wrote for RAJ.
     * It only does probability of 0.05.
     */
    static t_dist05(N) {
        // Constants for t-dist calculations.
        let Student_t_05 = [
            -1.0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306,
            2.262, 2.228,

            2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,

            2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
        ];
        let Student_t_05_40 = 2.021;
        let Student_t_05_60 = 2.0;
        let Student_t_05_120 = 1.98;
        let Student_t_05_2000 = 1.96;

        let P = 0.0;

        if (N <= 30) {
            P = Student_t_05[N];
        } else if (N <= 40) {
            P = this.interp(Student_t_05[30], Student_t_05_40, 30, 40, N);
        } else if (N <= 60) {
            P = this.interp(Student_t_05_40, Student_t_05_60, 40, 60, N);
        } else if (N <= 120) {
            P = this.interp(Student_t_05_60, Student_t_05_120, 60, 120, N);
        } else if (N <= 2000) {
            P = this.interp(Student_t_05_120, Student_t_05_2000, 120, 2000, N);
        } else {
            P = Student_t_05_2000;
        }
        return P;
    }

    // Taken from Perffarm/perfsite/benchmarks.php
    // Support function for t_dist05
    static interp(a, b, aN, bN, N) {
        let mu = (N - aN) / (bN - aN);
        let v = mu * (b - a) + a;
        return v;
    }
}
export default BenchmarkMath;
