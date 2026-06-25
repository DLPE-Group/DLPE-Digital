import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { Avatar, SourceBadges, fmtMoney } from './primitives.jsx';
import { buildStageCounts, activeStages } from './data.js';

/* Stage rail + Item card + Track (accordion-capable) */

const StageRail = ({ stages, items, stageFilter, setStageFilter }) => {
  const counts = buildStageCounts(items, stages);
  const present = activeStages(items, stages);
  const activeId = present[present.length - 1];
  const activeIdx = stages.findIndex(s => s.id === activeId);

  return (
    <div className="stageRail scrollHide">
      {stages.map((s, i) => {
        let state = 'locked';
        if (i < activeIdx) state = 'done';
        else if (i === activeIdx || present.includes(s.id)) state = 'active';
        else if (counts[s.id] > 0) state = 'active';
        const count = counts[s.id];
        const clickable = count > 0;
        const filtered = stageFilter === s.id;
        return (
          <React.Fragment key={s.id}>
            <span className={`stage ${state} ${filtered ? 'filtered' : ''}`}
                  onClick={() => clickable && setStageFilter(filtered ? null : s.id)}
                  style={!clickable ? { cursor: 'default' } : null}
                  title={!clickable ? 'No items at this stage' :
                         filtered ? 'Clear filter' :
                         `Show only items at "${s.label}"`}>
              <span className="stageDot">
                {state === 'done' && <Icon name="check" size={9} strokeWidth={2.5} />}
                {state === 'locked' && <Icon name="lock" size={9} strokeWidth={2} />}
              </span>
              <span>{s.label}</span>
              {count > 0 && <span className="stageCount">{count}</span>}
            </span>
            {i < stages.length - 1 && <span className="stageSep">›</span>}
          </React.Fragment>
        );
      })}
      {stageFilter && (
        <button className="stageClearBtn" onClick={() => setStageFilter(null)}>
          <Icon name="close" size={11} strokeWidth={2} />
          Clear filter
        </button>
      )}
    </div>
  );
};

export const ItemCard = ({ item, onOpenTimeline, onAct, onDelete, flash }) => {
  const [expanded, setExpanded] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (flash && ref.current) {
      ref.current.classList.add('flash');
      const t = setTimeout(() => ref.current && ref.current.classList.remove('flash'), 1500);
      return () => clearTimeout(t);
    }
  }, [flash]);

  const daysClass =
    item.status === 'red' ? 'red' :
    item.status === 'amber' ? 'amber' : 'green';

  return (
    <div ref={ref} className="itemCard" data-status={item.status}
         onClick={() => setExpanded(e => !e)}>
      <div className="itemTop">
        <div className="itemMain">
          <div className="itemBadges">
            <span className="typeBadge" data-kind={item.type}>{item.type}</span>
            {item.sources && <SourceBadges sources={item.sources} />}
          </div>
          <div className="itemName">{item.customer}</div>
          <div className="itemSub">
            {item.vehicle && <span className="plate">{item.vehicle}</span>}
            <span>{item.sub}</span>
          </div>
        </div>
        {item.value != null && (
          <div className="itemValue">
            <div className="v">{fmtMoney(item.value)}</div>
            <div className="vSub">{item.type === 'INVOICE' || item.type === 'SUPPLIER' ? 'invoice' : 'contract'}</div>
          </div>
        )}
      </div>

      <div className="itemRow">
        <div className="left">
          <span className="stageName">{item.stageName}</span>
          <span className={`daysChip ${daysClass}`}>
            <Icon name="clock" size={11} strokeWidth={2} />
            {item.daysLabel || `${item.days}d in stage`}
          </span>
        </div>
        <Avatar name={item.owner} size="sm" muted />
      </div>

      <div className="itemActions" onClick={e => e.stopPropagation()}>
        <button className={`cta ${item.status === 'red' ? 'attention' : ''}`}
                onClick={() => onAct && onAct(item)}>
          <Icon name={item.type === 'INVOICE' ? 'mail' :
                      item.type === 'SUPPLIER' ? 'receipt' :
                      item.type === 'WORKSHOP' ? 'flash' :
                      item.type === 'SERVICE' ? 'truck' :
                      item.type === 'DELIVERY' ? 'truck' : 'arrow'} size={12} strokeWidth={2} />
          {item.cta}
        </button>
        {item.vehicle && (
          <button className="cta ghost" onClick={() => onOpenTimeline && onOpenTimeline(item)}>
            <Icon name="timeline" size={12} strokeWidth={2} />
            Timeline
          </button>
        )}
        {onDelete && (
          <button className="cta ghost" title="Delete item" onClick={() => onDelete(item)}
                  style={{ color: 'var(--status-red, #e05)' }}>
            <Icon name="close" size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="cardExpand">
          <div className="kv">
            <div className="k">Owner</div>
            <div className="v">{item.owner}</div>
          </div>
          <div className="kv">
            <div className="k">Current stage</div>
            <div className="v">{item.stageName}</div>
          </div>
          <div className="kv">
            <div className="k">Last activity</div>
            <div className="v">{item.daysLabel || `${item.days} days ago`}</div>
          </div>
          <div className="kv">
            <div className="k">Data sources</div>
            <div className="v">{(item.sources || []).join(' · ')}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ItemListRow = ({ item, onOpenTimeline, onAct, flash }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (flash && ref.current) {
      ref.current.classList.add('flash');
      const t = setTimeout(() => ref.current && ref.current.classList.remove('flash'), 1500);
      return () => clearTimeout(t);
    }
  }, [flash]);
  const daysClass = item.status === 'red' ? 'red' : item.status === 'amber' ? 'amber' : '';
  return (
    <div ref={ref} className="itemListRow" data-status={item.status}
         onClick={() => onAct && onAct(item)}>
      <div className="ilrBadges">
        <span className="typeBadge" data-kind={item.type}>{item.type}</span>
      </div>
      <div className="ilrMain">
        <div className="ilrName">{item.customer}</div>
        <div className="ilrSub">
          {item.vehicle && <span className="plate">{item.vehicle}</span>}
          <span>{item.sub}</span>
        </div>
      </div>
      <div className="ilrStage">{item.stageName}</div>
      <span className={`ilrDays ${daysClass}`}>
        <Icon name="clock" size={10} strokeWidth={2} />
        {item.daysLabel || `${item.days}d`}
      </span>
      <div className="ilrValue">
        {item.value != null ? (
          <>
            <div>{fmtMoney(item.value)}</div>
            <div className="vSub">{item.type === 'INVOICE' || item.type === 'SUPPLIER' ? 'invoice' : 'contract'}</div>
          </>
        ) : (
          <Avatar name={item.owner} size="sm" muted />
        )}
      </div>
      <div className="ilrActions">
        <Icon name="chevronRight" size={14} />
      </div>
    </div>
  );
};

// Compact collapsed preview — shown when the track is closed
export const TrackPreview = ({ items, onExpand, onAct }) => {
  const reds = items.filter(i => i.status === 'red').length;
  const ambers = items.filter(i => i.status === 'amber').length;
  const greens = items.filter(i => i.status === 'green').length;
  const total = items.length || 1;

  const sorted = [...items].sort((a, b) => {
    const order = { red: 0, amber: 1, green: 2 };
    return order[a.status] - order[b.status];
  });
  const top = sorted.slice(0, 3);

  if (items.length === 0) {
    return (
      <div className="trackPreview">
        <div className="previewEmpty">
          <Icon name="check" size={13} strokeWidth={2} />
          No items right now — nothing to triage.
        </div>
      </div>
    );
  }

  return (
    <div className="trackPreview">
      <div className="miniHealth">
        <span className="legendNum"><span className="d" style={{ background: 'var(--status-red)' }} />{reds} red</span>
        <span className="legendNum"><span className="d" style={{ background: 'var(--status-amber)' }} />{ambers} amber</span>
        <span className="legendNum"><span className="d" style={{ background: 'var(--status-green)' }} />{greens} on track</span>
        <span className="bar">
          <i style={{ width: `${(greens/total)*100}%`, background: 'var(--status-green)' }} />
          <i style={{ width: `${(ambers/total)*100}%`, background: 'var(--status-amber)' }} />
          <i style={{ width: `${(reds/total)*100}%`,   background: 'var(--status-red)' }} />
        </span>
      </div>
      <div className="previewList">
        {top.map(it => (
          <div key={it.id} className="previewRow" data-status={it.status}
               onClick={(e) => { e.stopPropagation(); onAct && onAct(it); }}
               title="Click to open the action flow">
            <span className="stripe" />
            <div>
              <div className="pName">{it.customer}</div>
              <div className="pStage">{it.stageName}{it.vehicle ? ` · ${it.vehicle}` : ''}</div>
            </div>
            <span className="pDays">{it.daysLabel || `${it.days}d`}</span>
            <Avatar name={it.owner} size="sm" muted />
            <Icon name="chevronRight" size={14} />
          </div>
        ))}
      </div>
      {items.length > 3 && (
        <button className="previewMore" onClick={(e) => { e.stopPropagation(); onExpand(); }}>
          Show all {items.length} items <Icon name="chevronRight" size={12} />
        </button>
      )}
    </div>
  );
};

export const Track = ({ trackId, title, accent, items, stages, owner,
                 isOpen, onToggle, onOpenTimeline, onAct, onMoveStage, onDelete, onCreate, flashIds }) => {
  const { t } = useT();
  const [stageFilter, setStageFilter] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState('cards'); // 'cards' | 'list' | 'board'
  const [showAll, setShowAll] = React.useState(false);
  const DEFAULT_LIMIT = 4;

  // Reset everything whenever the track is closed
  React.useEffect(() => {
    if (!isOpen) { setStageFilter(null); setShowAll(false); setSearch(''); }
  }, [isOpen]);

  const redCount = items.filter(i => i.status === 'red').length;
  const amberCount = items.filter(i => i.status === 'amber').length;

  let filteredItems = items;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filteredItems = filteredItems.filter(i =>
      `${i.customer} ${i.vehicle || ''} ${i.sub || ''} ${i.stageName} ${i.owner} ${i.type}`
        .toLowerCase().includes(q));
  }
  if (stageFilter) filteredItems = filteredItems.filter(i => i.stageId === stageFilter);
  const filteredStageLabel = stageFilter ? stages.find(s => s.id === stageFilter)?.label : null;
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, DEFAULT_LIMIT);
  const hiddenCount = filteredItems.length - visibleItems.length;

  return (
    <section className={`track ${isOpen ? '' : 'collapsed'}`} data-track={trackId} id={`track-${trackId}`}>
      <div className="trackHead" onClick={onToggle}>
        <span className="caret"><Icon name="chevron" size={14} /></span>
        <div className="trackTitle">
          <span className="swatch" />
          {title}
        </div>
        <div className="trackMeta">
          <span>{items.length} {items.length === 1 ? t('track.item') : t('track.items')}</span>
          {redCount > 0 && <><span className="dot" /><span style={{ color: 'var(--status-red)' }}>{redCount} {t('track.red')}</span></>}
          {amberCount > 0 && <><span className="dot" /><span style={{ color: 'var(--status-amber)' }}>{amberCount} {t('track.amber')}</span></>}
        </div>
        <span className="headSpacer" />
        {isOpen && (
          <div className="trackSearchInline" onClick={e => e.stopPropagation()}>
            <Icon name="search" size={13} />
            <input placeholder={t('track.search', { track: title.toLowerCase() })}
                   value={search}
                   onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="clearX" onClick={() => setSearch('')} title="Clear">
                <Icon name="close" size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
        {isOpen && (
          <div className="viewToggleInline" onClick={e => e.stopPropagation()}>
            <button className={viewMode === 'cards' ? 'active' : ''}
                    onClick={() => setViewMode('cards')}
                    title="Card view">
              <Icon name="settings" size={11} strokeWidth={2} /> {t('track.cards')}
            </button>
            <button className={viewMode === 'list' ? 'active' : ''}
                    onClick={() => setViewMode('list')}
                    title="List view">
              <Icon name="filter" size={11} strokeWidth={2} /> {t('track.list')}
            </button>
            <button className={viewMode === 'board' ? 'active' : ''}
                    onClick={() => setViewMode('board')}
                    title="Board view">
              <Icon name="timeline" size={11} strokeWidth={2} /> {t('track.board')}
            </button>
          </div>
        )}
        {onCreate && (
          <button className="cta ghost sm" onClick={() => onCreate(trackId)} title="Create a new item in this track"
                  style={{ marginLeft: 8 }}>
            <Icon name="plus" size={11} strokeWidth={2} /> New item
          </button>
        )}
        {owner && <>
          <span className="headDiv" />
          <div className="trackOwner">
            <Avatar name={owner} size="sm" muted />
            <span>{owner}</span>
          </div>
        </>}
      </div>

      {isOpen ? (
        <>
          <StageRail stages={stages} items={items}
                     stageFilter={stageFilter} setStageFilter={setStageFilter} />
          {stageFilter && (
            <div className="stageFilterNote">
              <Icon name="filter" size={11} strokeWidth={2} />
              Showing <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'} at stage &ldquo;<strong>{filteredStageLabel}</strong>&rdquo;
              <button className="miniBtn" onClick={() => setStageFilter(null)}>Show all {items.length}</button>
            </div>
          )}

          {viewMode === 'board' ? (
            <PipelineBoard items={filteredItems} stages={stages}
                           onAct={onAct} onMoveStage={onMoveStage} />
          ) : viewMode === 'cards' ? (
            <div className="cardsGrid">
              {visibleItems.map(it => (
                <ItemCard key={it.id} item={it}
                          onOpenTimeline={onOpenTimeline} onAct={onAct} onDelete={onDelete}
                          flash={flashIds && flashIds.includes(it.id)} />
              ))}
              {visibleItems.length === 0 && (
                <div className="previewEmpty" style={{ gridColumn: '1 / -1' }}>
                  <Icon name="search" size={13} strokeWidth={2} />
                  {search ? `No items match "${search}"` : 'No items at this stage right now.'}
                  {(search || stageFilter) && (
                    <button className="miniBtn" style={{ marginLeft: 'auto' }}
                            onClick={() => { setSearch(''); setStageFilter(null); }}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="itemList">
              {visibleItems.map(it => (
                <ItemListRow key={it.id} item={it}
                             onOpenTimeline={onOpenTimeline} onAct={onAct}
                             flash={flashIds && flashIds.includes(it.id)} />
              ))}
              {visibleItems.length === 0 && (
                <div className="previewEmpty">
                  <Icon name="search" size={13} strokeWidth={2} />
                  {search ? `No items match "${search}"` : 'No items at this stage right now.'}
                  {(search || stageFilter) && (
                    <button className="miniBtn" style={{ marginLeft: 'auto' }}
                            onClick={() => { setSearch(''); setStageFilter(null); }}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {viewMode !== 'board' && filteredItems.length > DEFAULT_LIMIT && (
            <div className="showMoreBar">
              <button className="showMoreBtn" onClick={() => setShowAll(s => !s)}>
                {showAll ? (
                  <><Icon name="chevron" size={11} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} /> {t('track.showFirst', { n: DEFAULT_LIMIT })}</>
                ) : (
                  <><Icon name="chevron" size={11} strokeWidth={2.5} /> {t('track.showMore', { n: hiddenCount })}</>
                )}
              </button>
              <span className="pageSizeSel">
                {t('track.perPage')}
                <select value={DEFAULT_LIMIT} disabled style={{ opacity: 0.6 }}>
                  <option value="4">4</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </span>
            </div>
          )}
        </>
      ) : (
        <TrackPreview items={items} onExpand={onToggle} onAct={onAct} />
      )}
    </section>
  );
};

/* ============================================================
   PipelineBoard — kanban view of a track.
   ============================================================ */

const BoardCard = ({ item, onAct, onDragStart, onDragEnd, dragging }) => {
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
