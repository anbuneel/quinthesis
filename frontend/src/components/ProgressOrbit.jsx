import './ProgressOrbit.css';

const stages = [
   { number: '1', label: 'Responses', key: 'stage1' },
   { number: '2', label: 'Review', key: 'stage2' },
   { number: '3', label: 'Answer', key: 'stage3' },
];

export default function ProgressOrbit({ currentStage, completedStages = [] }) {
  const getStageStatus = (stageKey) => {
    if (completedStages.includes(stageKey)) return 'completed';
    if (currentStage === stageKey) return 'active';
    return 'pending';
  };

  return (
    <div className="progress-orbit">
      {stages.map((stage, index) => {
        const status = getStageStatus(stage.key);
        return (
          <div key={stage.key} className="orbit-item">
            {index > 0 && <div className={`orbit-connector ${status === 'pending' ? '' : 'filled'}`} />}
            <div className={`orbit-stage ${status}`}>
              <span className="stage-number">{stage.number}</span>
            </div>
            <span className={`stage-label ${status}`}>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
