import './ProgressOrbit.css';

const stages = [
  { number: 'I', label: 'Opinions', key: 'stage1' },
  { number: 'II', label: 'Review', key: 'stage2' },
  { number: 'III', label: 'Ruling', key: 'stage3' },
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
