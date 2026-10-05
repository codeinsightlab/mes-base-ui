export interface PasswordPolicy { minLength:number; maxLength:number; maxBytes:number }
export function passwordError(raw:string,policy:PasswordPolicy):string|undefined {
  if(raw.length<policy.minLength || raw.length>policy.maxLength)return `密码长度必须介于${policy.minLength}和${policy.maxLength}之间`
  if(new TextEncoder().encode(raw).length>policy.maxBytes)return `密码UTF-8长度不能超过${policy.maxBytes}字节`
}
