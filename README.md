# testci
This repository stores code for test tools that do a variety of tasks, including launching perf builds and tests through Jenkins, and services to allow you to view a variety of test results.

### [PerfNext](https://github.com/adoptium/aqa-test-tools/tree/master/PerfNext)
 - a way to configure, tune and launch performance benchmarks to Jenkins servers.  This creates a more open, accessible and simpler approach to Performance testing, as our current approach is neither open or accessible to developers.

Some of the identified requirements are to allow developers to:
- easily launch and run a variety of benchmarks/perf tests
- view their results
- set allowable ranges/limits
- warn/flag on perf degradation
- store history of results
- compare results against other historical results

### [Test Result Summary Service (TRSS)](https://github.com/adoptium/aqa-test-tools/tree/master/TestResultSummaryService)
 - helps summarize different Jenkins jobs, providing additional features that a simple Jenkins plugin may not be able to support (including the ability to monitor multiple Jenkins servers, push different sets of test results to a database, search test and compare results across different platforms, report on differences between jobs, etc).  This project aims to be abstract enough for any build to log results to and present results in a personalized dashboard.
