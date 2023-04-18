import React, { useState, useEffect } from 'react';
import { params, getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import TestBreadcrumb from '../Build/TestBreadcrumb';
import SearchTestResult from './SearchTestResult';
import SearchBuildResult from './SearchBuildResult';
import SearchOutput from './SearchOutput';
import { useLocation } from 'react-router-dom';

const SearchResult = () => {
    const [builds, setBuilds] = useState([]);
    const [tests, setTests] = useState([]);
    const location = useLocation();

    useEffect(() => {
        const updateData = async () => {
            const { buildId, searchText } = getParams(location.search);
            const result = await fetchData(
                `/api/getTestBySearch${params({ buildId, searchText })}`
            );

            setBuilds(result.builds);
            setTests(result.tests);
        };
        updateData();
    }, [location.search]);

    const { buildId, searchText } = getParams(location.search);
    return (
        <div>
            <SearchOutput buildId={buildId} />
            <TestBreadcrumb buildId={buildId} />
            <SearchTestResult tests={tests} searchText={searchText} />
            <br />
            <SearchBuildResult builds={builds} searchText={searchText} />
        </div>
    );
};

export default SearchResult;
