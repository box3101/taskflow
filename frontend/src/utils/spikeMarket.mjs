export function marketCells(row,history,live){
 const day=history?.days?.[row.date],at=Date.parse(`${row.date}T${row.time.length===5?row.time+':00':row.time}+09:00`);
 const actual=live?.date===row.date?live.marketContext:null;
 const night=actual?.night?.ok?actual.night:day?.night;
 const open=actual?.kospiOpen||day?.kospiOpen;
 const points=actual?.kospiSnapshots||[];
 const point=points.filter(x=>x.capturedAt<=at&&x.exchangeAt<=at&&at-x.exchangeAt<=120000).at(-1);
 // Minute timestamps label the START of the bar. Only the preceding completed bar is usable.
 const bar=day?.minutes?.filter(x=>x.time<row.time.slice(0,5)).at(-1);
 const barAt=bar?Date.parse(`${row.date}T${bar.time}:00+09:00`):NaN;
 const historicalPct=bar&&at-barAt<=180000&&open?.price>0?(bar.price-open.price)/open.price*100:null;
 const value=point?.fromOpenPct??historicalPct;
 return {...row,nightpct:night?.ok?night.changePct:null,kospigap:open?.gapPct??null,kospisignal:value,nightPct:night?.ok?night.changePct:null,kospiGap:open?.gapPct??null,kospiSignal:value,
  marketNote:point?'당시 수집한 코스피 시세':bar&&historicalPct!==null?`과거 자료 보완 · ${bar.time} 1분봉 종가 (알림 직전 완료 봉)`:'신호 시점 분봉 미확인',
  nightNote:night?.ok?`${actual?.night?.ok?'장전 수집':'과거 자료 보완'} · ${night.sessionStartDate||new Date(night.sessionEndAt).toISOString()} · 전일 정산가 대비 · ${night.contract||'과거 월물 미제공'}`:'야간선물 미확인'};
}
