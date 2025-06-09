const math = require("mathjs");

class BenchmarkMathCalculation {
  // Taken from Perffarm/perfsite/benchmarks.php
  /*
   * This function calculates the confidence interval of a set
   * of results. We are limited to testing for 5%
   * convergence.
   */
  static confidence_interval(scores) {
    let scores_sum = 0;
    scores.forEach((x) => {
      if (x !== null) {
        scores_sum += x;
      }
    });

    // First get the std deviation and other
    // useful values as floats.
    if (scores_sum !== 0) {
      let stddev = math.std(scores);
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
      -1.0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
      2.228,

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
module.exports = BenchmarkMathCalculation;
