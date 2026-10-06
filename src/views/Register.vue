<!-- SOURCE_PRODUCT_PORT: ktg-mes-ui/src/views/register.vue account, confirmation, captcha and success-to-login flow. -->
<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {ElMessageBox} from 'element-plus'
import {request} from '@/lib/request'
import {passwordError, type PasswordPolicy} from '@/utils/passwordPolicy'

interface Options {captchaOnOff:boolean; registrationEnabled:boolean; passwordPolicy:PasswordPolicy; uuid?:string; img?:string}
const router=useRouter(),form=ref({username:'',password:'',confirmPassword:'',code:'',uuid:''})
const options=ref<Options>(),loading=ref(false),optionsLoading=ref(false),error=ref('')
async function getCode(){
  optionsLoading.value=true
  try{options.value=await request<Options>('/api/captchaImage',{public:true,scope:'platform'});form.value.uuid=options.value.uuid??'';form.value.code=''}
  catch(e){error.value=e instanceof Error?e.message:'注册设置加载失败'}
  finally{optionsLoading.value=false}
}
onMounted(getCode)
async function register(){
  error.value=''
  if(!options.value?.registrationEnabled){error.value='当前系统没有开启注册功能';return}
  if(form.value.username.length<2 || form.value.username.length>20){error.value='用户账号长度必须介于2和20之间';return}
  const invalid=passwordError(form.value.password,options.value.passwordPolicy)
  if(invalid){error.value=invalid;return}
  if(form.value.password!==form.value.confirmPassword){error.value='两次输入的密码不一致';return}
  loading.value=true
  try{
    const {username,password,code,uuid}=form.value
    await request('/api/register',{method:'POST',public:true,scope:'platform',body:{username,password,code,uuid}})
    form.value.password='';form.value.confirmPassword=''
    await ElMessageBox.alert('账号 '+username+' 注册成功，请使用已有账号登录。','系统提示',{type:'success'})
    await router.replace('/login')
  }catch(e){error.value=e instanceof Error?e.message:'注册失败';await getCode()}
  finally{loading.value=false}
}
</script>
<template>
  <div class="login-shell register-shell"><div class="login-identity"><div class="login-brand"><el-icon><Operation /></el-icon>MES <span>Base</span></div><div class="login-intro"><p class="eyebrow">MANUFACTURING EXECUTION SYSTEM</p><h2>建立你的工作身份</h2><p>账号身份与工厂权限独立管理。</p></div><p class="login-footer">MES BASE / 制造执行系统</p></div><div class="login-form-area"><form class="login-card" @submit.prevent="register">
    <p class="eyebrow">MES BASE</p><h1>注册账号</h1>
    <el-alert v-if="error" type="error" :title="error" :closable="false"/>
    <p v-if="optionsLoading" role="status">正在加载注册设置…</p>
    <template v-if="options?.registrationEnabled">
      <label>账号<el-input v-model="form.username" autocomplete="username" placeholder="账号" :maxlength="20" required/></label>
      <label>密码<el-input v-model="form.password" type="password" autocomplete="new-password" placeholder="密码" show-password required/></label>
      <label>确认密码<el-input v-model="form.confirmPassword" type="password" autocomplete="new-password" placeholder="确认密码" required/></label>
      <label v-if="options.captchaOnOff">验证码<div style="display:flex;align-items:center;gap:12px"><el-input v-model="form.code" placeholder="验证码" autocomplete="off" required/><button type="button" @click="getCode" style="border:0;padding:0;background:none"><img :src="'data:image/png;base64,'+options.img" alt="刷新验证码" width="128"/></button></div></label>
      <el-button type="primary" native-type="submit" :loading="loading" :disabled="optionsLoading" class="login-submit">注册</el-button>
    </template>
    <p v-else-if="options">当前系统没有开启注册功能，请联系平台管理员开通账号。</p>
    <el-button v-if="!options&&!optionsLoading" @click="getCode">重新加载</el-button>
    <RouterLink to="/login">使用已有账户登录</RouterLink>
  </form></div></div>
</template>
