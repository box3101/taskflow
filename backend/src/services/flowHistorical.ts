import prisma from '../prisma'
import { retrieveHistoricalEvidence } from './flowRag'
export async function loadHistoricalEvidence(userId:number,query:string,date:string,cutoff:Date) {
 const documents=await prisma.flowReport.findMany({where:{userId,ragStatus:'ready',date:{lt:date},createdAt:{lte:cutoff}},select:{id:true,filename:true,date:true,createdAt:true,ragChunks:true},orderBy:{date:'desc'},take:30})
 return retrieveHistoricalEvidence(documents,query,date,cutoff)
}
