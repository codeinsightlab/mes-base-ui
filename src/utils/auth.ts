import {useAuth} from '@/stores/auth'
export function getToken(){return useAuth().token}
