import { defineStore } from 'pinia'
import { request } from '@/lib/request'
import type { PermissionScope } from '@/lib/request'
export interface Menu { id:string;name:string;path:string;permission:string;kind:string;children:Menu[] }
interface Navigation { menus:Menu[];permissions:string[] }
export const useAuth = defineStore('auth', { state:() => ({ token:'',username:'',factoryId:'',revision:0,platformMenus:[] as Menu[],factoryMenus:[] as Menu[],platformPermissions:[] as string[],factoryPermissions:[] as string[],factories:[] as {factoryId:string;name:string}[],expiresAt:'' }),
 getters:{ loggedIn:s=>!!s.token }, actions:{
  hasPermission(code:string, scope:PermissionScope='factory'){return (scope==='platform'?this.platformPermissions:this.factoryPermissions).includes(code)},
  clear(){this.token='';this.username='';this.factoryId='';this.expiresAt='';this.platformMenus=[];this.factoryMenus=[];this.platformPermissions=[];this.factoryPermissions=[];this.factories=[];this.revision++},
  async login(username:string,password:string){const session=await request<{accessToken:string;expiresAt:string}>('/api/platform/session',{method:'POST',body:{username,password},scope:'platform',public:true});this.token=session.accessToken;this.expiresAt=session.expiresAt;this.username=username;this.revision++;try{await this.loadNavigation();this.factories=await request('/api/foundation/factories',{scope:'platform',query:{offset:0,limit:100}})}catch(e){this.clear();throw e}},
  async loadNavigation(){const p=await request<Navigation>('/api/platform/navigation',{scope:'platform',query:{scope:'PLATFORM'}});this.platformMenus=p.menus;this.platformPermissions=p.permissions;if(this.factoryId){const f=await request<Navigation>('/api/platform/navigation');this.factoryMenus=f.menus;this.factoryPermissions=f.permissions}},
  async selectFactory(id:string){this.factoryId=id;this.factoryMenus=[];this.factoryPermissions=[];this.revision++;if(id){try{const f=await request<Navigation>('/api/platform/navigation');this.factoryMenus=f.menus;this.factoryPermissions=f.permissions}catch(e){this.factoryId='';this.revision++;throw e}}},
  async logout(){try{await request<void>('/api/platform/session',{method:'DELETE',scope:'platform'})}finally{this.clear()}},
 } })
