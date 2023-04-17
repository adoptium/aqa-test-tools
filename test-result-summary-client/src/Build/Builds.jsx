import React from 'react';
import { useLocation } from 'react-router-dom';
import TopLevelBuildTable from './TopLevelBuildTable';
const Builds = () => {
    const location = useLocation();
    const { buildName, url, type } = location.search(location.search);
    return <TopLevelBuildTable url={url} buildName={buildName} type={type} />;
};

export default Builds;
