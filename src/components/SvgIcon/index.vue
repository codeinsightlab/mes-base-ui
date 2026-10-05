<script setup lang="ts">
import {computed} from 'vue'
const props=defineProps<{iconClass:string}>();const icons=import.meta.glob('/src/assets/icons/svg/*.svg',{eager:true,query:'?url',import:'default'})
const url=computed(()=>/^[A-Za-z0-9_-]+$/.test(props.iconClass)?String(icons['/src/assets/icons/svg/'+props.iconClass+'.svg']??''):'')
</script><template><img v-if="url" :src="url" class="source-icon" alt="" aria-hidden="true"/></template><style scoped>.source-icon{width:1em;height:1em;vertical-align:-.12em;margin-right:.6em;flex-shrink:0}.nav-node .source-icon{filter:invert(1);opacity:.75}</style>
