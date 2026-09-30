import prisma from '../prisma'
import {recordedFlow,type RecordedFlow} from './flowCollector'
import {buildFlowSignals} from './flowSignals'
export async function captureFlowSignals(record:RecordedFlow){
 const cutoff=new Date(record.sample.observedAt)
 const dates=await prisma.flowSnapshot.findMany({where:{date:{lt:record.sample.date},observedAt:{lt:cutoff,gte:new Date(cutoff.getTime()-60*86400000)}},distinct:['date'],select:{date:true},orderBy:{date:'desc'},take:20})
 const time=new Date(cutoff.getTime()+9*3600000).toISOString().slice(11,23)
 const ranges=dates.map(({date})=>{const t=Date.parse(date+'T'+time+'+09:00');return {date,observedAt:{gte:new Date(t-150000),lte:new Date(t)}}})
 const snapshots=await prisma.flowSnapshot.findMany({where:{OR:[{date:record.sample.date,observedAt:{lte:cutoff}},...ranges]},orderBy:{observedAt:'asc'}})
 return buildFlowSignals(record,snapshots.flatMap(s=>{const r=recordedFlow(s.payload);return r?[r]:[]}))
}
