// Read-only audit of configured additions; does not place orders or change the DB.
const fs=require('node:fs');const path=require('node:path');
const additions=require('../src/data/leader-strategy-additions.json');
const legacy=require('../src/data/spike-leader-pool.json');
(async()=>{
 const rows=[];const codes=Object.keys(additions);
 for(let i=0;i<codes.length;i+=50){
  const res=await fetch('https://polling.finance.naver.com/api/realtime/domestic/stock/'+codes.slice(i,i+50).join(','),{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://m.stock.naver.com'},signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw new Error('quote request failed');
  const data=await res.json();
  for(const q of data.datas||[]){const info=q.integratedPriceInfo||q;rows.push({code:q.itemCode,name:q.stockName,configuredName:additions[q.itemCode]?.name,theme:additions[q.itemCode]?.themes[0],sourceAt:q.localTradedAt,turnoverWon:Number(info.accumulatedTradingValueRaw),halted:q.tradeStopType?.code!=='1'});}
 }
 const missing=codes.filter(c=>!rows.some(q=>q.code===c));
 const issues=rows.filter(q=>q.name!==q.configuredName||!Number.isFinite(q.turnoverWon)||q.halted);
 const report={checkedAt:new Date().toISOString(),baseCount:Object.keys(legacy).length,addedCount:codes.length,totalCount:Object.keys({...legacy,...additions}).length,missing,issues,rows};
 fs.writeFileSync(path.resolve(__dirname,'../../docs/leader-universe-audit-2026-09-29.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({added:codes.length,total:report.totalCount,missing,issues}));
 if(missing.length||issues.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
