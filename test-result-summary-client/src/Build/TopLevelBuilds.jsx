import React, { useState, useEffect } from 'react';
import TopLevelBuildTable from './TopLevelBuildTable';
import { SearchOutput } from '../Search';
import { useParams } from 'react-router-dom';
import { ShowWhenVisible } from '../Components/ShowWhenVisible';
const { order, fetchData } = require('../utils/Utils');

function TopLevelBuilds() {
    const { type: routeType } = useParams();
    const [builds, setBuilds] = useState(null);
    const [type, setType] = useState(null);
    const [intervalId, setIntervalId] = useState(null);

    const updateData = async (type) => {
        if (!type) type = 'Test';
        let results = '';
        if (type === 'Test') {
            results = await fetchData(
                `/api/getTopLevelBuildNames?type=${type}`
            );
        } else if (type === 'AQAvitCert') {
            results = await fetchData(
                `/api/getTopLevelBuildNames?type=Test&AQAvitCert=true`
            );
        }
        const builds = {};
        for (let i = 0; results && i < results.length; i++) {
            const url = results[i]._id.url;
            const buildName = results[i]._id.buildName;
            builds[url] = builds[url] || [];
            builds[url].push(buildName);
        }
        setBuilds(builds);
        setType(type);
    };

    useEffect(() => {
        const fetchData = async () => {
            await updateData(routeType);
        };

        fetchData();

        const newIntervalId = setInterval(() => {
            updateData(routeType);
        }, 5 * 60 * 1000);

        setIntervalId(newIntervalId);

        return () => {
            clearInterval(newIntervalId);
        };
    }, [routeType]);

    if (builds && type) {
        return (
            <div>
                <SearchOutput />
                {Object.keys(builds)
                    .sort()
                    .map((url, i) => {
                        return builds[url].sort(order).map((buildName, j) => {
                            return (
                                <ShowWhenVisible key={j}>
                                    <TopLevelBuildTable
                                        url={url}
                                        buildName={buildName}
                                        type={type}
                                    />
                                </ShowWhenVisible>
                            );
                        });
                    })}
            </div>
        );
    } else {
        return null;
    }
}

export default TopLevelBuilds;
