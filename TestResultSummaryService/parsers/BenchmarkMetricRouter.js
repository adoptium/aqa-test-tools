// Routes benchmark name and variant combinations to the corresponding benchmark metric entry

const BenchmarkMetricRouter = {
    "LibertyDayTrader3": {
        "9dev-4way-LargeThreadPool": "LibertyDayTrader3",
        "9dev-4way-LargeThreadPoolwarm": "LibertyDayTrader3",
        "17dev-4way-LargeThreadPool": "LibertyDayTrader3",
        "17dev-4way-LargeThreadPoolwarm": "LibertyDayTrader3"
    },
    "LibertyStartup": {
        "9dev-4way-0-256-qs": "LibertyStartup",
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "LibertyStartupAcmeAir": {
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "LibertyStartupDT": {
        "17dev-4way-0-256-qs": "LibertyStartup"
    },
    "ILOG_WODM": {
        "881-4way-Seg5FastpathRVEJB": "ILOG_WODM"
    },
    "SPECjbb2015": {
        "multi_2grp_gencon": "SPECjbb2015"
    },
    "AcmeAirNodejs": {
        "1grp" : "AcmeAirNodejs"
    }
}

module.exports = BenchmarkMetricRouter;