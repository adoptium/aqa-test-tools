import React from 'react';
import { useLocation } from 'react-router-dom';
import TopLevelBuildTable from './TopLevelBuildTable';

// Custom hook to parse the query parameters
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const Builds = () => {
  const query = useQuery();
  const buildName = query.get('buildName');
  const url = query.get('url');
  const type = query.get('type');

  return <TopLevelBuildTable url={url} buildName={buildName} type={type} />;
};

export default Builds;
