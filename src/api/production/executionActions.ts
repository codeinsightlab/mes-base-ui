import { request } from '@/lib/request'
import type { MesProductionExecutionVo } from './mesProductionExecution'
export interface PathView { routingCode: string; routingName: string; routingVersion: number;
 executionId: string; executionStatus: string; routingId: string | null; pathStatus: string; revision: number;
 selectedAt: string | null; lockedAt: string | null; selectedNodeIds: string[];
 nodes: { id: string; nodeCode: string; operationName: string | null; operationId: string; operationCode: string | null; required: boolean }[];
 edges: { fromNodeId: string; toNodeId: string }[]
}
const path = (id: string) => '/api/production/executions/' + encodeURIComponent(id)
export const executionActions = {
 path: (id: string) => request<PathView>(path(id) + '/path', { scope: 'factory' }),
 select: (id: string, revision: number, routingNodeIds: string[]) => request<PathView>(path(id) + '/actions/select-path', { method: 'POST', body: { revision, routingNodeIds }, scope: 'factory' }),
 start: (id: string) => request<MesProductionExecutionVo>(path(id) + '/actions/start', { method: 'POST', scope: 'factory' })
}
