<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useAuth } from '@/stores/auth';import { useRouter } from 'vue-router'
import {ApiError,request} from '@/lib/request'
const captcha=ref<{captchaOnOff:boolean;registrationEnabled?:boolean;uuid?:string;img?:string}>({captchaOnOff:false}),code=ref(''),captchaLoadFailed=ref(false);async function refreshCaptcha(){captcha.value=await request('/api/captchaImage',{public:true,scope:'platform'});code.value=''};async function loadCaptcha(){captchaLoadFailed.value=false;try{await refreshCaptcha()}catch(e){captchaLoadFailed.value=true;error.value=e instanceof Error?e.message:'登录设置加载失败'}};onMounted(loadCaptcha)
const username=ref(''),password=ref(''),loading=ref(false),error=ref(''),auth=useAuth(),router=useRouter()
async function login(){loading.value=true;error.value='';try{await auth.login(username.value,password.value,code.value,captcha.value.uuid);password.value='';await router.replace('/')}catch(e){password.value='';error.value=e instanceof ApiError&&e.status===401?'登录失败，请检查账号、密码或验证码':e instanceof Error?e.message:'登录失败'}finally{loading.value=false;await loadCaptcha()}}
</script>
<template>
  <div class="login-shell">
    <section class="login-identity" aria-label="MES Base">
      <div class="login-brand"><el-icon><Operation /></el-icon>MES <span>Base</span></div>
      <div class="login-intro"><p class="eyebrow">MANUFACTURING EXECUTION SYSTEM</p><h2>连接制造流程<br>让每一步清晰可控</h2><p>从组织与权限开始，建立制造业务的统一工作基础。</p><div class="login-principles"><span><el-icon><SetUp/></el-icon>统一工作上下文</span><span><el-icon><Lock/></el-icon>清晰权限边界</span></div></div>
      <p class="login-footer">MES BASE / 制造执行系统</p>
    </section>
    <div class="login-form-area"><form class="login-card" @submit.prevent="login">
      <p class="eyebrow">MES BASE · 工作台</p><h1>欢迎登录</h1><p class="muted">使用你的账号进入管理工作台</p>
      <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon><el-button v-if="captchaLoadFailed" size="small" icon="RefreshRight" aria-label="重新加载登录设置" @click="loadCaptcha">重试</el-button></el-alert>
      <label>账号<el-input v-model="username" autocomplete="username" placeholder="请输入账号" prefix-icon="User" required /></label>
      <label>密码<el-input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" prefix-icon="Lock" show-password required /></label>
      <label v-if="captcha.captchaOnOff">验证码<div class="captcha-row"><el-input v-model="code" placeholder="请输入验证码" autocomplete="off"/><button type="button" aria-label="刷新验证码" @click="loadCaptcha"><img :src="'data:image/png;base64,'+captcha.img" alt="刷新验证码" width="128" /></button></div></label>
      <el-button type="primary" native-type="submit" :loading="loading" class="login-submit">登录工作台</el-button>
      <RouterLink v-if="captcha.registrationEnabled" to="/register">注册账号</RouterLink><p class="small muted">没有默认账号，请联系平台管理员开通。<br>登录后可选择当前工作工厂。</p>
    </form></div>
  </div>
</template>
