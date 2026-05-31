import React from 'react';
import { Icon } from './icons.jsx';
import { Avatar, fmtMoney } from './primitives.jsx';
import { activeStages } from './data.js';

/* ============================================================
   PipelineBoard — kanban view of a track.
   ============================================================ */

export const BoardCard = ({ item, onAct, onDragStart, onDragEnd, dragging }) => {
  const daysClass = item.status === 'red' ? 'red' : item.status === 'amber' ? 'amber' : '';
  return (
    <div className={`boardCard ${dragging ? 'dragging' : ''}`}
         data-status={item.status}
         draggable
         onDragStart={(e) => onDragStart(e, item)}
         onDragEnd={onDragEnd}
         onClick={() => onAct && onAct(item)}
         title="Drag to another stage, or click to act">
      <div className="bcTop">
        <span className="typeBadge" data-kind={item.type}>{item.type}</span>
      </div>
      <div className="bcName">{item.customer}</div>
      <div className="bcSub">
        {item.vehicle && <span className="plate">{item.vehicle}</span>}
        <span>{item.sub}</span>
      </div>
      <div className="bcFoot">
        {item.value != null
          ? <span className="bcVal">{fmtMoney(item.value)}</span>
          : <Avatar name={item.owner} size="sm" muted />}
        <span className={`bcDays ${daysClass}`}>{item.daysLabel || `${item.days}d`}</span>
      </div>
    </div>
  );
};

export const PipelineBoard = ({ items, stages, onAct, onMoveStage }) => {
  const [dragId, setDragId] = React.useState(null);
  const [overStage, setOverStage] = React.useState(null);

  const present = activeStages(items, stages);
  const activeIdx = stages.findIndex(s => s.id === present[present.length - 1]);

  const onDragStart = (e, item) => {
    setDragId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.id); } catch (err) {}
  };
  const onDragEnd = () => { setDragId(null); setOverStage(null); };

  const onDrop = (e, stageId) => {
    e.preventDefault();
    const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
    if (id) onMoveStage(id, stageId);
    setDragId(null);
    setOverStage(null);
  };

  return (
    <>
      <div className="boardHint">
        <Icon name="bolt" size={12} strokeWidth={2} />
        Drag a card to a new stage to advance it — moving past a locked stage will prompt. Click a card to open its action flow.
      </div>
      <div className="board scrollHide">
        {stages.map((s, i) => {
          const colItems = items.filter(it => it.stageId === s.id);
          const state = i < activeIdx ? 'done' : (i === activeIdx || colItems.length > 0) ? 'active' : '';
          return (
            <div key={s.id}
                 className={`boardCol ${overStage === s.id ? 'dragOver' : ''}`}
                 onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
                 onDragLeave={(e) => { if (e.currentTarget === e.target) setOverStage(null); }}
                 onDrop={(e) => onDrop(e, s.id)}>
              <div className={`boardColHead ${state}`}>
                <span className="dotState">
                  {state === 'done' && <Icon name="check" size={7} strokeWidth={3} />}
                </span>
                <span className="colName">{s.label}</span>
                <span className="colCount">{colItems.length}</span>
              </div>
              <div className="boardColBody">
                {colItems.map(it => (
                  <BoardCard key={it.id} item={it} onAct={onAct}
                             onDragStart={onDragStart} onDragEnd={onDragEnd}
                             dragging={dragId === it.id} />
                ))}
                {colItems.length === 0 && (
                  <div className="boardColEmpty">
                    {overStage === s.id ? 'Drop here' : '—'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
