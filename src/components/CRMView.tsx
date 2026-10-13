import React from 'react';
import CrmKanban from './CrmKanban';

export const CRMView: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <CrmKanban />
    </div>
  );
};

export default CRMView;
